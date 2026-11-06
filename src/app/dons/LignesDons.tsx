"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Search, Trash2, X } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { modifierDon, supprimerDon } from "./actions";

export type LigneDon = {
  id: number; contactId: number; membre: string; lieu: string; archive: boolean;
  montant: number | null; date: string | null; remarque: string | null; anneeDeduite: boolean;
};

const chf = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
const fmt = (c: number | null) => (c === null ? "" : chf.format(c / 100));
const date = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "");
const saisie = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function LignesDons({ annee, lignes, seuil }: { annee: number | null; lignes: LigneDon[]; seuil: number }) {
  const [q, setQ] = useState("");
  const [tri, setTri] = useState<"date" | "montant" | "nom">("date");
  const [edition, setEdition] = useState<number | null>(null);
  const retour = `/dons?annee=${annee ?? "sans"}`;

  const visibles = useMemo(() => {
    const mots = sansAccent(q).split(/\s+/).filter(Boolean);
    return lignes
      .filter((l) => !mots.length || mots.every((m) => sansAccent(`${l.membre} ${l.lieu}`).includes(m)))
      .sort((a, b) => tri === "montant" ? (b.montant ?? 0) - (a.montant ?? 0)
        : tri === "nom" ? a.membre.localeCompare(b.membre, "fr") : (b.date ?? "").localeCompare(a.date ?? ""));
  }, [lignes, q, tri]);
  const total = visibles.reduce((s, l) => s + (l.montant ?? 0), 0);

  return (
    <section className="carte overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-4">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className="champ pl-9" type="search" placeholder="Rechercher un donateur…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-sm">
          {([["date", "Plus récents"], ["montant", "Plus gros"], ["nom", "Par nom"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTri(v)}
              className={`rounded-md px-3 py-1.5 transition ${tri === v ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-liste">
          <thead><tr><th>Donateur</th><th className="text-right">Montant</th><th>Date</th><th>Remarque</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {visibles.map((l) =>
              edition === l.id ? (
                <tr key={l.id} className="bg-stone-50/70">
                  <td colSpan={5}>
                    <form action={modifierDon} className="grid items-end gap-3 sm:grid-cols-[1fr_6rem_8rem_10rem_1fr_auto]">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="contactId" value={l.contactId} />
                      <input type="hidden" name="retour" value={retour} />
                      <input type="hidden" name="anneeDeduite" value={l.anneeDeduite ? "1" : "0"} />
                      <input type="hidden" name="anneeOrigine" value={annee ?? ""} />
                      <span className="pb-2 font-medium">{l.membre}</span>
                      <label className="flex flex-col gap-1"><span className="etiquette">Année</span><input name="annee" type="number" defaultValue={annee ?? ""} className="champ" /></label>
                      <label className="flex flex-col gap-1"><span className="etiquette">Montant</span><input name="montant" inputMode="decimal" defaultValue={saisie(l.montant)} className="champ text-right" /></label>
                      <label className="flex flex-col gap-1"><span className="etiquette">Date</span><input name="date" type="date" defaultValue={l.date ?? ""} className="champ" /></label>
                      <label className="flex flex-col gap-1"><span className="etiquette">Remarque</span><input name="remarque" defaultValue={l.remarque ?? ""} className="champ" /></label>
                      <span className="flex gap-1">
                        <button className="btn-principal">Enregistrer</button>
                        <button type="button" onClick={() => setEdition(null)} className="btn-fantome" title="Annuler"><X /></button>
                      </span>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={l.id} className="hover:bg-stone-50/60">
                  <td>
                    <Link href={`/membres/${l.contactId}?onglet=dons`} className="font-medium text-stone-900 hover:text-brand-700">{l.membre}</Link>
                    {l.archive && <span className="badge ml-2 bg-stone-100 text-stone-500">archivé</span>}
                    <div className="text-xs text-stone-400">{l.lieu}</div>
                  </td>
                  <td className="text-right tabular-nums">
                    {fmt(l.montant)}
                    {(l.montant ?? 0) > seuil && <span className="badge ml-2 bg-violet-50 text-violet-700" title="Au-dessus du seuil : courrier spécifique">&gt; seuil</span>}
                  </td>
                  <td className="text-stone-500">{date(l.date)}</td>
                  <td className="max-w-64 truncate text-stone-500" title={l.remarque ?? ""}>
                    {l.anneeDeduite && <span className="badge mr-1 bg-amber-50 text-amber-700" title="Année vide dans Access, déduite de la date">déduite</span>}
                    {l.remarque}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {annee !== null && (l.montant ?? 0) > 0 && (
                        <a href={`/envois/document/don/${l.contactId}/${annee}`} className="btn-secondaire px-2.5 py-1 text-xs" title="Attestation (modèle Word, sinon PDF)">
                          <FileText /> Attestation
                        </a>
                      )}
                      <button onClick={() => setEdition(l.id)} className="btn-fantome px-2 py-1" title="Modifier"><Pencil /></button>
                      <form action={supprimerDon}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="contactId" value={l.contactId} />
                        <input type="hidden" name="retour" value={retour} />
                        <ConfirmButton className="btn-fantome px-2 py-1 text-red-600" title="Supprimer" message={`Supprimer ce don de ${l.membre} ?`}><Trash2 /></ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {visibles.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-stone-500">Aucun don.</td></tr>}
          </tbody>
          <tfoot className="border-t-2 border-stone-200 font-semibold">
            <tr>
              <td className="px-4 py-3">{visibles.length} don{visibles.length > 1 ? "s" : ""}</td>
              <td className="px-4 py-3 text-right tabular-nums text-brand-700">{fmt(total)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
