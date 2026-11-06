"use server";

import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fermerSession, hacher, ouvrirSession, verifierMotDePasse } from "@/lib/auth";

function vers(suite: string) {
  return suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";
}

export async function connecter(fd: FormData) {
  const identifiant = String(fd.get("identifiant") ?? "").trim().toLowerCase();
  const motDePasse = String(fd.get("motDePasse") ?? "");
  const suite = vers(String(fd.get("suite") ?? "/"));
  const echec = (): never => redirect(`/connexion?erreur=1${suite !== "/" ? `&suite=${encodeURIComponent(suite)}` : ""}`);
  if (!identifiant || !motDePasse) echec();

  // Premier démarrage : le super administrateur est créé à partir des variables d'environnement.
  const [{ n }] = await db.select({ n: count() }).from(schema.utilisateurs);
  if (n === 0) {
    const envId = process.env.ADMIN_IDENTIFIANT?.trim().toLowerCase();
    const envMdp = process.env.ADMIN_MOT_DE_PASSE;
    if (!envId || !envMdp || identifiant !== envId || motDePasse !== envMdp) return echec();
    await db.insert(schema.utilisateurs).values({ identifiant: envId, nom: "Super administrateur", motDePasseHash: await hacher(envMdp), role: "superadmin" });
  }

  const [u] = await db.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.identifiant, identifiant));
  if (!u || !u.actif || !(await verifierMotDePasse(motDePasse, u.motDePasseHash))) echec();
  await ouvrirSession(u.id);
  redirect(suite);
}

export async function deconnecter() {
  await fermerSession();
  redirect("/connexion");
}
