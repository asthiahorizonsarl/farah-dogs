import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

/** Photo d'un chien (réservée aux utilisateurs connectés). */
export async function GET(_req: Request, ctx: RouteContext<"/chiens/photo/[id]">) {
  await connection();
  await exigerUtilisateur();
  const [c] = await db.select({ photo: schema.chiens.photo, type: schema.chiens.photoType })
    .from(schema.chiens).where(eq(schema.chiens.id, Number((await ctx.params).id)));
  if (!c?.photo || !c.type || !["image/jpeg", "image/png", "image/webp"].includes(c.type)) return new Response("Pas de photo", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(c.photo, "base64")), {
    headers: { "Content-Type": c.type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
