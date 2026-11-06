"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

function texte(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  return v === "" ? null : v;
}
const entier = (fd: FormData, k: string) => {
  const v = texte(fd, k);
  return v && Number.isInteger(Number(v)) ? Number(v) : null;
};

function erreur(url: string, msg: string): never {
  redirect(`${url}${url.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(msg)}`);
}

export async function enregistrerChien(fd: FormData) {
  await exigerUtilisateur();
  const id = entier(fd, "id");
  const puce = texte(fd, "puce")?.replace(/\D/g, "") || null;
  const nom = texte(fd, "nom");
  const ici = id ? `/chiens/${id}` : "/chiens/nouveau";
  if (!nom) erreur(ici, "Le nom du chien est obligatoire.");
  if (puce && puce.length !== 15) erreur(ici, `Le numéro de puce doit avoir 15 chiffres (${puce.length} saisis).`);
  if (puce) {
    const [doublon] = await db
      .select({ id: schema.chiens.id, nom: schema.chiens.nom })
      .from(schema.chiens)
      .where(id ? and(eq(schema.chiens.puce, puce), ne(schema.chiens.id, id)) : eq(schema.chiens.puce, puce));
    if (doublon) erreur(ici, `Ce numéro de puce est déjà celui de ${doublon.nom} (fiche n° ${doublon.id}).`);
  }
  const decede = fd.get("decede") === "on";
  const reforme = fd.get("reforme") === "on";
  const data = {
    nom: nom!,
    raceId: entier(fd, "raceId"),
    couleurId: entier(fd, "couleurId"),
    sexe: texte(fd, "sexe"),
    dateNaissance: texte(fd, "dateNaissance"),
    puce,
    reforme,
    dateReforme: reforme ? texte(fd, "dateReforme") : null,
    decede,
    dateDeces: decede ? texte(fd, "dateDeces") : null,
    remarques: texte(fd, "remarques"),
  };
  let chienId = id;
  if (id) {
    await db.update(schema.chiens).set({ ...data, modifieLe: new Date() }).where(eq(schema.chiens.id, id));
  } else {
    [{ id: chienId }] = await db.insert(schema.chiens).values(data).returning({ id: schema.chiens.id });
  }
  revalidatePath("/chiens");
  if (fd.get("intent") === "nouveau") redirect("/chiens/nouveau?ok=1");
  redirect(`/chiens/${chienId}?ok=1`);
}

export async function supprimerChien(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  await db.delete(schema.chiens).where(eq(schema.chiens.id, id)); // ses remises sont supprimées avec lui
  revalidatePath("/chiens");
  redirect("/chiens?supprime=1");
}

// ——— Remises (chien ↔ membre) ———

function champsRemise(fd: FormData) {
  const motifFin = texte(fd, "motifFin");
  return {
    chienId: Number(fd.get("chienId")),
    contactId: Number(fd.get("contactId")),
    beneficiaireNom: texte(fd, "beneficiaireNom"),
    beneficiairePrenom: texte(fd, "beneficiairePrenom"),
    type: texte(fd, "type") ?? "remise",
    dateRemise: texte(fd, "dateRemise"),
    dateFin: texte(fd, "dateFin"),
    motifFin,
    actif: fd.get("actif") === "on",
    moniteurId: entier(fd, "moniteurId"),
    remarques: texte(fd, "remarques"),
  };
}

function retour(fd: FormData, d: { chienId: number; contactId: number }) {
  revalidatePath(`/chiens/${d.chienId}`);
  revalidatePath(`/membres/${d.contactId}`);
  revalidatePath("/chiens");
  revalidatePath("/membres");
  const r = String(fd.get("retour") ?? "");
  redirect(r.startsWith("/") ? r : `/chiens/${d.chienId}?onglet=remises`);
}

async function enregistrerPathologies(remiseId: number, fd: FormData) {
  const ids = fd.getAll("pathologies").map(Number).filter(Number.isInteger);
  await db.delete(schema.remisePathologies).where(eq(schema.remisePathologies.remiseId, remiseId));
  if (ids.length) await db.insert(schema.remisePathologies).values(ids.map((pathologieId) => ({ remiseId, pathologieId })));
}

export async function ajouterRemise(fd: FormData) {
  await exigerUtilisateur();
  const d = champsRemise(fd);
  const r = String(fd.get("retour") ?? `/chiens/${d.chienId}`);
  if (!d.chienId) erreur(r, "Choisissez un chien.");
  if (!d.contactId) erreur(r, "Choisissez un membre dans la liste proposée.");
  const [{ id }] = await db.insert(schema.remises).values(d).returning({ id: schema.remises.id });
  await enregistrerPathologies(id, fd);
  retour(fd, d);
}

export async function modifierRemise(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const d = champsRemise(fd);
  if (!d.contactId) erreur(`/chiens/${d.chienId}`, "Choisissez un membre dans la liste proposée.");
  await db.update(schema.remises).set(d).where(eq(schema.remises.id, id));
  await enregistrerPathologies(id, fd);
  retour(fd, d);
}

export async function supprimerRemise(fd: FormData) {
  await exigerUtilisateur();
  const id = Number(fd.get("id"));
  const [d] = await db.delete(schema.remises).where(eq(schema.remises.id, id))
    .returning({ chienId: schema.remises.chienId, contactId: schema.remises.contactId });
  if (d) retour(fd, d);
}
