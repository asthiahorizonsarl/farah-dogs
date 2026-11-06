"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAUT, type Filtres } from "./filtres";

export type LigneMembre = {
  id: number;
  nom: string;
  prenom: string;
  societe: string;
  adresse: string;
  codePostal: string;
  localite: string;
  canton: string;
  email: string;
  langues: number[];
  types: number[];
  sponsorFondation: boolean;
  moniteur: boolean;
  magazine: boolean;
  archive: boolean;
  politesse: string;
};
type Item = { id: number; libelle: string };

const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const CODES: Record<string, string> = { français: "FR", allemand: "DE", italien: "IT", anglais: "EN" };
const code = (lib = "") => CODES[lib.toLowerCase()] ?? lib.slice(0, 2).toUpperCase();
const uneLigne = (s: string) => s.replace(/\n/g, ", ");

export function MembresTable({ lignes, langues, types, initial }: { lignes: LigneMembre[]; langues: Item[]; types: Item[]; initial: Partial<Filtres> }) {
  const router = useRouter();
  const [f, setF] = useState<Filtres>(() => ({ ...DEFAUT, ...initial }));

  // Les filtres sont gardés dans l'adresse : retour arrière depuis une fiche = mêmes filtres.
  useEffect(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v !== DEFAUT[k as keyof Filtres]) p.set(k, String(v));
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [f]);

  const libLangue = useMemo(() => new Map(langues.map((l) => [l.id, l.libelle])), [langues]);
  const libType = useMemo(() => new Map(types.map((t) => [t.id, t.libelle])), [types]);

  const visibles = useMemo(() => {
    const mots = sansAccent(f.q).split(/\s+/).filter(Boolean);
    return lignes.filter((l) => {
      if (f.archive === "non" && l.archive) return false;
      if (f.archive === "oui" && !l.archive) return false;
      if (f.langue && !l.langues.includes(Number(f.langue))) return false;
      if (f.type === "aucun" ? l.types.length > 0 : f.type && !l.types.includes(Number(f.type))) return false;
      if (f.sponsor && !l.sponsorFondation) return false;
      if (f.moniteur && !l.moniteur) return false;
      if (f.magazine && !l.magazine) return false;
      if (mots.length) {
        const h = sansAccent([l.nom, l.prenom, l.societe, l.adresse, l.codePostal, l.localite, l.email].join(" "));
        if (!mots.every((m) => h.includes(m))) return false;
      }
      return true;
    });
  }, [lignes, f]);

  function exporter() {
    const entete = ["ID", "Politesse", "Nom", "Prénom", "Société", "Adresse", "Code postal", "Localité", "Canton", "E-mail",
      "Langues", "Type de membre", "Sponsor/fondation", "Moniteur", "Magazine", "Archivé"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = visibles.map((l) => [
      l.id, l.politesse, l.nom, l.prenom, l.societe, l.adresse, l.codePostal, l.localite, l.canton, l.email,
      l.langues.map((x) => libLangue.get(x)).join(", "), l.types.map((x) => libType.get(x)).join(", "),
      l.sponsorFondation ? "oui" : "", l.moniteur ? "oui" : "", l.magazine ? "oui" : "", l.archive ? "oui" : "",
    ].map(esc).join(";"));
    const blob = new Blob(["﻿" + [entete.map(esc).join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `membres-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const set = <K extends keyof Filtres>(k: K, v: Filtres[K]) => setF((p) => ({ ...p, [k]: v }));
  const filtreActif = JSON.stringify(f) !== JSON.stringify(DEFAUT);

  return (
    <div className="space-y-3">
      <div className="carte flex flex-wrap items-end gap-3 p-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1">
          <span className="etiquette">Rechercher</span>
          <input
            className="champ"
            type="search"
            placeholder="Nom, prénom, localité, e-mail…"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">Fiches</span>
          <select className="champ" value={f.archive} onChange={(e) => set("archive", e.target.value as Filtres["archive"])}>
            <option value="non">Non archivées</option>
            <option value="oui">Archivées</option>
            <option value="tous">Toutes</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">Type de membre</span>
          <select className="champ" value={f.type} onChange={(e) => set("type", e.target.value)}>
            <option value="">Tous</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
            <option value="aucun">Sans type</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">Langue</span>
          <select className="champ" value={f.langue} onChange={(e) => set("langue", e.target.value)}>
            <option value="">Toutes</option>
            {langues.map((l) => <option key={l.id} value={l.id}>{l.libelle}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-3 pb-1.5 text-sm">
          {([["sponsor", "Sponsor/fondation"], ["moniteur", "Moniteur"], ["magazine", "Reçoit le mag"]] as const).map(([k, lib]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" className="accent-brand-600" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
              {lib}
            </label>
          ))}
        </div>
        {filtreActif && (
          <button className="btn-secondaire" onClick={() => setF(DEFAUT)}>Effacer les filtres</button>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>{visibles.length} fiche{visibles.length > 1 ? "s" : ""} sur {lignes.length}</span>
        <button className="btn-secondaire" onClick={exporter}>Exporter la liste (CSV)</button>
      </div>

      <div className="carte overflow-x-auto">
        <table className="table-liste">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Adresse</th>
              <th>NPA</th>
              <th>Localité</th>
              <th>E-mail</th>
              <th>Langues</th>
              <th>Type</th>
              <th className="px-3 py-2" title="Sponsor/fondation">Spons.</th>
              <th className="px-3 py-2" title="Moniteur">Mon.</th>
              <th className="px-3 py-2" title="Reçoit le magazine">Mag</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr
                key={l.id}
                onClick={() => router.push(`/membres/${l.id}`)}
                className={`cursor-pointer hover:bg-stone-50 ${l.archive ? "text-stone-400" : ""}`}
              >
                <td className="font-medium">
                  <a href={`/membres/${l.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {uneLigne(l.nom) || <span className="italic text-stone-400">{uneLigne(l.societe) || "(sans nom)"}</span>}
                  </a>
                  {l.archive && <span className="badge ml-2 bg-stone-100 text-stone-500">archivé</span>}
                </td>
                <td>{l.prenom}</td>
                <td className="max-w-56 truncate" title={uneLigne(l.adresse)}>{uneLigne(l.adresse)}</td>
                <td>{l.codePostal}</td>
                <td>{l.localite}</td>
                <td className="max-w-56 truncate">{l.email}</td>
                <td className="whitespace-nowrap">
                  {l.langues.map((x) => (
                    <span key={x} className="badge mr-1 bg-stone-100 text-stone-700" title={libLangue.get(x)}>
                      {code(libLangue.get(x))}
                    </span>
                  ))}
                </td>
                <td className="whitespace-nowrap">
                  {l.types.map((x) => (
                    <span key={x} className="badge mr-1 bg-brand-50 text-brand-800">
                      {libType.get(x)?.replace(/^Membre /i, "")}
                    </span>
                  ))}
                </td>
                <td className="text-center">{l.sponsorFondation ? "✓" : ""}</td>
                <td className="text-center">{l.moniteur ? "✓" : ""}</td>
                <td className="text-center">{l.magazine ? "✓" : ""}</td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-stone-500">Aucune fiche ne correspond.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
