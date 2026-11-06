/**
 * Crée le super administrateur, ou réinitialise son mot de passe s'il existe.
 *
 *   ADMIN_IDENTIFIANT=admin ADMIN_MOT_DE_PASSE='…' npm run admin:creer
 *
 * Sans ADMIN_MOT_DE_PASSE, un mot de passe aléatoire est généré et écrit dans .env (jamais affiché).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { hacher } from "../src/lib/session";

async function main() {
  const identifiant = (process.env.ADMIN_IDENTIFIANT ?? "admin").trim().toLowerCase();
  let motDePasse = process.env.ADMIN_MOT_DE_PASSE;
  if (!motDePasse) {
    motDePasse = randomBytes(12).toString("base64url");
    let env = "";
    try { env = readFileSync(".env", "utf8"); } catch {}
    env = env.split("\n").filter((l) => !/^ADMIN_(IDENTIFIANT|MOT_DE_PASSE)=/.test(l)).join("\n").trimEnd();
    writeFileSync(".env", `${env}\n`);
    appendFileSync(".env", `ADMIN_IDENTIFIANT=${identifiant}\nADMIN_MOT_DE_PASSE=${motDePasse}\n`);
    console.log("Mot de passe généré et enregistré dans .env (ADMIN_MOT_DE_PASSE).");
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const hash = await hacher(motDePasse);
    await sql`insert into utilisateurs (identifiant, nom, mot_de_passe_hash, role)
      values (${identifiant}, 'Super administrateur', ${hash}, 'superadmin')
      on conflict (identifiant) do update set mot_de_passe_hash = excluded.mot_de_passe_hash, actif = true`;
    await sql`delete from sessions where utilisateur_id = (select id from utilisateurs where identifiant = ${identifiant})`;
    console.log(`Super administrateur « ${identifiant} » prêt.`);
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
