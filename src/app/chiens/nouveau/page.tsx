import { getListesChiens } from "@/lib/data";
import { ChienForm } from "../ChienForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Nouveau chien" };

export default async function NouveauChien({ searchParams }: PageProps<"/chiens/nouveau">) {
  const [{ races, couleurs }, sp] = await Promise.all([getListesChiens(), searchParams]);
  return (
    <div className="space-y-4">
      <PageHeader retour={{ href: "/chiens", label: "Chiens" }} titre="Nouveau chien" sousTitre="Après l'enregistrement, vous pourrez remettre le chien à un membre." />
      {sp.ok && <p className="notice-ok">Chien enregistré. Vous pouvez saisir le suivant.</p>}
      {sp.erreur && <p className="notice-erreur">{String(sp.erreur)}</p>}
      <ChienForm races={races} couleurs={couleurs} />
    </div>
  );
}
