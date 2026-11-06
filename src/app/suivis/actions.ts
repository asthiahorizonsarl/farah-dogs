"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

const t = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  return v === "" ? null : v;
};
const ETATS = ["ouvert", "en_cours", "ferme"];
const TAILLE_MAX = 8 * 1024 * 1024;

function retour(fd: FormData, msg?: string): never {
  const r = String(fd.get("retour") ?? "/suivis");
  revalidatePath("/suivis");
  revalidatePath("/");
  const cible = r.startsWith("/") ? r : "/suivis";
  redirect(msg ? `${cible}${cible.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(msg)}` : cible);
}

async function ajouterPhotos(suiviId: number, fd: FormData) {
  const fichiers = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of fichiers) {
    if (!f.type.startsWith("image/")) return `« ${f.name} » n'est pas une image.`;
    if (f.size > TAILLE_MAX) return `« ${f.name} » dépasse 8 Mo.`;
  }
  if (fichiers.length) {
    await db.insert(schema.suiviPhotos).values(await Promise.all(fichiers.map(async (f) => ({
      suiviId, nomFichier: f.name, type: f.type, contenu: Buffer.from(await f.arrayBuffer()).toString("base64"),
    }))));
  }
  return null;
}

function champs(fd: FormData) {
  const etat = t(fd, "etat");
  return {
    date: t(fd, "date") ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" }),
    motifId: Number(fd.get("motifId")) || null,
    titre: t(fd, "titre") ?? "Suivi",
    rapport: t(fd, "rapport"),
    etat: etat && ETATS.includes(etat) ? etat : "ouvert",
  };
}

export async function ajouterSuivi(fd: FormData) {
  await exigerUtilisateur();
  const contactId = Number(fd.get("contactId")) || null;
  const chienId = Number(fd.get("chienId")) || null;
  if (!contactId && !chienId) retour(fd, "Choisissez un membre ou un chien.");
  const [{ id }] = await db.insert(schema.suivis).values({ contactId, chienId, ...champs(fd) }).returning({ id: schema.suivis.id });
  const err = await ajouterPhotos(id, fd);
  if (contactId) revalidatePath(`/membres/${contactId}`);
  if (chienId) revalidatePath(`/chiens/${chienId}`);
  retour(fd, err ?? undefined);
}

export async function modifierSuivi(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  await db.update(schema.suivis).set({ ...champs(fd), modifieLe: new Date() }).where(eq(schema.suivis.id, id));
  const aSupprimer = fd.getAll("supprimerPhoto").map(Number).filter(Number.isInteger);
  if (aSupprimer.length) await db.delete(schema.suiviPhotos).where(and(eq(schema.suiviPhotos.suiviId, id), inArray(schema.suiviPhotos.id, aSupprimer)));
  const err = await ajouterPhotos(id, fd);
  retour(fd, err ?? undefined);
}

export async function changerEtat(fd: FormData) {
  await exigerUtilisateur();
  const etat = String(fd.get("etat"));
  if (ETATS.includes(etat)) {
    await db.update(schema.suivis).set({ etat, modifieLe: new Date() }).where(eq(schema.suivis.id, Number(fd.get("id"))));
  }
  retour(fd);
}

export async function supprimerSuivi(fd: FormData) {
  await exigerUtilisateur();
  await db.delete(schema.suivis).where(eq(schema.suivis.id, Number(fd.get("id"))));
  retour(fd);
}
