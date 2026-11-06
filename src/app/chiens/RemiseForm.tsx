import { Picker, type Choix } from "@/components/ContactPicker";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MOTIFS_FIN, TYPES_REMISE } from "@/lib/chiens";
import { Champ } from "@/components/ui";
import { ajouterRemise, modifierRemise, supprimerRemise } from "./actions";

type Item = { id: number; libelle: string };
export type RemiseEdit = {
  id: number; chienId: number; contactId: number; beneficiaireNom: string | null; beneficiairePrenom: string | null;
  type: string; dateRemise: string | null; dateFin: string | null; motifFin: string | null; actif: boolean;
  moniteurId: number | null; remarques: string | null; pathologies: { pathologieId: number }[];
};


/**
 * Formulaire d'une remise (chien confié à un membre).
 * - depuis la fiche chien : on choisit le membre (`chienId` fixé) ;
 * - depuis la fiche membre : on choisit le chien (`contactId` fixé).
 */
export function RemiseForm({
  remise, chienId, contactId, membres, chiens, moniteurs, pathologies, retour,
}: {
  remise?: RemiseEdit;
  chienId?: number;
  contactId?: number;
  membres?: Choix[];
  chiens?: Choix[];
  moniteurs: Item[];
  pathologies: Item[];
  retour: string;
}) {
  const r = remise;
  const patho = new Set(r?.pathologies.map((p) => p.pathologieId));
  return (
    <form action={r ? modifierRemise : ajouterRemise} className="grid gap-3 sm:grid-cols-6">
      {r && <input type="hidden" name="id" value={r.id} />}
      <input type="hidden" name="retour" value={retour} />
      {chienId !== undefined ? (
        <input type="hidden" name="chienId" value={chienId} />
      ) : (
        <Champ label="Chien" className="sm:col-span-2">
          <Picker name="chienId" choix={chiens ?? []} defautId={r?.chienId} placeholder="Nom ou puce du chien…" required />
        </Champ>
      )}
      {contactId !== undefined ? (
        <input type="hidden" name="contactId" value={contactId} />
      ) : (
        <Champ label="Membre (famille)" className="sm:col-span-3">
          <Picker name="contactId" choix={membres ?? []} defautId={r?.contactId} placeholder="Tapez un nom…" required />
        </Champ>
      )}
      <Champ label="Type">
        <select name="type" defaultValue={r?.type ?? "remise"} className="champ">
          {TYPES_REMISE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Champ>
      <Champ label="Bénéficiaire – prénom">
        <input name="beneficiairePrenom" defaultValue={r?.beneficiairePrenom ?? ""} className="champ" />
      </Champ>
      <Champ label="Bénéficiaire – nom">
        <input name="beneficiaireNom" defaultValue={r?.beneficiaireNom ?? ""} className="champ" />
      </Champ>
      <Champ label="Reçu le">
        <input name="dateRemise" type="date" defaultValue={r?.dateRemise ?? ""} className="champ" />
      </Champ>
      <Champ label="Fin le">
        <input name="dateFin" type="date" defaultValue={r?.dateFin ?? ""} className="champ" />
      </Champ>
      <Champ label="Motif de fin">
        <select name="motifFin" defaultValue={r?.motifFin ?? ""} className="champ">
          <option value="">— en cours —</option>
          {MOTIFS_FIN.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Champ>
      <Champ label="Moniteur">
        <select name="moniteurId" defaultValue={r?.moniteurId ?? ""} className="champ">
          <option value="">—</option>
          {moniteurs.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
        </select>
      </Champ>
      <fieldset className="sm:col-span-6">
        <legend className="etiquette mb-2">Pathologie / besoin du bénéficiaire</legend>
        <div className="grid grid-flow-row gap-y-1 sm:grid-flow-col sm:grid-rows-4">
          {pathologies.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pathologies" value={p.id} defaultChecked={patho.has(p.id)} className="accent-brand-600" />
              {p.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <Champ label="Remarques" className="sm:col-span-5">
        <textarea name="remarques" defaultValue={r?.remarques ?? ""} rows={2} className="champ resize-y" />
      </Champ>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="actif" defaultChecked={r?.actif ?? true} className="size-4 accent-brand-600" />
        Chien actif
      </label>
      <div className="flex gap-2 sm:col-span-6">
        <button className="btn-principal">{r ? "Enregistrer la remise" : "Ajouter la remise"}</button>
        {r && (
          <ConfirmButton formAction={supprimerRemise} className="btn-danger" message="Supprimer cette remise ?">
            Supprimer la remise
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}
