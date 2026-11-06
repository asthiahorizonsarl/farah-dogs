import Link from "next/link";
import { Camera, Plus, Trash2 } from "lucide-react";
import type { SuiviDetail } from "@/lib/data";
import { formatDate, nomComplet } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Champ, Vide } from "@/components/ui";
import { ajouterSuivi, changerEtat, modifierSuivi, supprimerSuivi } from "@/app/suivis/actions";

type Motif = { id: number; libelle: string };

export const ETATS = [
  { v: "ouvert", l: "Ouvert", c: "bg-sky-50 text-sky-700" },
  { v: "en_cours", l: "En cours", c: "bg-amber-50 text-amber-700" },
  { v: "ferme", l: "Fermé", c: "bg-stone-100 text-stone-500" },
] as const;
export const etat = (v: string) => ETATS.find((e) => e.v === v) ?? ETATS[0];

function ChampsSuivi({ s, motifs }: { s?: SuiviDetail; motifs: Motif[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_14rem_1fr_10rem]">
      <Champ label="Date"><input name="date" type="date" defaultValue={s?.date ?? new Date().toLocaleDateString("sv-SE")} className="champ" required /></Champ>
      <Champ label="Motif">
        <select name="motifId" defaultValue={s?.motifId ?? ""} className="champ">
          <option value="">—</option>
          {motifs.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
        </select>
      </Champ>
      <Champ label="Titre"><input name="titre" defaultValue={s?.titre ?? ""} className="champ" required /></Champ>
      <Champ label="État">
        <select name="etat" defaultValue={s?.etat ?? "ouvert"} className="champ">
          {ETATS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
        </select>
      </Champ>
      <Champ label="Rapport" className="sm:col-span-4">
        <textarea name="rapport" defaultValue={s?.rapport ?? ""} rows={5} className="champ resize-y" placeholder="Comment cela se passe, ce qui a été observé, ce qui est prévu…" />
      </Champ>
      <Champ label="Ajouter des photos" className="sm:col-span-4">
        <input name="photos" type="file" accept="image/*" multiple className="champ file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-2 file:py-1 file:text-sm" />
      </Champ>
    </div>
  );
}

/** Liste des suivis d'un membre ou d'un chien, avec ajout et modification. */
export function Suivis({
  suivis, motifs, contactId, chienId, retour, afficherSujet = false,
}: { suivis: SuiviDetail[]; motifs: Motif[]; contactId?: number; chienId?: number; retour: string; afficherSujet?: boolean }) {
  return (
    <div className="space-y-4">
      {(contactId || chienId) && (
        <details className="carte p-5" open={suivis.length === 0}>
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-900">
            <Plus className="size-4 text-brand-600" /> Nouveau suivi
          </summary>
          <form action={ajouterSuivi} className="mt-4 space-y-3">
            {contactId && <input type="hidden" name="contactId" value={contactId} />}
            {chienId && <input type="hidden" name="chienId" value={chienId} />}
            <input type="hidden" name="retour" value={retour} />
            <ChampsSuivi motifs={motifs} />
            <button className="btn-principal">Enregistrer le suivi</button>
          </form>
        </details>
      )}

      {suivis.length === 0 && <Vide>Aucun suivi pour le moment.</Vide>}

      <ol className="relative space-y-4 border-l-2 border-stone-200 pl-6">
        {suivis.map((s) => {
          const e = etat(s.etat);
          return (
            <li key={s.id} className="relative">
              <span className={`absolute -left-[33px] top-5 size-4 rounded-full border-4 border-fond ${s.etat === "ferme" ? "bg-stone-300" : "bg-brand-600"}`} />
              <article className="carte">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 pt-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-stone-900">{s.titre}</h3>
                      <span className={`badge ${e.c}`}>{e.l}</span>
                      {s.motif && <span className="badge bg-brand-50 text-brand-700">{s.motif.libelle}</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-stone-500">
                      {formatDate(s.date)}
                      {afficherSujet && s.contact && <> · <Link href={`/membres/${s.contact.id}?onglet=suivis`} className="lien">{nomComplet(s.contact)}</Link></>}
                      {afficherSujet && s.chien && <> · <Link href={`/chiens/${s.chien.id}?onglet=suivis`} className="lien">{s.chien.nom}</Link></>}
                    </div>
                  </div>
                  <form action={changerEtat} className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="retour" value={retour} />
                    {ETATS.map((x) => (
                      <button key={x.v} name="etat" value={x.v}
                        className={`rounded-md px-2.5 py-1 ${s.etat === x.v ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{x.l}</button>
                    ))}
                  </form>
                </div>
                {s.rapport && <p className="whitespace-pre-line px-5 pt-3 text-sm text-stone-700">{s.rapport}</p>}
                {s.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-5 pt-3">
                    {s.photos.map((p) => (
                      <a key={p.id} href={`/suivis/photo/${p.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-stone-200 hover:ring-brand-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/suivis/photo/${p.id}`} alt={p.nomFichier} className="size-28 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <details className="mt-3 border-t border-stone-100 px-5 py-3">
                  <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-800">Modifier</summary>
                  <form action={modifierSuivi} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="retour" value={retour} />
                    <ChampsSuivi s={s} motifs={motifs} />
                    {s.photos.length > 0 && (
                      <fieldset className="flex flex-wrap gap-3 text-sm">
                        <legend className="etiquette mb-1 flex items-center gap-1"><Camera className="size-3.5" /> Retirer des photos</legend>
                        {s.photos.map((p) => (
                          <label key={p.id} className="flex items-center gap-2">
                            <input type="checkbox" name="supprimerPhoto" value={p.id} className="size-4 accent-brand-600" /> {p.nomFichier}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <div className="flex gap-2">
                      <button className="btn-principal">Enregistrer</button>
                      <ConfirmButton formAction={supprimerSuivi} className="btn-danger" message={`Supprimer le suivi « ${s.titre} » ?`}><Trash2 /> Supprimer</ConfirmButton>
                    </div>
                  </form>
                </details>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
