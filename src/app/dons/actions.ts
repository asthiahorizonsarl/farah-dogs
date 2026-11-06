"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";
import { parseMontant } from "@/lib/format";

const t = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

function rafraichir(contactId: number) {
  revalidatePath("/dons");
  revalidatePath("/");
  revalidatePath(`/membres/${contactId}`);
}
function retour(fd: FormData, defaut: string): never {
  const r = String(fd.get("retour") ?? "");
  redirect(r.startsWith("/") ? r : defaut);
}
function erreur(fd: FormData, msg: string): never {
  const r = String(fd.get("retour") ?? "") || "/dons";
  redirect(`${r}${r.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(msg)}`);
}

function champs(fd: FormData) {
  const date = t(fd, "date");
  const anneeSaisie = Number(fd.get("annee"));
  // L'année du don est celle de sa date, sauf si elle est saisie explicitement.
  const annee = Number.isInteger(anneeSaisie) && anneeSaisie > 1990 ? anneeSaisie : date ? Number(date.slice(0, 4)) : null;
  return { annee, montantCentimes: parseMontant(fd.get("montant")), dateDon: date, remarque: t(fd, "remarque") };
}

export async function ajouterDon(fd: FormData) {
  await exigerUtilisateur();
  const contactId = Number(fd.get("contactId"));
  if (!contactId) erreur(fd, "Choisissez un membre dans la liste proposée.");
  const v = champs(fd);
  if (!v.montantCentimes) erreur(fd, "Indiquez le montant du don.");
  if (!v.dateDon) { v.dateDon = aujourdhui(); v.annee ??= Number(v.dateDon.slice(0, 4)); }
  await db.insert(schema.dons).values({ contactId, ...v });
  rafraichir(contactId);
  retour(fd, `/dons?annee=${v.annee}&ok=${encodeURIComponent("Don enregistré.")}`);
}

export async function modifierDon(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const contactId = Number(fd.get("contactId"));
  const v = champs(fd);
  await db.update(schema.dons)
    .set({ ...v, anneeDeduite: fd.get("anneeDeduite") === "1" && fd.get("anneeOrigine") === String(v.annee ?? "") })
    .where(and(eq(schema.dons.id, id), eq(schema.dons.contactId, contactId)));
  rafraichir(contactId);
  retour(fd, `/membres/${contactId}?onglet=dons`);
}

export async function supprimerDon(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const contactId = Number(fd.get("contactId"));
  await db.delete(schema.dons).where(and(eq(schema.dons.id, id), eq(schema.dons.contactId, contactId)));
  rafraichir(contactId);
  retour(fd, `/membres/${contactId}?onglet=dons`);
}
