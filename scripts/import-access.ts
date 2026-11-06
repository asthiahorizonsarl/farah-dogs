/**
 * Import complet du fichier Access dans PostgreSQL.
 *
 *   npm run import:access -- "Gestion des membres.accdb" [--force]
 *
 * 1. Sauvegarde les tables Access brutes en CSV dans data/access-backup/.
 * 2. Vide les tables de l'application (seulement avec --force si elles contiennent déjà des données).
 * 3. Importe en une seule transaction, en conservant les ID Access.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  ACCESS_TABLES, LANGUES, TYPES, anneeEffective, bool, centimes, dateOnly, exportCsv,
  hyperlink, parseCsv, richTextToPlain, txt,
} from "./access";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? "Gestion des membres.accdb";
const force = args.includes("--force");

async function main() {
  // 1. Sauvegarde brute
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join("data", "access-backup", stamp);
  mkdirSync(backupDir, { recursive: true });
  const raw: Record<string, Record<string, string>[]> = {};
  for (const t of ACCESS_TABLES) {
    const csv = exportCsv(file, t);
    writeFileSync(path.join(backupDir, `${t}.csv`), csv);
    raw[t] = parseCsv(csv);
    console.log(`Lu ${raw[t].length} lignes dans « ${t} »`);
  }
  console.log(`Sauvegarde brute : ${backupDir}`);

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [{ n }] = await sql`select count(*)::int as n from contacts`;
    if (n > 0 && !force) {
      throw new Error(`La base contient déjà ${n} contacts. Relancer avec --force pour tout remplacer.`);
    }
    // Les remises de chiens dépendent des contacts : elles sont effacées aussi.
    const [{ remisesAvant }] = await sql`select count(*)::int as "remisesAvant" from remises`;

    await sql.begin(async (tx) => {
      await tx`truncate envois, cotisations, dons, cotisations_dons, contact_langues, contact_types, contacts, formes_politesse, langues, types_membre restart identity cascade`;

      // Formes de politesse
      for (const r of raw["Catégorie"]) {
        await tx`insert into formes_politesse (id, libelle, ordre) values (${Number(r.ID)}, ${r["Catégorie"].trim()}, ${Number(r.ID)})`;
      }
      for (const l of LANGUES) await tx`insert into langues (id, libelle, ordre) values (${l.id}, ${l.libelle}, ${l.id})`;
      for (const t of TYPES) await tx`insert into types_membre (id, libelle, ordre) values (${t.id}, ${t.libelle}, ${t.id})`;

      // Contacts
      for (const r of raw["Contacts"]) {
        const id = Number(r.ID);
        const web = hyperlink(r["Page Web"]);
        const cat = txt(r["Catégorie"]);
        await tx`insert into contacts ${tx({
          id,
          forme_politesse_id: cat ? Number(cat) : null,
          nom: txt(r["Nom"]),
          prenom: txt(r["Prénom"]),
          societe: txt(r["Société"]),
          fonction: txt(r["Fonction"]),
          email: txt(r["Adresse de messagerie"]),
          page_web: web.url,
          page_web_texte: web.texte,
          tel_professionnel: txt(r["Téléphone professionnel"]),
          tel_personnel: txt(r["Téléphone personnel"]),
          tel_mobile: txt(r["Téléphone mobile"]),
          fax: txt(r["Numéro de télécopie"]),
          adresse: txt(r["Adresse"]),
          code_postal: txt(r["Code postal"]),
          localite: txt(r["Ville"]),
          canton: txt(r["Département"]),
          pays: txt(r["Pays/Région"]),
          sponsor_fondation: bool(r["Sponsor-fondations"]),
          moniteur: bool(r["Moniteur"]),
          magazine: bool(r["Magazine"]),
          archive: bool(r["Archivé"]),
          remarques: richTextToPlain(r["Remarques"]),
          remarques_access: /<|&\w+;/.test(r["Remarques"]) ? r["Remarques"] : null,
        })}`;
        for (const l of LANGUES) {
          if (bool(r[l.champ])) await tx`insert into contact_langues values (${id}, ${l.id})`;
        }
        for (const t of TYPES) {
          if (bool(r[t.champ])) await tx`insert into contact_types values (${id}, ${t.id})`;
        }
      }

      // Cotisations et dons
      for (const r of raw["cotisation-dons"]) {
        const { annee, deduite } = anneeEffective(r);
        await tx`insert into cotisations_dons ${tx({
          id: Number(r.ID),
          contact_id: Number(r["Membre"]),
          annee,
          annee_deduite: deduite,
          cotisation_centimes: centimes(r["Cotisation annuelle"]),
          date_cotisation: dateOnly(r["Date versement coti"]),
          don_centimes: centimes(r["Dons"]),
          date_don: dateOnly(r["Date versement dons"]),
        })}`;
      }

      // Séparation en deux tables : cotisations et dons (même requête que la migration 0008).
      const separer = readFileSync(path.join("scripts", "separer.sql"), "utf8");
      for (const requete of separer.split("--> statement-breakpoint")) await tx.unsafe(requete);

      // Réglages d'envoi par défaut (les e-mails par type sont créés par la migration 0013).
      await tx`insert into parametres_envoi (id, seuil_centimes, expediteur_nom, expediteur_email)
        values (1, 10000, 'Association Farah Dogs', 'info@farah-dogs.ch') on conflict do nothing`;

      // Années de cotisation présentes dans les données (montant par défaut = le plus fréquent).
      await tx`insert into annees (annee, cotisation_defaut_centimes)
        select annee, mode() within group (order by cotisation_centimes) filter (where cotisation_centimes > 0)
        from cotisations_dons where annee is not null group by annee on conflict do nothing`;
      // L'ancienne table combinée garde ses lignes comme archive ; les ID repartent après le maximum.

      // Les nouveaux enregistrements reprennent après le plus grand ID Access.
      for (const t of ["formes_politesse", "langues", "types_membre", "contacts", "cotisations_dons", "cotisations", "dons"]) {
        await tx.unsafe(`select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 1))`);
      }
    });
    console.log("Import terminé. Lancer « npm run verify:access » pour contrôler.");
    if (remisesAvant > 0) console.log("⚠ Les chiens ont été effacés avec les contacts : relancer « npm run import:chiens ».");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
