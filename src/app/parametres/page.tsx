import { Download, Trash2 } from "lucide-react";
import { getAssociation, getListes, getListesChiens, getMotifsSuivi, getUsagesListes } from "@/lib/data";
import { enregistrerAssociation } from "@/app/cotisations/actions";
import { SectionsEnvoi } from "./SectionsEnvoi";
import { exigerUtilisateur } from "@/lib/auth";
import { changerMotDePasse, modifierCompte } from "./compte-actions";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Champ, PageHeader } from "@/components/ui";
import { ajouterElement, modifierElement, supprimerElement } from "./actions";

export const metadata = { title: "Paramètres" };

type Item = { id: number; libelle: string; ordre: number };
type Def = { nom: string; titre: string; aide: string; unite: string; items: Item[]; usages: Map<number, number> };

/** Une table de référence, en pleine largeur : ordre, libellé, utilisations, actions. */
function Table({ d }: { d: Def }) {
  return (
    <section id={d.nom} className="carte scroll-mt-6 overflow-hidden">
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="font-semibold text-stone-900">{d.titre}</h2>
        <p className="text-sm text-stone-500">{d.aide}</p>
      </div>
      <div className="grid grid-cols-[5rem_1fr_9rem_auto] gap-3 bg-stone-50/80 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        <span>Ordre</span><span>Libellé</span><span>Utilisé par</span><span className="w-[7.5rem]" />
      </div>
      <ul>
        {d.items.map((i) => {
          const n = d.usages.get(i.id) ?? 0;
          return (
            <li key={i.id} className="border-t border-stone-100">
              <form action={modifierElement} className="grid grid-cols-[5rem_1fr_9rem_auto] items-center gap-3 px-5 py-2">
                <input type="hidden" name="liste" value={d.nom} />
                <input type="hidden" name="id" value={i.id} />
                <input name="ordre" type="number" defaultValue={i.ordre} className="champ" aria-label="Ordre" />
                <input name="libelle" defaultValue={i.libelle} className="champ" aria-label="Libellé" />
                <span className="text-sm text-stone-500">{n ? `${n} ${d.unite}${n > 1 ? "s" : ""}` : "—"}</span>
                <span className="flex w-[7.5rem] justify-end gap-1">
                  <button className="btn-secondaire">Enregistrer</button>
                  {n === 0 && (
                    <ConfirmButton formAction={supprimerElement} className="btn-fantome text-red-600" title="Supprimer" message={`Supprimer « ${i.libelle} » ?`}>
                      <Trash2 />
                    </ConfirmButton>
                  )}
                </span>
              </form>
            </li>
          );
        })}
      </ul>
      <form action={ajouterElement} className="grid grid-cols-[5rem_1fr_9rem_auto] items-center gap-3 border-t border-stone-200 bg-stone-50/50 px-5 py-3">
        <input type="hidden" name="liste" value={d.nom} />
        <input name="ordre" type="number" defaultValue={Math.max(0, ...d.items.map((i) => i.ordre)) + 1} className="champ" aria-label="Ordre" />
        <input name="libelle" placeholder="Nouvelle valeur…" className="champ" aria-label="Nouvelle valeur" required />
        <span />
        <span className="flex w-[7.5rem] justify-end"><button className="btn-principal">Ajouter</button></span>
      </form>
    </section>
  );
}

export default async function Parametres({ searchParams }: PageProps<"/parametres">) {
  const [{ formes, langues, types }, { races, couleurs, pathologies }, u, asso, motifs, sp] = await Promise.all([
    getListes(), getListesChiens(), getUsagesListes(), getAssociation(), getMotifsSuivi(), searchParams,
  ]);
  const moi = await exigerUtilisateur();
  const [compte] = await db.select({ identifiant: schema.utilisateurs.identifiant, nom: schema.utilisateurs.nom, derniereConnexion: schema.utilisateurs.derniereConnexion })
    .from(schema.utilisateurs).where(eq(schema.utilisateurs.id, moi.id));
  const groupes: { titre: string; tables: Def[] }[] = [
    {
      titre: "Membres",
      tables: [
        { nom: "types", titre: "Types de membre", aide: "Proposés sur la fiche membre (actif, passif, honoraire…).", unite: "membre", items: types, usages: u.types },
        { nom: "langues", titre: "Langues", aide: "Langues parlées, cochées sur la fiche membre.", unite: "membre", items: langues, usages: u.langues },
        { nom: "formes", titre: "Formes de politesse", aide: "Madame, Herr, Famiglia… (ancienne table « Catégorie » d'Access).", unite: "membre", items: formes, usages: u.formes },
      ],
    },
    {
      titre: "Chiens",
      tables: [
        { nom: "races", titre: "Races", aide: "Race indiquée sur la fiche chien.", unite: "chien", items: races, usages: u.races },
        { nom: "couleurs", titre: "Couleurs", aide: "Couleur de robe indiquée sur la fiche chien.", unite: "chien", items: couleurs, usages: u.couleurs },
        { nom: "pathologies", titre: "Pathologies / besoins", aide: "Besoin du bénéficiaire, coché sur chaque remise.", unite: "remise", items: pathologies, usages: u.pathologies },
      ],
    },
    {
      titre: "Suivis",
      tables: [
        { nom: "motifs", titre: "Motifs de suivi", aide: "Motif choisi sur chaque suivi de membre ou de chien.", unite: "suivi", items: motifs, usages: u.motifs },
      ],
    },
  ];

  return (
    <div>
      <PageHeader titre="Paramètres" sousTitre="Les listes de valeurs utilisées dans les fiches. Une valeur utilisée ne peut pas être supprimée, seulement renommée." />
      {sp.erreur && <p className="notice-erreur mb-4">{String(sp.erreur)}</p>}
      {sp.ok && <p className="notice-ok mb-4">{sp.ok === "association" ? "Coordonnées enregistrées." : String(sp.ok)}</p>}
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-8 space-y-5 text-sm">
            {groupes.map((g) => (
              <div key={g.titre}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.titre}</div>
                <ol className="space-y-0.5">
                  {g.tables.map((t) => (
                    <li key={t.nom}>
                      <a href={`#${t.nom}`} className="flex justify-between rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-white hover:text-stone-900">
                        {t.titre} <span className="text-stone-400">{t.items.length}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Attestations et envois</div>
              <ol className="space-y-0.5">
                {[["compte", "Compte super admin"], ["sauvegarde", "Sauvegarde"], ["association", "Association"], ["envois", "Seuil et serveur e-mail"], ["modele-cotisation", "Attestation de cotisation"], ["modele-don", "Don jusqu'au seuil"], ["modele-don_grand", "Don au-dessus du seuil"], ["modele-demande", "Demande de cotisation / don"]].map(([a, l]) => (
                  <li key={a}><a href={`#${a}`} className="block rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-white hover:text-stone-900">{l}</a></li>
                ))}
              </ol>
            </div>
          </div>
        </nav>
        <div className="space-y-10">
          <section id="compte" className="carte scroll-mt-6 overflow-hidden">
            <div className="border-b border-stone-100 px-5 py-4">
              <h2 className="font-semibold text-stone-900">Compte super administrateur</h2>
              <p className="text-sm text-stone-500">
                Accès complet à l&apos;application.{compte?.derniereConnexion && ` Dernière connexion : ${compte.derniereConnexion.toLocaleString("fr-CH", { timeZone: "Europe/Zurich" })}.`}
              </p>
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <form action={modifierCompte} className="space-y-3">
                <Champ label="Identifiant de connexion"><input name="identifiant" defaultValue={compte?.identifiant} autoComplete="username" className="champ" required /></Champ>
                <Champ label="Nom affiché"><input name="nom" defaultValue={compte?.nom ?? ""} className="champ" /></Champ>
                <button className="btn-secondaire">Enregistrer</button>
              </form>
              <form action={changerMotDePasse} className="space-y-3">
                <Champ label="Mot de passe actuel"><input name="actuel" type="password" autoComplete="current-password" className="champ" required /></Champ>
                <Champ label="Nouveau mot de passe (10 caractères minimum)"><input name="nouveau" type="password" autoComplete="new-password" minLength={10} className="champ" required /></Champ>
                <Champ label="Confirmer le nouveau mot de passe"><input name="confirmation" type="password" autoComplete="new-password" minLength={10} className="champ" required /></Champ>
                <button className="btn-principal">Changer le mot de passe</button>
                <p className="text-xs text-stone-400">Après le changement, vous devrez vous reconnecter.</p>
              </form>
            </div>
          </section>
          <section id="sauvegarde" className="carte scroll-mt-6 flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-64 flex-1">
              <h2 className="font-semibold text-stone-900">Sauvegarde</h2>
              <p className="text-sm text-stone-500">
                Télécharge un fichier ZIP avec toutes les données (membres, chiens, cotisations, dons, suivis, paramètres…),
                les modèles Word et les photos. À conserver en lieu sûr : il contient des données personnelles.
              </p>
            </div>
            <a href="/parametres/sauvegarde" className="btn-principal"><Download /> Télécharger la sauvegarde</a>
          </section>
          {groupes.map((g) => (
            <div key={g.titre} className="space-y-5">
              <h2 className="text-lg font-semibold text-stone-900">{g.titre}</h2>
              {g.tables.map((t) => <Table key={t.nom} d={t} />)}
            </div>
          ))}
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-stone-900">Attestations et envois</h2>
            <form id="association" action={enregistrerAssociation} className="carte scroll-mt-6 overflow-hidden">
              <div className="border-b border-stone-100 px-5 py-4">
                <h3 className="font-semibold text-stone-900">Association</h3>
                <p className="text-sm text-stone-500">Coordonnées et signature imprimées sur les attestations de cotisation et de don.</p>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Champ label="Nom"><input name="nom" defaultValue={asso.nom} className="champ" /></Champ>
                <Champ label="Adresse"><input name="adresse" defaultValue={asso.adresse ?? ""} className="champ" /></Champ>
                <Champ label="NPA et localité"><input name="npaLocalite" defaultValue={asso.npaLocalite ?? ""} className="champ" /></Champ>
                <Champ label="Lieu de signature"><input name="lieuSignature" defaultValue={asso.lieuSignature ?? ""} className="champ" /></Champ>
                <Champ label="E-mail"><input name="email" defaultValue={asso.email ?? ""} className="champ" /></Champ>
                <Champ label="Téléphone"><input name="telephone" defaultValue={asso.telephone ?? ""} className="champ" /></Champ>
                <Champ label="IBAN"><input name="iban" defaultValue={asso.iban ?? ""} className="champ font-mono" /></Champ>
                <div />
                <Champ label="Signataire"><input name="signataire" defaultValue={asso.signataire ?? ""} placeholder="ex. Prénom Nom" className="champ" /></Champ>
                <Champ label="Fonction du signataire"><input name="fonctionSignataire" defaultValue={asso.fonctionSignataire ?? ""} placeholder="ex. Président·e" className="champ" /></Champ>
                <Champ label="Mention ajoutée sur l'attestation" className="sm:col-span-2">
                  <textarea name="mentionAttestation" defaultValue={asso.mentionAttestation ?? ""} rows={3} className="champ resize-y"
                    placeholder="ex. mention de reconnaissance d'utilité publique / déductibilité fiscale, si elle s'applique" />
                </Champ>
              </div>
              <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-3"><button className="btn-principal">Enregistrer</button></div>
            </form>
            <SectionsEnvoi />
          </div>
        </div>
      </div>
    </div>
  );
}
