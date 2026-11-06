"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur, hacher, verifierMotDePasse } from "@/lib/auth";

function fin(msg: { ok?: string; erreur?: string }): never {
  revalidatePath("/parametres");
  const q = msg.ok ? `ok=${encodeURIComponent(msg.ok)}` : `erreur=${encodeURIComponent(msg.erreur ?? "")}`;
  redirect(`/parametres?${q}#compte`);
}

export async function modifierCompte(fd: FormData) {
  const moi = await exigerUtilisateur();
  const identifiant = String(fd.get("identifiant") ?? "").trim().toLowerCase();
  if (identifiant.length < 3) fin({ erreur: "L'identifiant doit avoir au moins 3 caractères." });
  const [pris] = await db.select({ id: schema.utilisateurs.id }).from(schema.utilisateurs)
    .where(and(eq(schema.utilisateurs.identifiant, identifiant), ne(schema.utilisateurs.id, moi.id)));
  if (pris) fin({ erreur: "Cet identifiant est déjà utilisé." });
  await db.update(schema.utilisateurs).set({ identifiant, nom: String(fd.get("nom") ?? "").trim() || null })
    .where(eq(schema.utilisateurs.id, moi.id));
  fin({ ok: "Compte enregistré." });
}

export async function changerMotDePasse(fd: FormData) {
  const moi = await exigerUtilisateur();
  const actuel = String(fd.get("actuel") ?? "");
  const nouveau = String(fd.get("nouveau") ?? "");
  const confirmation = String(fd.get("confirmation") ?? "");
  const [u] = await db.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.id, moi.id));
  if (!u || !(await verifierMotDePasse(actuel, u.motDePasseHash))) fin({ erreur: "Le mot de passe actuel est incorrect." });
  if (nouveau.length < 10) fin({ erreur: "Le nouveau mot de passe doit avoir au moins 10 caractères." });
  if (nouveau !== confirmation) fin({ erreur: "Les deux nouveaux mots de passe ne sont pas identiques." });
  await db.update(schema.utilisateurs).set({ motDePasseHash: await hacher(nouveau) }).where(eq(schema.utilisateurs.id, moi.id));
  // Les autres sessions ouvertes avec l'ancien mot de passe sont fermées.
  await db.delete(schema.sessions).where(and(eq(schema.sessions.utilisateurId, moi.id)));
  redirect("/connexion?ok=1");
}
