import "server-only";
import { connection } from "next/server";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "./auth";

/** Les données viennent toujours de la base au moment de la requête (pas de cache). */
async function live() {
  await connection();
  await exigerUtilisateur();
}

export async function getListes() {
  await live();
  const [formes, langues, types] = await Promise.all([
    db.select().from(schema.formesPolitesse).orderBy(asc(schema.formesPolitesse.ordre), asc(schema.formesPolitesse.id)),
    db.select().from(schema.langues).orderBy(asc(schema.langues.ordre), asc(schema.langues.id)),
    db.select().from(schema.typesMembre).orderBy(asc(schema.typesMembre.ordre), asc(schema.typesMembre.id)),
  ]);
  return { formes, langues, types };
}

export async function getContacts() {
  await live();
  return db.query.contacts.findMany({
    with: { langues: true, types: true, formePolitesse: true },
    orderBy: [asc(schema.contacts.nom), asc(schema.contacts.prenom)],
  });
}

export async function getContact(id: number) {
  await live();
  return db.query.contacts.findFirst({
    where: eq(schema.contacts.id, id),
    with: {
      langues: true,
      types: true,
      formePolitesse: true,
      cotisations: {
        orderBy: [desc(schema.cotisations.annee), desc(schema.cotisations.id)],
      },
      dons: {
        orderBy: [desc(schema.dons.dateDon), desc(schema.dons.annee), desc(schema.dons.id)],
      },
    },
  });
}

export type ContactListe = Awaited<ReturnType<typeof getContacts>>[number];
export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContact>>>;

// ——————————————————— Chiens ———————————————————

export async function getListesChiens() {
  await live();
  const [races, couleurs, pathologies] = await Promise.all([
    db.select().from(schema.races).orderBy(asc(schema.races.ordre), asc(schema.races.libelle)),
    db.select().from(schema.couleurs).orderBy(asc(schema.couleurs.ordre), asc(schema.couleurs.libelle)),
    db.select().from(schema.pathologies).orderBy(asc(schema.pathologies.ordre), asc(schema.pathologies.libelle)),
  ]);
  return { races, couleurs, pathologies };
}

function chiensAvecRemises(where?: SQL) {
  return db.query.chiens.findMany({
    where,
    orderBy: [asc(schema.chiens.nom)],
    with: {
      race: true,
      couleur: true,
      remises: {
        orderBy: [desc(schema.remises.dateRemise), desc(schema.remises.id)],
        with: {
          contact: { columns: { id: true, nom: true, prenom: true, societe: true, codePostal: true, localite: true } },
          moniteur: { columns: { id: true, nom: true, prenom: true } },
          pathologies: { with: { pathologie: true } },
        },
      },
    },
  });
}

export async function getChiens() {
  await live();
  return chiensAvecRemises();
}

export async function getChien(id: number) {
  await live();
  return (await chiensAvecRemises(eq(schema.chiens.id, id)))[0];
}

/** Liste légère des contacts pour choisir un membre. */
export async function getContactsChoix() {
  await live();
  return db
    .select({
      id: schema.contacts.id, nom: schema.contacts.nom, prenom: schema.contacts.prenom, societe: schema.contacts.societe,
      codePostal: schema.contacts.codePostal, localite: schema.contacts.localite, moniteur: schema.contacts.moniteur,
      archive: schema.contacts.archive,
    })
    .from(schema.contacts)
    .orderBy(asc(schema.contacts.nom), asc(schema.contacts.prenom));
}

export async function getChiensChoix() {
  await live();
  return db.select({ id: schema.chiens.id, nom: schema.chiens.nom, puce: schema.chiens.puce }).from(schema.chiens).orderBy(asc(schema.chiens.nom));
}

export async function getRemisesDuContact(contactId: number) {
  await live();
  return db.query.remises.findMany({
    where: eq(schema.remises.contactId, contactId),
    orderBy: [desc(schema.remises.dateRemise)],
    with: { chien: { with: { race: true } }, pathologies: { with: { pathologie: true } } },
  });
}

export type ChienDetail = NonNullable<Awaited<ReturnType<typeof getChien>>>;
export type ContactChoix = Awaited<ReturnType<typeof getContactsChoix>>[number];

/** Nombre d'utilisations de chaque valeur des listes de référence (pour la page Paramètres). */
export async function getUsagesListes() {
  await live();
  const compter = async (requete: SQL) =>
    new Map(((await db.execute(requete)) as unknown as { id: number; n: number }[]).map((r) => [r.id, Number(r.n)]));
  const [formes, langues, types, races, couleurs, pathologies, motifs] = await Promise.all([
    compter(sql`select forme_politesse_id id, count(*) n from contacts where forme_politesse_id is not null group by 1`),
    compter(sql`select langue_id id, count(*) n from contact_langues group by 1`),
    compter(sql`select type_id id, count(*) n from contact_types group by 1`),
    compter(sql`select race_id id, count(*) n from chiens where race_id is not null group by 1`),
    compter(sql`select couleur_id id, count(*) n from chiens where couleur_id is not null group by 1`),
    compter(sql`select pathologie_id id, count(*) n from remise_pathologies group by 1`),
    compter(sql`select motif_id id, count(*) n from suivis where motif_id is not null group by 1`),
  ]);
  return { formes, langues, types, races, couleurs, pathologies, motifs };
}

// ——————————————————— Tableau de bord ———————————————————

type Ligne = Record<string, unknown>;
const lignes = async (q: SQL) => (await db.execute(q)) as unknown as Ligne[];

/** Membres « actifs » attendus pour la cotisation : type dont le libellé est « … actif », fiche non archivée. */
const MEMBRES_ACTIFS = sql`
  select c.* from contacts c
  where not c.archive and exists (
    select 1 from contact_types ct join types_membre t on t.id = ct.type_id
    where ct.contact_id = c.id and t.libelle ~* '(^|\\s)actif')`;

export async function getCotisationsManquantes(annee: number) {
  await live();
  return lignes(sql`
    select m.id, m.nom, m.prenom, m.societe, m.code_postal "codePostal", m.localite, m.email,
      (select max(d.annee) from cotisations d where d.contact_id = m.id and d.montant_centimes > 0) "derniereAnnee"
    from (${MEMBRES_ACTIFS}) m
    where not exists (select 1 from cotisations d where d.contact_id = m.id and d.annee = ${annee} and d.montant_centimes > 0)
    order by m.nom, m.prenom`);
}

export async function getTableauDeBord(annee: number) {
  await live();
  const [membres, parType, finances, manquantes, derniersDons, aCompleter, sansAnnee, suivis] = await Promise.all([
    lignes(sql`select count(*) filter (where not archive) total, count(*) filter (where archive) archives,
      count(*) filter (where not archive and sponsor_fondation) sponsors, count(*) filter (where not archive and moniteur) moniteurs,
      count(*) filter (where not archive and magazine) mag from contacts`),
    lignes(sql`select t.libelle, count(c.id) n from types_membre t left join contact_types ct on ct.type_id = t.id
      left join contacts c on c.id = ct.contact_id and not c.archive group by t.id, t.libelle, t.ordre order by t.ordre`),
    lignes(sql`select annee, sum(coti)::bigint coti, sum(dons)::bigint dons, sum(payeurs)::int payeurs, sum("nbDons")::int "nbDons" from (
        select annee, coalesce(sum(montant_centimes), 0) coti, 0 dons, count(*) filter (where montant_centimes > 0) payeurs, 0 "nbDons"
          from cotisations where annee is not null and annee > ${annee - 8} group by annee
        union all
        select annee, 0, coalesce(sum(montant_centimes), 0), 0, count(*) filter (where montant_centimes > 0)
          from dons where annee is not null and annee > ${annee - 8} group by annee
      ) x group by annee order by annee`),
    lignes(sql`select count(*) filter (where not exists (select 1 from cotisations d where d.contact_id = m.id and d.annee = ${annee} and d.montant_centimes > 0)) manquantes,
      count(*) attendues from (${MEMBRES_ACTIFS}) m`),
    lignes(sql`select d.id, d.contact_id "contactId", d.montant_centimes "don", d.date_don::text "date", c.nom, c.prenom, c.societe
      from dons d join contacts c on c.id = d.contact_id where d.montant_centimes > 0 and d.date_don is not null
      order by d.date_don desc, d.id desc limit 6`),
    lignes(sql`select count(*) n from contacts c where not c.archive and c.email is null and exists (select 1 from remises r where r.contact_id = c.id)`),
    lignes(sql`select (select count(*) from cotisations where annee_deduite) + (select count(*) from dons where annee_deduite) n`),
    lignes(sql`select count(*) filter (where etat = 'ouvert') ouverts, count(*) filter (where etat = 'en_cours') "enCours" from suivis`),
  ]);
  return {
    membres: Object.fromEntries(Object.entries(membres[0]).map(([k, v]) => [k, Number(v)])) as Record<string, number>,
    parType: parType.map((r) => ({ libelle: String(r.libelle), n: Number(r.n) })),
    finances: finances.map((r) => ({ annee: Number(r.annee), coti: Number(r.coti), dons: Number(r.dons), payeurs: Number(r.payeurs), nbDons: Number(r.nbDons) })),
    cotisations: { manquantes: Number(manquantes[0].manquantes), attendues: Number(manquantes[0].attendues) },
    derniersDons: derniersDons as { id: number; contactId: number; don: number; date: string; nom: string | null; prenom: string | null; societe: string | null }[],
    beneficiairesSansEmail: Number(aCompleter[0].n),
    anneesDeduites: Number(sansAnnee[0].n),
    suivis: { ouverts: Number(suivis[0].ouverts), enCours: Number(suivis[0].enCours) },
  };
}

// ——————————————————— Années de cotisation ———————————————————

/** Années de cotisation (campagnes) avec leurs chiffres. */
export async function getAnnees() {
  await live();
  const rows = await lignes(sql`
    select a.annee, a.cotisation_defaut_centimes "defaut", a.remarque,
      count(c.id) "lignes",
      count(c.id) filter (where c.montant_centimes > 0) "payees",
      count(c.id) filter (where c.montant_centimes is null) "aPayer",
      coalesce(sum(c.montant_centimes), 0)::bigint "total",
      count(c.id) filter (where c.annee_deduite) "deduites"
    from annees a left join cotisations c on c.annee = a.annee
    group by a.annee order by a.annee desc`);
  return rows.map((r) => ({
    annee: Number(r.annee), defaut: r.defaut === null ? null : Number(r.defaut), remarque: r.remarque as string | null,
    lignes: Number(r.lignes), payees: Number(r.payees), aPayer: Number(r.aPayer), total: Number(r.total), deduites: Number(r.deduites),
  }));
}
export type AnneeStats = Awaited<ReturnType<typeof getAnnees>>[number];

const colonnesContact = { id: true, nom: true, prenom: true, societe: true, codePostal: true, localite: true, archive: true, email: true } as const;

export async function getCotisationsAnnee(annee: number | null) {
  await live();
  return db.query.cotisations.findMany({
    where: annee === null ? sql`${schema.cotisations.annee} is null` : eq(schema.cotisations.annee, annee),
    with: { contact: { columns: colonnesContact } },
    orderBy: [asc(schema.cotisations.id)],
  });
}

/** Années pour lesquelles il existe des dons, avec leurs chiffres. */
export async function getAnneesDons() {
  await live();
  const rows = await lignes(sql`
    select annee, count(*) "nb", count(distinct contact_id) "donateurs", coalesce(sum(montant_centimes), 0)::bigint "total",
      count(*) filter (where annee_deduite) "deduites"
    from dons group by annee order by annee desc nulls last`);
  return rows.map((r) => ({
    annee: r.annee === null ? null : Number(r.annee), nb: Number(r.nb), donateurs: Number(r.donateurs), total: Number(r.total), deduites: Number(r.deduites),
  }));
}

export async function getDonsAnnee(annee: number | null) {
  await live();
  return db.query.dons.findMany({
    where: annee === null ? sql`${schema.dons.annee} is null` : eq(schema.dons.annee, annee),
    with: { contact: { columns: colonnesContact } },
    orderBy: [desc(schema.dons.dateDon), desc(schema.dons.id)],
  });
}

export async function getAssociation() {
  await live();
  const [a] = await db.select().from(schema.association).where(eq(schema.association.id, 1));
  return a ?? { id: 1, nom: "Association Farah Dogs", adresse: null, npaLocalite: null, email: null, telephone: null,
    iban: null, signataire: null, fonctionSignataire: null, lieuSignature: null, mentionAttestation: null };
}

// ——————————————————— Suivis ———————————————————

export async function getMotifsSuivi() {
  await live();
  return db.select().from(schema.motifsSuivi).orderBy(asc(schema.motifsSuivi.ordre), asc(schema.motifsSuivi.libelle));
}

export async function getSuivis(filtre: { contactId?: number; chienId?: number; etat?: string } = {}) {
  await live();
  const conds: SQL[] = [];
  if (filtre.contactId) conds.push(eq(schema.suivis.contactId, filtre.contactId));
  if (filtre.chienId) conds.push(eq(schema.suivis.chienId, filtre.chienId));
  if (filtre.etat === "actifs") conds.push(sql`${schema.suivis.etat} <> 'ferme'`);
  else if (filtre.etat) conds.push(eq(schema.suivis.etat, filtre.etat));
  return db.query.suivis.findMany({
    where: conds.length ? sql.join(conds, sql` and `) : undefined,
    orderBy: [desc(schema.suivis.date), desc(schema.suivis.id)],
    with: {
      motif: true,
      photos: { columns: { id: true, nomFichier: true } },
      contact: { columns: { id: true, nom: true, prenom: true, societe: true } },
      chien: { columns: { id: true, nom: true } },
    },
  });
}
export type SuiviDetail = Awaited<ReturnType<typeof getSuivis>>[number];
