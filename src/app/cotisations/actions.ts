"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";
import { parseMontant } from "@/lib/format";

const t = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const anneeDe = (fd: FormData, k = "annee") => {
  const a = Number(fd.get(k));
  return Number.isInteger(a) && a >= 1990 && a <= 2200 ? a : null;
};
const aujourdhui = async () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

function rafraichir(contactId?: number) {
  revalidatePath("/cotisations");
  revalidatePath("/");
  if (contactId) revalidatePath(`/membres/${contactId}`);
}
function aller(annee: number | null, extra = ""): never {
  rafraichir();
  redirect(`/cotisations?annee=${annee ?? ""}${extra}`);
}
function erreur(annee: number | null, msg: string): never {
  redirect(`/cotisations?annee=${annee ?? ""}&erreur=${encodeURIComponent(msg)}`);
}
/** Retour vers la page d'où vient le formulaire (champ caché « retour »). */
function retour(fd: FormData, defaut: string): never {
  const r = String(fd.get("retour") ?? "");
  redirect(r.startsWith("/") ? r : defaut);
}

/** Une année utilisée sur une cotisation existe aussi dans la liste des années. */
async function assurerAnnee(annee: number | null) {
  if (annee) await db.insert(schema.annees).values({ annee }).onConflictDoNothing();
}

async function membresDesTypes(types: number[], annee: number) {
  return db
    .selectDistinct({ id: schema.contacts.id })
    .from(schema.contacts)
    .innerJoin(schema.contactTypes, eq(schema.contactTypes.contactId, schema.contacts.id))
    .where(and(eq(schema.contacts.archive, false), inArray(schema.contactTypes.typeId, types),
      sql`not exists (select 1 from cotisations c where c.contact_id = ${schema.contacts.id} and c.annee = ${annee})`));
}

// ——— Années ———

/** Crée une année de cotisation et prépare une cotisation « à payer » pour les membres des types choisis. */
export async function creerAnnee(fd: FormData) {
  await exigerUtilisateur();
  const annee = anneeDe(fd);
  if (!annee) erreur(null, "Année invalide.");
  const types = fd.getAll("types").map(Number).filter(Number.isInteger);
  const [existe] = await db.select().from(schema.annees).where(eq(schema.annees.annee, annee));
  if (existe) erreur(annee, `L'année ${annee} existe déjà.`);

  let crees = 0;
  await db.transaction(async (tx) => {
    await tx.insert(schema.annees).values({ annee, cotisationDefautCentimes: parseMontant(fd.get("defaut")), remarque: t(fd, "remarque") });
    if (types.length) {
      const membres = await membresDesTypes(types, annee);
      if (membres.length) await tx.insert(schema.cotisations).values(membres.map((m) => ({ contactId: m.id, annee })));
      crees = membres.length;
    }
  });
  aller(annee, `&ok=${encodeURIComponent(`Année ${annee} créée${crees ? ` avec ${crees} cotisation(s) à payer` : ""}.`)}`);
}

export async function modifierAnnee(fd: FormData) {
  await exigerUtilisateur();
  const annee = anneeDe(fd);
  if (!annee) erreur(null, "Année invalide.");
  await db.update(schema.annees)
    .set({ cotisationDefautCentimes: parseMontant(fd.get("defaut")), remarque: t(fd, "remarque") })
    .where(eq(schema.annees.annee, annee));
  aller(annee, "&ok=Ann%C3%A9e%20enregistr%C3%A9e.");
}

/** Supprime une année seulement si aucune cotisation n'y est payée (les cotisations « à payer » sont retirées). */
export async function supprimerAnnee(fd: FormData) {
  await exigerUtilisateur();
  const annee = anneeDe(fd);
  if (!annee) erreur(null, "Année invalide.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.cotisations)
    .where(and(eq(schema.cotisations.annee, annee), or(sql`${schema.cotisations.montantCentimes} > 0`, sql`${schema.cotisations.datePaiement} is not null`)));
  if (n > 0) erreur(annee, `Impossible : ${n} cotisation(s) sont enregistrées en ${annee}.`);
  await db.transaction(async (tx) => {
    await tx.delete(schema.cotisations).where(eq(schema.cotisations.annee, annee));
    await tx.delete(schema.annees).where(eq(schema.annees.annee, annee));
  });
  rafraichir();
  redirect("/cotisations");
}

export async function preparerCotisations(fd: FormData) {
  await exigerUtilisateur();
  const annee = anneeDe(fd);
  if (!annee) erreur(null, "Année invalide.");
  const types = fd.getAll("types").map(Number).filter(Number.isInteger);
  if (!types.length) erreur(annee, "Choisissez au moins un type de membre.");
  const membres = await membresDesTypes(types, annee);
  if (membres.length) await db.insert(schema.cotisations).values(membres.map((m) => ({ contactId: m.id, annee })));
  aller(annee, `&ok=${encodeURIComponent(`${membres.length} cotisation(s) à payer ajoutée(s).`)}`);
}

// ——— Cotisations ———

/** Saisie d'une cotisation payée. Complète la cotisation « à payer » du membre pour l'année si elle existe. */
export async function saisirCotisation(fd: FormData) {
  await exigerUtilisateur();
  const annee = anneeDe(fd);
  const contactId = Number(fd.get("contactId"));
  const r = String(fd.get("retour") ?? "") || `/cotisations?annee=${annee}`;
  if (!annee) redirect(`${r}${r.includes("?") ? "&" : "?"}erreur=${encodeURIComponent("Année invalide.")}`);
  if (!contactId) erreur(annee, "Choisissez un membre dans la liste proposée.");
  const [a] = await db.select().from(schema.annees).where(eq(schema.annees.annee, annee));
  const montant = parseMontant(fd.get("montant")) ?? a?.cotisationDefautCentimes ?? null;
  const date = t(fd, "date") ?? (montant ? await aujourdhui() : null);
  const remarque = t(fd, "remarque");
  await assurerAnnee(annee);

  const [aPayer] = await db.select().from(schema.cotisations)
    .where(and(eq(schema.cotisations.contactId, contactId), eq(schema.cotisations.annee, annee), isNull(schema.cotisations.montantCentimes), isNull(schema.cotisations.datePaiement)))
    .limit(1);
  if (aPayer) {
    await db.update(schema.cotisations).set({ montantCentimes: montant, datePaiement: date, remarque: remarque ?? aPayer.remarque })
      .where(eq(schema.cotisations.id, aPayer.id));
  } else {
    await db.insert(schema.cotisations).values({ contactId, annee, montantCentimes: montant, datePaiement: date, remarque });
  }
  rafraichir(contactId);
  retour(fd, `/cotisations?annee=${annee}&ok=${encodeURIComponent("Cotisation enregistrée.")}`);
}

/** Marque une cotisation « à payer » comme payée aujourd'hui, au montant par défaut de l'année. */
export async function marquerPayee(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const [c] = await db.select().from(schema.cotisations).where(eq(schema.cotisations.id, id));
  if (!c) return;
  const [a] = c.annee ? await db.select().from(schema.annees).where(eq(schema.annees.annee, c.annee)) : [];
  const montant = parseMontant(fd.get("montant")) ?? a?.cotisationDefautCentimes ?? null;
  if (!montant) erreur(c.annee, "Indiquez le montant (aucun montant par défaut pour l'année).");
  await db.update(schema.cotisations).set({ montantCentimes: montant, datePaiement: t(fd, "date") ?? (await aujourdhui()) })
    .where(and(eq(schema.cotisations.id, id), isNull(schema.cotisations.montantCentimes)));
  rafraichir(c.contactId);
  retour(fd, `/cotisations?annee=${c.annee ?? "sans"}`);
}

export async function modifierCotisation(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const contactId = Number(fd.get("contactId"));
  const annee = anneeDe(fd);
  await assurerAnnee(annee);
  await db.update(schema.cotisations).set({
    annee,
    // Une année saisie à la main n'est plus « déduite ».
    anneeDeduite: fd.get("anneeDeduite") === "1" && fd.get("anneeOrigine") === String(annee ?? ""),
    montantCentimes: parseMontant(fd.get("montant")),
    datePaiement: t(fd, "date"),
    remarque: t(fd, "remarque"),
  }).where(and(eq(schema.cotisations.id, id), eq(schema.cotisations.contactId, contactId)));
  rafraichir(contactId);
  retour(fd, `/membres/${contactId}?onglet=cotisations`);
}

export async function supprimerCotisation(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const contactId = Number(fd.get("contactId"));
  await db.delete(schema.cotisations).where(and(eq(schema.cotisations.id, id), eq(schema.cotisations.contactId, contactId)));
  rafraichir(contactId);
  retour(fd, `/membres/${contactId}?onglet=cotisations`);
}

// ——— Association (attestations) ———

export async function enregistrerAssociation(fd: FormData) {
  await exigerUtilisateur();
  const v = {
    nom: t(fd, "nom") ?? "Association Farah Dogs",
    adresse: t(fd, "adresse"), npaLocalite: t(fd, "npaLocalite"), email: t(fd, "email"), telephone: t(fd, "telephone"),
    iban: t(fd, "iban"), signataire: t(fd, "signataire"), fonctionSignataire: t(fd, "fonctionSignataire"),
    lieuSignature: t(fd, "lieuSignature"), mentionAttestation: t(fd, "mentionAttestation"),
  };
  await db.insert(schema.association).values({ id: 1, ...v }).onConflictDoUpdate({ target: schema.association.id, set: v });
  revalidatePath("/parametres");
  redirect("/parametres?ok=association#association");
}
