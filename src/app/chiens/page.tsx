import Link from "next/link";
import { Dog, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getChiens } from "@/lib/data";
import { age, formatPuce, remiseEnCours, statutChien } from "@/lib/chiens";
import { formatDate, nomComplet } from "@/lib/format";

export const metadata = { title: "Chiens" };

const STATUTS = ["Remis", "En stage", "Pas actif", "Disponible", "Réformé", "Décédé"];
const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function Chiens({ searchParams }: PageProps<"/chiens">) {
  const [chiens, sp] = await Promise.all([getChiens(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const statut = typeof sp.statut === "string" ? sp.statut : "";

  const lignes = chiens.map((c) => {
    const s = statutChien(c);
    const enCours = remiseEnCours(c.remises);
    const derniere = enCours ?? c.remises[0];
    return { c, s, derniere, enCours };
  });
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const visibles = lignes.filter(({ c, s, derniere }) => {
    if (statut && s.label !== statut) return false;
    if (!mots.length) return true;
    const h = sansAccent([c.nom, c.race?.libelle, c.puce, derniere && nomComplet(derniere.contact),
      derniere?.beneficiairePrenom, derniere?.beneficiaireNom, derniere?.contact.localite].join(" "));
    return mots.every((m) => h.includes(m));
  });
  const compte = (l: string) => lignes.filter((x) => x.s.label === l).length;

  return (
    <div className="space-y-4">
      <PageHeader
        titre="Chiens"
        sousTitre={`${compte("Remis") + compte("En stage")} au travail · ${lignes.length} chiens enregistrés`}
        actions={<Link href="/chiens/nouveau" className="btn-principal"><Plus /> Nouveau chien</Link>}
      />
      {sp.supprime && <p className="notice-ok">Le chien a été supprimé.</p>}

      <form className="carte flex flex-wrap items-end gap-3 p-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1">
          <span className="etiquette">Rechercher</span>
          <input name="q" type="search" defaultValue={q} placeholder="Nom, race, puce, famille, localité…" className="champ" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="etiquette">Statut</span>
          <select name="statut" defaultValue={statut} className="champ">
            <option value="">Tous ({lignes.length})</option>
            {STATUTS.map((s) => <option key={s} value={s}>{s} ({compte(s)})</option>)}
          </select>
        </label>
        <button className="btn-secondaire">Filtrer</button>
        {(q || statut) && <Link href="/chiens" className="btn-secondaire">Effacer</Link>}
      </form>

      <p className="text-sm text-stone-600">{visibles.length} chien{visibles.length > 1 ? "s" : ""}</p>
      <div className="carte overflow-x-auto">
        <table className="table-liste">
          <thead>
            <tr>
              <th>Chien</th>
              <th>Race</th>
              <th>Couleur</th>
              <th>Né le</th>
              <th>Puce</th>
              <th>Statut</th>
              <th>Famille / bénéficiaire</th>
              <th>Reçu le</th>
              <th>Besoin</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ c, s, derniere, enCours }) => (
              <tr key={c.id} className="hover:bg-stone-50">
                <td className="font-medium">
                  <span className="flex items-center gap-3">
                    {c.photoType ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/chiens/photo/${c.id}?v=${c.modifieLe.getTime()}`} alt="" loading="lazy" className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-stone-200" />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-300"><Dog className="size-4" /></span>
                    )}
                    <span>
                      <Link href={`/chiens/${c.id}`} className="text-brand-800 hover:underline">{c.nom}</Link>
                      {c.remises.length > 1 && <span className="ml-1 text-xs text-stone-400" title="Nombre de remises">×{c.remises.length}</span>}
                    </span>
                  </span>
                </td>
                <td >{c.race?.libelle}</td>
                <td >{c.couleur?.libelle}</td>
                <td className="whitespace-nowrap px-3 py-2" title={age(c.dateNaissance)}>{formatDate(c.dateNaissance)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{formatPuce(c.puce)}</td>
                <td ><span className={`badge ${s.couleur}`}>{s.label}</span></td>
                <td >
                  {derniere && (
                    <span className={enCours ? "" : "text-stone-400"}>
                      <Link href={`/membres/${derniere.contactId}`} className="hover:underline">{nomComplet(derniere.contact)}</Link>
                      {derniere.beneficiairePrenom && <span className="text-stone-500"> · {derniere.beneficiairePrenom}</span>}
                      {derniere.contact.localite && <span className="text-stone-400"> — {derniere.contact.localite}</span>}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(derniere?.dateRemise)}</td>
                <td >{derniere?.pathologies.map((p) => p.pathologie.libelle).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
