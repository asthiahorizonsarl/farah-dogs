import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getContacts, getListes } from "@/lib/data";
import { MembresTable, type LigneMembre } from "./MembresTable";
import { filtresDepuis } from "./filtres";

export const metadata = { title: "Membres" };

export default async function MembresPage({ searchParams }: PageProps<"/membres">) {
  const [contacts, listes, sp] = await Promise.all([getContacts(), getListes(), searchParams]);

  const lignes: LigneMembre[] = contacts.map((c) => ({
    id: c.id,
    nom: c.nom ?? "",
    prenom: c.prenom ?? "",
    societe: c.societe ?? "",
    adresse: c.adresse ?? "",
    codePostal: c.codePostal ?? "",
    localite: c.localite ?? "",
    canton: c.canton ?? "",
    email: c.email ?? "",
    langues: c.langues.map((l) => l.langueId),
    types: c.types.map((t) => t.typeId),
    sponsorFondation: c.sponsorFondation,
    moniteur: c.moniteur,
    magazine: c.magazine,
    archive: c.archive,
    politesse: c.formePolitesse?.libelle ?? "",
  }));

  return (
    <div>
      <PageHeader
        titre="Membres"
        sousTitre={`${contacts.filter((c) => !c.archive).length} fiches actives · ${contacts.filter((c) => c.archive).length} archivées`}
        actions={<Link href="/membres/nouveau" className="btn-principal"><Plus /> Nouveau membre</Link>}
      />
      {sp.supprime && (
        <p className="notice-ok">Le membre a été supprimé.</p>
      )}
      <MembresTable lignes={lignes} langues={listes.langues} types={listes.types} initial={filtresDepuis(sp)} />
    </div>
  );
}
