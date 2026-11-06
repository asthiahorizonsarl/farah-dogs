"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth";
import { envoyerParMail, estTypeDoc, getDestinataire, getDestinataires, transporteur, TYPES_DOC } from "@/lib/envois";

function aller(fd: FormData, cle: "ok" | "erreur", msg: string, extra = ""): never {
  const r = String(fd.get("retour") ?? "/");
  const cible = r.startsWith("/") ? r : "/";
  revalidatePath("/cotisations");
  revalidatePath("/dons");
  redirect(`${cible}${cible.includes("?") ? "&" : "?"}${cle}=${encodeURIComponent(msg)}${extra}`);
}

/** Envoie le document d'un type à une personne (bouton sur sa ligne). */
export async function envoyerUn(fd: FormData) {
  await exigerUtilisateur();
  const type = fd.get("type");
  const annee = Number(fd.get("annee"));
  if (!estTypeDoc(type)) aller(fd, "erreur", "Type de document inconnu.");
  const d = await getDestinataire(type, Number(fd.get("contactId")), annee);
  if (!d) aller(fd, "erreur", "Cette personne n'est pas concernée par ce document cette année.");
  const r = await envoyerParMail(d);
  if (r.ok) aller(fd, "ok", `${TYPES_DOC[d.type].titre} envoyée à ${d.email}.`);
  aller(fd, "erreur", r.erreur, d.email ? "" : "&sansmail=1");
}

/** Envoie le document d'un type à toutes les personnes concernées qui ont un e-mail et ne l'ont pas encore reçu. */
export async function envoyerTous(fd: FormData) {
  await exigerUtilisateur();
  const type = fd.get("type");
  const annee = Number(fd.get("annee"));
  if (!estTypeDoc(type)) aller(fd, "erreur", "Type de document inconnu.");
  const tous = await getDestinataires(type === "don" || type === "don_grand" ? "dons" : type, annee);
  const liste = tous.filter((d) => d.type === type && !d.dejaFait);
  const aEnvoyer = liste.filter((d) => d.email);
  const sansEmail = liste.length - aEnvoyer.length;
  let tr;
  try {
    tr = await transporteur();
  } catch (e) {
    aller(fd, "erreur", e instanceof Error ? e.message : String(e));
  }
  let ok = 0;
  const erreurs: string[] = [];
  for (const d of aEnvoyer) {
    const r = await envoyerParMail(d, tr);
    if (r.ok) ok++;
    else erreurs.push(`${d.contact.nom ?? d.contact.societe} : ${r.erreur}`);
  }
  const msg = `${TYPES_DOC[type].titre} : ${ok} e-mail(s) envoyé(s).` + (erreurs.length ? ` ${erreurs.length} erreur(s) : ${erreurs.slice(0, 3).join(" ; ")}` : "");
  aller(fd, erreurs.length ? "erreur" : "ok", msg, sansEmail ? `&sansmail=${sansEmail}` : "");
}
