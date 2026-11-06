"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

const TABLES = {
  formes: { table: schema.formesPolitesse, usage: schema.contacts, col: schema.contacts.formePolitesseId },
  langues: { table: schema.langues, usage: schema.contactLangues, col: schema.contactLangues.langueId },
  types: { table: schema.typesMembre, usage: schema.contactTypes, col: schema.contactTypes.typeId },
  races: { table: schema.races, usage: schema.chiens, col: schema.chiens.raceId },
  couleurs: { table: schema.couleurs, usage: schema.chiens, col: schema.chiens.couleurId },
  pathologies: { table: schema.pathologies, usage: schema.remisePathologies, col: schema.remisePathologies.pathologieId },
  motifs: { table: schema.motifsSuivi, usage: schema.suivis, col: schema.suivis.motifId },
} as const;
type Liste = keyof typeof TABLES;

function liste(fd: FormData): (typeof TABLES)[Liste] {
  const l = String(fd.get("liste")) as Liste;
  if (!(l in TABLES)) throw new Error("Liste inconnue");
  return TABLES[l];
}

function fin(msg?: string) {
  revalidatePath("/", "layout");
  redirect(msg ? `/parametres?erreur=${encodeURIComponent(msg)}` : "/parametres");
}

export async function ajouterElement(fd: FormData) {
  await exigerUtilisateur();
  const { table } = liste(fd);
  const libelle = String(fd.get("libelle") ?? "").trim();
  if (!libelle) fin("Le libellé est vide.");
  const ordre = Number(fd.get("ordre") ?? 0) || 0;
  await db.insert(table).values({ libelle, ordre });
  fin();
}

export async function modifierElement(fd: FormData) {
  await exigerUtilisateur();
  const { table } = liste(fd);
  const libelle = String(fd.get("libelle") ?? "").trim();
  if (!libelle) fin("Le libellé est vide.");
  await db
    .update(table)
    .set({ libelle, ordre: Number(fd.get("ordre") ?? 0) || 0 })
    .where(eq(table.id, Number(fd.get("id"))));
  fin();
}

export async function supprimerElement(fd: FormData) {
  await exigerUtilisateur();
  const { table, usage, col } = liste(fd);
  const id = Number(fd.get("id"));
  const [{ n }] = await db.select({ n: count() }).from(usage).where(eq(col, id));
  if (n > 0) fin(`Impossible de supprimer : utilisé par ${n} fiche(s). Renommez-le plutôt.`);
  await db.delete(table).where(eq(table.id, id));
  fin();
}
