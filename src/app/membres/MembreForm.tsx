import Link from "next/link";
import { BadgeCheck, Languages, MapPin, MessageSquareText, Phone, UserRound } from "lucide-react";
import type { ContactDetail } from "@/lib/data";
import { Champ, Section } from "@/components/ui";
import { enregistrerContact } from "./actions";

type Item = { id: number; libelle: string };
const CANTONS = ["AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE", "NW", "OW", "SG", "SH",
  "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH", "Hors Suisse"];

/** Zone de texte qui garde les retours à la ligne venant d'Access. */
function Texte({ name, defaut, lignes = 1 }: { name: string; defaut?: string | null; lignes?: number }) {
  const n = Math.max(lignes, (defaut ?? "").split("\n").length);
  return n > 1 ? (
    <textarea name={name} defaultValue={defaut ?? ""} rows={n} className="champ resize-y" />
  ) : (
    <input name={name} defaultValue={defaut ?? ""} className="champ" />
  );
}

function Interrupteur({ name, label, checked, value, aide }: { name: string; label: string; checked: boolean; value?: string | number; aide?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-stone-50">
      <span className="text-sm text-stone-700">
        {label}
        {aide && <span className="block text-xs text-stone-400">{aide}</span>}
      </span>
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={checked} className="peer sr-only" />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-stone-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}

function Case({ name, value, label, checked }: { name: string; value: number; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4 rounded accent-brand-600" />
      {label}
    </label>
  );
}

export function MembreForm({
  contact, formes, langues, types,
}: { contact?: ContactDetail; formes: Item[]; langues: Item[]; types: Item[] }) {
  const c = contact;
  const lang = new Set(c?.langues.map((l) => l.langueId));
  const typ = new Set(c?.types.map((t) => t.typeId));

  return (
    <form action={enregistrerContact} id="fiche">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section titre="Identité" icone={<UserRound />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ label="Forme de politesse">
                <select name="formePolitesseId" defaultValue={c?.formePolitesseId ?? ""} className="champ">
                  <option value="">—</option>
                  {formes.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                </select>
              </Champ>
              <div className="hidden sm:block" />
              <Champ label="Nom"><Texte name="nom" defaut={c?.nom} /></Champ>
              <Champ label="Prénom"><Texte name="prenom" defaut={c?.prenom} /></Champ>
              <Champ label="Société"><Texte name="societe" defaut={c?.societe} /></Champ>
              <Champ label="Fonction"><Texte name="fonction" defaut={c?.fonction} /></Champ>
            </div>
          </Section>

          <Section titre="Adresse" icone={<MapPin />}>
            <div className="grid gap-4 sm:grid-cols-6">
              <Champ label="Rue" className="sm:col-span-6"><Texte name="adresse" defaut={c?.adresse} /></Champ>
              <Champ label="Code postal" className="sm:col-span-2"><input name="codePostal" defaultValue={c?.codePostal ?? ""} className="champ" /></Champ>
              <Champ label="Localité" className="sm:col-span-4"><input name="localite" defaultValue={c?.localite ?? ""} className="champ" /></Champ>
              <Champ label="Canton" className="sm:col-span-3">
                <input name="canton" list="cantons" defaultValue={c?.canton ?? ""} className="champ" />
              </Champ>
              <datalist id="cantons">{CANTONS.map((k) => <option key={k} value={k} />)}</datalist>
              <Champ label="Pays/Région" className="sm:col-span-3"><input name="pays" defaultValue={c?.pays ?? (c ? "" : "CH")} className="champ" /></Champ>
            </div>
          </Section>

          <Section titre="Coordonnées" icone={<Phone />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ label="E-mail"><input name="email" inputMode="email" defaultValue={c?.email ?? ""} className="champ" /></Champ>
              <Champ label="Page web"><input name="pageWeb" defaultValue={c?.pageWeb ?? ""} className="champ" /></Champ>
              <Champ label="Téléphone mobile"><input name="telMobile" defaultValue={c?.telMobile ?? ""} className="champ" /></Champ>
              <Champ label="Téléphone personnel"><input name="telPersonnel" defaultValue={c?.telPersonnel ?? ""} className="champ" /></Champ>
              <Champ label="Téléphone professionnel"><input name="telProfessionnel" defaultValue={c?.telProfessionnel ?? ""} className="champ" /></Champ>
              <Champ label="Télécopie"><input name="fax" defaultValue={c?.fax ?? ""} className="champ" /></Champ>
            </div>
            {c?.pageWebTexte && <p className="mt-2 text-xs text-stone-400">Texte du lien dans Access : {c.pageWebTexte}</p>}
          </Section>
        </div>

        <div className="space-y-5">
          <Section titre="Type de membre" icone={<BadgeCheck />}>
            <div className="flex flex-col">
              {types.map((t) => <Case key={t.id} name="types" value={t.id} label={t.libelle} checked={typ.has(t.id)} />)}
            </div>
            {typ.size > 1 && <p className="mt-2 text-xs text-amber-700">Attention : plusieurs types cochés.</p>}
            <div className="mt-3 flex flex-col border-t border-stone-100 pt-3">
              <Interrupteur name="sponsorFondation" label="Sponsor / fondation" checked={c?.sponsorFondation ?? false} />
              <Interrupteur name="moniteur" label="Moniteur" checked={c?.moniteur ?? false} />
              <Interrupteur name="magazine" label="Reçoit le mag" aide="Newsletter de l'association" checked={c?.magazine ?? !c} />
            </div>
          </Section>

          <Section titre="Langues parlées" icone={<Languages />}>
            <div className="flex flex-col">
              {langues.map((l) => <Case key={l.id} name="langues" value={l.id} label={l.libelle} checked={lang.has(l.id)} />)}
            </div>
          </Section>

          <Section titre="Remarques" icone={<MessageSquareText />}>
            <textarea name="remarques" defaultValue={c?.remarques ?? ""} rows={8} className="champ resize-y" placeholder="Notes internes…" />
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-fond/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button type="submit" name="intent" value="enregistrer" className="btn-principal">Enregistrer</button>
        <button type="submit" name="intent" value="nouveau" className="btn-secondaire">Enregistrer et nouveau</button>
        <Link href="/membres" className="btn-fantome">Fermer</Link>
      </div>
    </form>
  );
}
