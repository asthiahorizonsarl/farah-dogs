import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";

/** Télécharge un modèle Word déposé (pour le modifier puis le redéposer). */
export async function GET(_req: Request, ctx: RouteContext<"/parametres/modeles-word/[id]">) {
  await connection();
  const [m] = await db.select().from(schema.modelesWord).where(eq(schema.modelesWord.id, Number((await ctx.params).id)));
  if (!m) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m.fichier, "base64")), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${m.nomFichier.replace(/"/g, "")}"`,
    },
  });
}
