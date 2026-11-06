import { getListes } from "@/lib/data";
import { MembreForm } from "../MembreForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Nouveau membre" };

export default async function NouveauMembre({ searchParams }: PageProps<"/membres/nouveau">) {
  const [{ formes, langues, types }, sp] = await Promise.all([getListes(), searchParams]);
  return (
    <div className="space-y-4">
      <PageHeader retour={{ href: "/membres", label: "Membres" }} titre="Nouveau membre" />
      {sp.ok && <p className="notice-ok">Fiche enregistrée. Vous pouvez saisir la suivante.</p>}
      <MembreForm key={String(sp.ok ?? "")} formes={formes} langues={langues} types={types} />
    </div>
  );
}
