import { connection } from "next/server";
import PizZip from "pizzip";
import { exigerUtilisateur } from "@/lib/auth";
import { documentPour, estTypeDoc, getDestinataires, journaliserCourrier } from "@/lib/envois";

/**
 * Courriers d'un type pour une année, dans un ZIP.
 * Par défaut : personnes sans e-mail qui n'ont encore rien reçu. `?tous=1` : toutes les personnes concernées.
 */
export async function GET(req: Request, ctx: RouteContext<"/envois/courriers/[type]/[annee]">) {
  await connection();
  await exigerUtilisateur();
  const p = await ctx.params;
  if (!estTypeDoc(p.type)) return new Response("Type inconnu", { status: 400 });
  const type = p.type;
  const annee = Number(p.annee);
  const tous = new URL(req.url).searchParams.get("tous") === "1";
  const liste = (await getDestinataires(type === "don" || type === "don_grand" ? "dons" : type, annee))
    .filter((d) => d.type === type && (tous || (!d.email && !d.dejaFait)));
  if (!liste.length) return new Response("Aucun courrier à générer.", { status: 404 });
  const zip = new PizZip();
  for (const d of liste) {
    const doc = await documentPour(d);
    if (!doc) return new Response("Aucun modèle Word déposé pour ce document (Paramètres › Modèles).", { status: 404 });
    zip.file(doc.nom, doc.contenu);
    await journaliserCourrier(d, doc.modeleId);
  }
  return new Response(new Blob([new Uint8Array(zip.generate({ type: "uint8array", compression: "DEFLATE" }))]), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="courriers-${type}-${annee}.zip"` },
  });
}
