"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

function texte(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  return v === "" ? null : v;
}
const coche = (fd: FormData, k: string) => fd.get(k) === "on";
const ids = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter(Number.isInteger);

function champsContact(fd: FormData) {
  const forme = texte(fd, "formePolitesseId");
  return {
    formePolitesseId: forme ? Number(forme) : null,
    nom: texte(fd, "nom"),
    prenom: texte(fd, "prenom"),
    societe: texte(fd, "societe"),
    fonction: texte(fd, "fonction"),
    email: texte(fd, "email"),
    pageWeb: texte(fd, "pageWeb"),
    telProfessionnel: texte(fd, "telProfessionnel"),
    telPersonnel: texte(fd, "telPersonnel"),
    telMobile: texte(fd, "telMobile"),
    fax: texte(fd, "fax"),
    adresse: texte(fd, "adresse"),
    codePostal: texte(fd, "codePostal"),
    localite: texte(fd, "localite"),
    canton: texte(fd, "canton"),
    pays: texte(fd, "pays"),
    sponsorFondation: coche(fd, "sponsorFondation"),
    moniteur: coche(fd, "moniteur"),
    magazine: coche(fd, "magazine"),
    remarques: texte(fd, "remarques"),
  };
}

export async function enregistrerContact(fd: FormData) {
  await exigerUtilisateur();
  const idBrut = fd.get("id");
  const intent = fd.get("intent");
  const data = champsContact(fd);
  const langues = ids(fd, "langues");
  const types = ids(fd, "types");

  const id = await db.transaction(async (tx) => {
    let id: number;
    if (idBrut) {
      id = Number(idBrut);
      await tx.update(schema.contacts).set({ ...data, modifieLe: new Date() }).where(eq(schema.contacts.id, id));
    } else {
      [{ id }] = await tx.insert(schema.contacts).values(data).returning({ id: schema.contacts.id });
    }
    await tx.delete(schema.contactLangues).where(eq(schema.contactLangues.contactId, id));
    if (langues.length) await tx.insert(schema.contactLangues).values(langues.map((langueId) => ({ contactId: id, langueId })));
    await tx.delete(schema.contactTypes).where(eq(schema.contactTypes.contactId, id));
    if (types.length) await tx.insert(schema.contactTypes).values(types.map((typeId) => ({ contactId: id, typeId })));
    return id;
  });

  revalidatePath("/membres");
  if (intent === "nouveau") redirect("/membres/nouveau?ok=1");
  redirect(`/membres/${id}?ok=1`);
}

export async function archiverContact(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const archive = fd.get("archive") === "1";
  await db
    .update(schema.contacts)
    .set({ archive, dateArchivage: archive ? new Date() : null, modifieLe: new Date() })
    .where(eq(schema.contacts.id, id));
  revalidatePath("/membres");
  redirect(`/membres/${id}`);
}

export async function supprimerContact(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const [[{ nc }], [{ nd }], [{ na }]] = await Promise.all([
    db.select({ nc: count() }).from(schema.cotisations).where(eq(schema.cotisations.contactId, id)),
    db.select({ nd: count() }).from(schema.dons).where(eq(schema.dons.contactId, id)),
    db.select({ na: count() }).from(schema.cotisationsDons).where(eq(schema.cotisationsDons.contactId, id)),
  ]);
  if (nc + nd + na > 0) {
    redirect(`/membres/${id}?erreur=${encodeURIComponent(
      `Ce membre a ${nc} cotisation(s) et ${nd} don(s) enregistré(s). Archivez-le plutôt.`,
    )}`);
  }
  const [{ r }] = await db.select({ r: count() }).from(schema.remises).where(eq(schema.remises.contactId, id));
  if (r > 0) {
    redirect(`/membres/${id}?erreur=${encodeURIComponent(
      `Ce membre est lié à ${r} remise(s) de chien. Archivez-le plutôt, ou supprimez d'abord ces remises.`,
    )}`);
  }
  await db.update(schema.remises).set({ moniteurId: null }).where(eq(schema.remises.moniteurId, id));
  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  revalidatePath("/membres");
  redirect("/membres?supprime=1");
}
