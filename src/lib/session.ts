// Sessions et mots de passe (utilisable aussi depuis proxy.ts et les scripts).
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";

const scryptAsync = promisify(scrypt) as (pwd: string, salt: Buffer, len: number) => Promise<Buffer>;
export const COOKIE = "fd_session";
const DUREE_MS = 30 * 24 * 3600 * 1000;

export async function hacher(motDePasse: string) {
  const sel = randomBytes(16);
  const h = await scryptAsync(motDePasse, sel, 64);
  return ["scrypt", sel.toString("base64"), h.toString("base64")].join(":");
}

export async function verifierMotDePasse(motDePasse: string, empreinte: string) {
  const [algo, sel, h] = empreinte.split(":");
  if (algo !== "scrypt" || !sel || !h) return false;
  const attendu = Buffer.from(h, "base64");
  const calcule = await scryptAsync(motDePasse, Buffer.from(sel, "base64"), attendu.length);
  return attendu.length === calcule.length && timingSafeEqual(attendu, calcule);
}

const empreinteJeton = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

/** Utilisateur correspondant à un jeton de session valide. */
export async function utilisateurDuJeton(jeton: string | undefined) {
  if (!jeton) return null;
  const [r] = await db
    .select({ id: schema.utilisateurs.id, identifiant: schema.utilisateurs.identifiant, nom: schema.utilisateurs.nom, role: schema.utilisateurs.role })
    .from(schema.sessions)
    .innerJoin(schema.utilisateurs, eq(schema.utilisateurs.id, schema.sessions.utilisateurId))
    .where(and(eq(schema.sessions.id, empreinteJeton(jeton)), gt(schema.sessions.expireLe, new Date()), eq(schema.utilisateurs.actif, true)));
  return r ?? null;
}

export async function ouvrirSessionBrute(utilisateurId: number) {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_MS);
  await db.insert(schema.sessions).values({ id: empreinteJeton(jeton), utilisateurId, expireLe });
  await db.update(schema.utilisateurs).set({ derniereConnexion: new Date() }).where(eq(schema.utilisateurs.id, utilisateurId));
  return { jeton, expireLe };
}

export async function fermerSessionBrute(jeton: string | undefined) {
  if (jeton) await db.delete(schema.sessions).where(eq(schema.sessions.id, empreinteJeton(jeton)));
}
