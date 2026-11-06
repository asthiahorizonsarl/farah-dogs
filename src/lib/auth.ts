import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, fermerSessionBrute, ouvrirSessionBrute, utilisateurDuJeton } from "./session";

export { hacher, verifierMotDePasse } from "./session";

/** Ouvre une session et pose le cookie. */
export async function ouvrirSession(utilisateurId: number) {
  const { jeton, expireLe } = await ouvrirSessionBrute(utilisateurId);
  (await cookies()).set(COOKIE, jeton, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expireLe,
  });
}

export async function fermerSession() {
  const c = await cookies();
  await fermerSessionBrute(c.get(COOKIE)?.value);
  c.delete(COOKIE);
}

/** Utilisateur connecté, ou redirection vers la page de connexion. À appeler dans chaque action. */
export async function exigerUtilisateur() {
  const u = await utilisateurDuJeton((await cookies()).get(COOKIE)?.value);
  if (!u) redirect("/connexion");
  return u;
}
