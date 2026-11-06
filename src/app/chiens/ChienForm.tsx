import Link from "next/link";
import { Dog, HeartPulse, MessageSquareText } from "lucide-react";
import type { ChienDetail } from "@/lib/data";
import { formatPuce } from "@/lib/chiens";
import { Champ, Section } from "@/components/ui";
import { enregistrerChien } from "./actions";

type Item = { id: number; libelle: string };

export function ChienForm({ chien, races, couleurs }: { chien?: ChienDetail; races: Item[]; couleurs: Item[] }) {
  const c = chien;
  return (
    <form action={enregistrerChien}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-5 xl:grid-cols-3">
        <Section titre="Identité du chien" icone={<Dog />} className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Nom"><input name="nom" defaultValue={c?.nom ?? ""} className="champ" required /></Champ>
            <Champ label="Sexe">
              <select name="sexe" defaultValue={c?.sexe ?? ""} className="champ">
                <option value="">Non renseigné</option>
                <option value="F">Femelle</option>
                <option value="M">Mâle</option>
              </select>
            </Champ>
            <Champ label="Race">
              <select name="raceId" defaultValue={c?.raceId ?? ""} className="champ">
                <option value="">—</option>
                {races.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
              </select>
            </Champ>
            <Champ label="Couleur">
              <select name="couleurId" defaultValue={c?.couleurId ?? ""} className="champ">
                <option value="">—</option>
                {couleurs.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
              </select>
            </Champ>
            <Champ label="Né le"><input name="dateNaissance" type="date" defaultValue={c?.dateNaissance ?? ""} className="champ" /></Champ>
            <Champ label="N° de puce (15 chiffres)">
              <input name="puce" defaultValue={formatPuce(c?.puce)} placeholder="756 …" inputMode="numeric" className="champ font-mono" />
            </Champ>
          </div>
        </Section>

        <div className="space-y-5">
          <Section titre="Fin de carrière" icone={<HeartPulse />}>
            <div className="space-y-3">
              <div className="grid grid-cols-[7rem_1fr] items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="reforme" defaultChecked={c?.reforme} className="size-4 accent-brand-600" /> Réformé
                </label>
                <input name="dateReforme" type="date" defaultValue={c?.dateReforme ?? ""} className="champ" aria-label="Date de réforme" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="decede" defaultChecked={c?.decede} className="size-4 accent-brand-600" /> Décédé
                </label>
                <input name="dateDeces" type="date" defaultValue={c?.dateDeces ?? ""} className="champ" aria-label="Date de décès" />
              </div>
            </div>
          </Section>
          <Section titre="Remarques" icone={<MessageSquareText />}>
            <textarea name="remarques" defaultValue={c?.remarques ?? ""} rows={5} className="champ resize-y" placeholder="Notes sur le chien…" />
          </Section>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-fond/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button name="intent" value="enregistrer" className="btn-principal">Enregistrer</button>
        <button name="intent" value="nouveau" className="btn-secondaire">Enregistrer et nouveau</button>
        <Link href="/chiens" className="btn-fantome">Fermer</Link>
      </div>
    </form>
  );
}
