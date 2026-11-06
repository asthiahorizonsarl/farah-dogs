import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";

export async function GET(_req: Request, ctx: RouteContext<"/suivis/photo/[id]">) {
  await connection();
  const [p] = await db.select().from(schema.suiviPhotos).where(eq(schema.suiviPhotos.id, Number((await ctx.params).id)));
  if (!p) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(p.contenu, "base64")), {
    headers: { "Content-Type": p.type, "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="${p.nomFichier.replace(/"/g, "")}"` },
  });
}
