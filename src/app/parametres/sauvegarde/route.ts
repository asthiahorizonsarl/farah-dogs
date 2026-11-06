import { connection } from "next/server";
import { getTableName, isTable, sql, type Table } from "drizzle-orm";
import PizZip from "pizzip";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";

/** Tables non sauvegardées : sessions de connexion (temporaires). */
const EXCLUES = new Set(["sessions"]);

const extension = (type: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" })[type] ?? "bin";
const propre = (s: string) => s.normalize("NFD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");

/**
 * Sauvegarde complète en ZIP :
 * - donnees/<table>.json : toutes les lignes de chaque table (noms de colonnes de la base) ;
 * - fichiers/modeles-word/ et fichiers/photos-suivis/ : les fichiers déposés, prêts à ouvrir ;
 * - sauvegarde.json : date, version du schéma et nombre de lignes par table.
 * Le mot de passe SMTP n'est pas inclus.
 */
export async function GET() {
  await connection();
  const moi = await exigerUtilisateur();
  const zip = new PizZip();
  const tables = (Object.values(schema) as unknown[]).filter((t): t is Table => isTable(t)).map((t) => getTableName(t)).filter((n) => !EXCLUES.has(n)).sort();

  const comptes: Record<string, number> = {};
  for (const nom of tables) {
    const lignes = (await db.execute(sql`select * from ${sql.identifier(nom)} order by 1`)) as unknown as Record<string, unknown>[];
    if (nom === "parametres_envoi") for (const l of lignes) if (l.smtp_mot_de_passe) l.smtp_mot_de_passe = "(non sauvegardé)";
    comptes[nom] = lignes.length;
    zip.file(`donnees/${nom}.json`, JSON.stringify(lignes, null, 2));

    if (nom === "modeles_word") {
      for (const m of lignes) zip.file(`fichiers/modeles-word/${m.id}-${propre(String(m.nom_fichier))}`, Buffer.from(String(m.fichier), "base64"));
    }
    if (nom === "suivi_photos") {
      for (const p of lignes) {
        const base = propre(String(p.nom_fichier)).replace(/\.[^.]+$/, "");
        zip.file(`fichiers/photos-suivis/suivi-${p.suivi_id}/${p.id}-${base}.${extension(String(p.type))}`, Buffer.from(String(p.contenu), "base64"));
      }
    }
  }

  const migrations = (await db.execute(sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`)) as unknown as { hash: string; created_at: string }[];
  const date = new Date();
  zip.file("sauvegarde.json", JSON.stringify({
    application: "Farah Dogs — gestion",
    date: date.toISOString(),
    faitePar: moi.identifiant,
    versionSchema: migrations.length,
    migrations,
    tables: comptes,
    remarques: [
      "Les sessions de connexion et le mot de passe SMTP ne sont pas sauvegardés.",
      "Les montants sont en centimes (ex. 5000 = 50.00 CHF).",
      "cotisations_dons est l'archive fidèle de la table Access « cotisation-dons ».",
    ],
  }, null, 2));

  const stamp = date.toLocaleString("sv-SE", { timeZone: "Europe/Zurich" }).replace(/[: ]/g, "-");
  return new Response(new Blob([new Uint8Array(zip.generate({ type: "uint8array", compression: "DEFLATE" }))]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="sauvegarde-farahdogs-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
