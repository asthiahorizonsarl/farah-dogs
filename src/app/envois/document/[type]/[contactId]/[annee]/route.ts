import { connection } from "next/server";
import { exigerUtilisateur } from "@/lib/auth";
import { documentPour, estTypeDoc, getDestinataire, journaliserCourrier } from "@/lib/envois";

/** Document d'une personne (modèle Word rempli, ou PDF intégré) à imprimer pour un envoi par courrier. */
export async function GET(_req: Request, ctx: RouteContext<"/envois/document/[type]/[contactId]/[annee]">) {
  await connection();
  await exigerUtilisateur();
  const p = await ctx.params;
  if (!estTypeDoc(p.type)) return new Response("Type inconnu", { status: 400 });
  const d = await getDestinataire(p.type, Number(p.contactId), Number(p.annee));
  if (!d) return new Response("Cette personne n'est pas concernée par ce document cette année.", { status: 404 });
  const doc = await documentPour(d);
  if (!doc) return new Response("Aucun modèle Word déposé pour ce document (Paramètres › Modèles).", { status: 404 });
  await journaliserCourrier(d, doc.modeleId);
  return new Response(new Uint8Array(doc.contenu), {
    headers: { "Content-Type": doc.type, "Content-Disposition": `attachment; filename="${doc.nom}"` },
  });
}
