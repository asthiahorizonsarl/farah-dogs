"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";
import { parseMontant } from "@/lib/format";
import { estTypeDoc, expliquerErreurSmtp, transporteur, verifierModeleWord } from "@/lib/envois";

const t = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
function fin(ancre: string, msg?: { ok?: string; erreur?: string }): never {
  revalidatePath("/parametres");
  // Le message est affiché dans la section concernée (« section »), pas seulement en haut de page.
  const q = msg?.ok ? `?ok=${encodeURIComponent(msg.ok)}` : msg?.erreur ? `?erreur=${encodeURIComponent(msg.erreur)}` : "";
  redirect(`/parametres${q}${q ? "&" : "?"}section=${ancre}#${ancre}`);
}

export async function enregistrerEnvoi(fd: FormData) {
  await exigerUtilisateur();
  const seuil = parseMontant(fd.get("seuil"));
  if (seuil === null || seuil < 0) fin("envois", { erreur: "Seuil invalide." });
  const port = Number(fd.get("smtpPort"));
  const v: Partial<typeof schema.parametresEnvoi.$inferInsert> = {
    seuilCentimes: seuil,
    smtpHote: t(fd, "smtpHote"),
    smtpPort: Number.isInteger(port) && port > 0 ? port : null,
    smtpSecurite: t(fd, "smtpSecurite") ?? "starttls",
    smtpUtilisateur: t(fd, "smtpUtilisateur"),
    expediteurNom: t(fd, "expediteurNom"),
    expediteurEmail: t(fd, "expediteurEmail"),
    copieCachee: t(fd, "copieCachee"),
  };
  // Le mot de passe n'est remplacé que s'il est saisi (il n'est jamais réaffiché).
  const mdp = String(fd.get("smtpMotDePasse") ?? "");
  if (mdp) v.smtpMotDePasse = mdp;
  if (fd.get("effacerMotDePasse") === "on") v.smtpMotDePasse = null;
  await db.insert(schema.parametresEnvoi).values({ id: 1, ...v }).onConflictDoUpdate({ target: schema.parametresEnvoi.id, set: v });
  fin("envois", { ok: "Réglages d'envoi enregistrés." });
}

export async function testerSmtp(fd: FormData) {
  await exigerUtilisateur();
  const a = t(fd, "adresseTest");
  if (!a) fin("envois", { erreur: "Indiquez une adresse pour le test." });
  try {
    const { p, t: tr } = await transporteur();
    await tr.verify();
    await tr.sendMail({
      from: p.expediteurNom ? `"${p.expediteurNom}" <${p.expediteurEmail}>` : p.expediteurEmail!,
      to: a, subject: "Test d'envoi – Farah Dogs", text: "Le serveur SMTP est correctement configuré.",
    });
  } catch (e) {
    fin("envois", { erreur: `Échec du test SMTP : ${await expliquerErreurSmtp(e, "test")}` });
  }
  fin("envois", { ok: `E-mail de test envoyé à ${a}.` });
}

export async function enregistrerEmailType(fd: FormData) {
  await exigerUtilisateur();
  const type = fd.get("type");
  if (!estTypeDoc(type)) fin("modeles", { erreur: "Type inconnu." });
  const objet = t(fd, "objet");
  const contenu = String(fd.get("contenu") ?? "").replace(/\r\n/g, "\n").trim();
  if (!objet || !contenu) fin("modeles", { erreur: "L'objet et le contenu de l'e-mail sont obligatoires." });
  await db.insert(schema.emailsTypes).values({ type, objet, contenu })
    .onConflictDoUpdate({ target: schema.emailsTypes.type, set: { objet, contenu } });
  fin("modeles", { ok: "E-mail enregistré." });
}

/** Un seul modèle par type : lier un modèle retire la liaison des autres modèles du même type. */
async function lier(id: number, type: string | null) {
  if (type) {
    await db.update(schema.modelesWord).set({ categorie: null })
      .where(and(eq(schema.modelesWord.categorie, type), ne(schema.modelesWord.id, id)));
  }
  await db.update(schema.modelesWord).set({ categorie: type }).where(eq(schema.modelesWord.id, id));
}

export async function deposerModeleWord(fd: FormData) {
  await exigerUtilisateur();
  const f = fd.get("fichier");
  if (!(f instanceof File) || !f.size) fin("modeles", { erreur: "Choisissez un fichier Word (.docx)." });
  if (!/\.docx$/i.test(f.name)) fin("modeles", { erreur: "Seuls les fichiers .docx sont acceptés (pas .doc)." });
  const contenu = Buffer.from(await f.arrayBuffer());
  let balises: string[];
  try {
    balises = verifierModeleWord(contenu);
  } catch (e) {
    fin("modeles", { erreur: `Modèle invalide (vérifiez les {{ }}) : ${e instanceof Error ? e.message : String(e)}` });
  }
  const [{ id }] = await db.insert(schema.modelesWord).values({
    nom: t(fd, "nom") ?? f.name.replace(/\.docx$/i, ""), nomFichier: f.name, fichier: contenu.toString("base64"),
  }).returning({ id: schema.modelesWord.id });
  const type = t(fd, "type");
  await lier(id, type && estTypeDoc(type) ? type : null);
  fin("modeles", { ok: `Modèle déposé (${balises.length} variable(s) trouvée(s) : ${balises.join(", ") || "aucune"}).` });
}

export async function lierModeleWord(fd: FormData) {
  await exigerUtilisateur();
  const type = t(fd, "type");
  await lier(Number(fd.get("id")), type && estTypeDoc(type) ? type : null);
  fin("modeles", { ok: "Liaison enregistrée." });
}

export async function supprimerModeleWord(fd: FormData) {
  await exigerUtilisateur();
  await db.delete(schema.modelesWord).where(eq(schema.modelesWord.id, Number(fd.get("id"))));
  fin("modeles", { ok: "Modèle supprimé." });
}
