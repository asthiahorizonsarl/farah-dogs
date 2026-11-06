import Link from "next/link";
import { connection } from "next/server";
import { getMotifsSuivi, getSuivis } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { ETATS, Suivis } from "@/components/Suivis";

export const metadata = { title: "Suivis" };

export default async function PageSuivis({ searchParams }: PageProps<"/suivis">) {
  await connection();
  const sp = await searchParams;
  const etat = typeof sp.etat === "string" ? sp.etat : "actifs";
  const type = sp.type === "membres" || sp.type === "chiens" ? sp.type : "tous";
  const [tous, motifs] = await Promise.all([getSuivis({ etat: etat === "tous" ? undefined : etat }), getMotifsSuivi()]);
  const suivis = tous.filter((s) => type === "tous" || (type === "membres" ? s.contactId : s.chienId));
  const lien = (e: string, t: string) => `/suivis?etat=${e}&type=${t}`;
  const retour = lien(etat, type);

  return (
    <div className="space-y-5">
      <PageHeader titre="Suivis" sousTitre="Suivis des membres et des chiens. Ajoutez un suivi depuis la fiche du membre ou du chien." />
      {sp.erreur && <p className="notice-erreur">{String(sp.erreur)}</p>}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
          {[{ v: "actifs", l: "Ouverts et en cours" }, ...ETATS.map((e) => ({ v: e.v, l: e.l })), { v: "tous", l: "Tous" }].map((e) => (
            <Link key={e.v} href={lien(e.v, type)} className={`rounded-md px-3 py-1.5 ${etat === e.v ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>{e.l}</Link>
          ))}
        </div>
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
          {[["tous", "Membres et chiens"], ["membres", "Membres"], ["chiens", "Chiens"]].map(([v, l]) => (
            <Link key={v} href={lien(etat, v)} className={`rounded-md px-3 py-1.5 ${type === v ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>{l}</Link>
          ))}
        </div>
      </div>
      <Suivis suivis={suivis} motifs={motifs} retour={retour} afficherSujet />
    </div>
  );
}
