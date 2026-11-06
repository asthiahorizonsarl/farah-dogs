/**
 * Contrôle champ par champ que chaque donnée Access se retrouve dans PostgreSQL.
 *   npm run verify:access -- "Gestion des membres.accdb"
 */
import "dotenv/config";
import postgres from "postgres";
import { LANGUES, TYPES, exportCsv, parseCsv, richTextToPlain } from "./access";

const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "Gestion des membres.accdb";
const errors: string[] = [];
const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(/\r\n?/g, "\n").trim());
function eq(where: string, access: unknown, db: unknown) {
  if (norm(access) !== norm(db)) errors.push(`${where}: Access=${JSON.stringify(access)} / base=${JSON.stringify(db)}`);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const cats = parseCsv(exportCsv(file, "Catégorie"));
    const contacts = parseCsv(exportCsv(file, "Contacts"));
    const cds = parseCsv(exportCsv(file, "cotisation-dons"));

    const dbCats = new Map((await sql`select * from formes_politesse`).map((r) => [r.id, r]));
    eq("nb formes de politesse", cats.length, dbCats.size);
    for (const r of cats) eq(`Catégorie ${r.ID}`, r["Catégorie"], dbCats.get(Number(r.ID))?.libelle);

    const dbC = new Map((await sql`select * from contacts`).map((r) => [r.id, r]));
    const langs = await sql`select * from contact_langues`;
    const types = await sql`select * from contact_types`;
    // Les fiches créées par l'import des chiens (bénéficiaires absents d'Access) sont comptées à part.
    const creesChiens = [...dbC.values()].filter((c) => String(c.remarques ?? "").startsWith("Fiche créée lors de l'import des chiens")).length;
    eq("nb contacts venant d'Access", contacts.length, dbC.size - creesChiens);
    const champs: [string, string][] = [
      ["Catégorie", "forme_politesse_id"], ["Nom", "nom"], ["Prénom", "prenom"], ["Société", "societe"],
      ["Fonction", "fonction"], ["Adresse de messagerie", "email"],
      ["Téléphone professionnel", "tel_professionnel"], ["Téléphone personnel", "tel_personnel"],
      ["Téléphone mobile", "tel_mobile"], ["Numéro de télécopie", "fax"], ["Adresse", "adresse"],
      ["Code postal", "code_postal"], ["Ville", "localite"], ["Département", "canton"],
      ["Pays/Région", "pays"],
    ];
    const flags: [string, string][] = [
      ["Sponsor-fondations", "sponsor_fondation"], ["Moniteur", "moniteur"],
      ["Magazine", "magazine"], ["Archivé", "archive"],
    ];
    for (const r of contacts) {
      const id = Number(r.ID);
      const d = dbC.get(id);
      if (!d) { errors.push(`Contact ${id} absent`); continue; }
      for (const [a, b] of champs) eq(`Contact ${id} ${a}`, r[a], d[b]);
      // Remarques : texte simple + original Access intact quand il contenait du HTML.
      eq(`Contact ${id} Remarques (texte)`, richTextToPlain(r["Remarques"]), d.remarques);
      if (d.remarques_access !== null) eq(`Contact ${id} Remarques (original)`, r["Remarques"], d.remarques_access);
      else if (/<|&\w+;/.test(r["Remarques"])) errors.push(`Contact ${id}: original des remarques non conservé`);
      for (const [a, b] of flags) eq(`Contact ${id} ${a}`, r[a] === "1", d[b]);
      // Lien web : l'adresse et le texte affiché doivent tous deux se retrouver.
      const web = r["Page Web"].trim();
      for (const part of web.split("#").map((s) => s.trim()).filter(Boolean)) {
        const kept = [d.page_web, d.page_web_texte].some((v) => v && (v === part || v === `http://${part}` || v.includes(part)));
        if (!kept) errors.push(`Contact ${id} Page Web: « ${part} » perdu`);
      }
      for (const l of LANGUES)
        eq(`Contact ${id} ${l.champ}`, r[l.champ] === "1", langs.some((x) => x.contact_id === id && x.langue_id === l.id));
      for (const t of TYPES)
        eq(`Contact ${id} ${t.champ}`, r[t.champ] === "1", types.some((x) => x.contact_id === id && x.type_id === t.id));
    }

    const dbCd = new Map((await sql`select *, date_cotisation::text dc, date_don::text dd from cotisations_dons`).map((r) => [r.id, r]));
    eq("nb cotisations/dons", cds.length, dbCd.size);
    let sumA = 0, sumD = 0;
    for (const r of cds) {
      const id = Number(r.ID);
      const d = dbCd.get(id);
      if (!d) { errors.push(`Versement ${id} absent`); continue; }
      eq(`Versement ${id} membre`, r["Membre"], d.contact_id);
      if (r["Annee"].trim()) eq(`Versement ${id} année`, r["Annee"], d.annee);
      else if (!d.annee_deduite && d.annee !== null) errors.push(`Versement ${id}: année inventée`);
      const cents = (v: string) => (v.trim() === "" ? "" : Math.round(Number(v) * 100));
      eq(`Versement ${id} cotisation`, cents(r["Cotisation annuelle"]), d.cotisation_centimes);
      eq(`Versement ${id} don`, cents(r["Dons"]), d.don_centimes);
      eq(`Versement ${id} date coti`, r["Date versement coti"].slice(0, 10), d.dc);
      eq(`Versement ${id} date don`, r["Date versement dons"].slice(0, 10), d.dd);
      sumA += Number(r["Cotisation annuelle"] || 0) + Number(r["Dons"] || 0);
      sumD += (d.cotisation_centimes ?? 0) + (d.don_centimes ?? 0);
    }
    eq("total général (centimes)", Math.round(sumA * 100), sumD);

    // Séparation : chaque ligne Access se retrouve en cotisation et/ou en don.
    const cotis = new Map((await sql`select *, date_paiement::text dp from cotisations where origine_id is not null`).map((r) => [r.origine_id, r]));
    const donsDb = new Map((await sql`select *, date_don::text dd from dons where origine_id is not null`).map((r) => [r.origine_id, r]));
    const centimes = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 100));
    let sumCoti = 0, sumDons = 0;
    for (const r of cds) {
      const id = Number(r.ID);
      const coti = centimes(r["Cotisation annuelle"]);
      const don = centimes(r["Dons"]);
      const dateCoti = r["Date versement coti"].slice(0, 10);
      const dateDon = r["Date versement dons"].slice(0, 10);
      const donSeul = (don ?? 0) > 0 && !coti && !dateCoti;
      const c = cotis.get(id);
      if (donSeul) {
        if (c) errors.push(`Versement ${id}: cotisation vide créée pour un don seul`);
      } else if (!c) errors.push(`Versement ${id}: cotisation absente`);
      else {
        eq(`Cotisation ${id} montant`, coti, c.montant_centimes);
        eq(`Cotisation ${id} date`, dateCoti, c.dp);
        eq(`Cotisation ${id} membre`, r["Membre"], c.contact_id);
        if (r["Annee"].trim()) eq(`Cotisation ${id} année`, r["Annee"], c.annee);
        sumCoti += c.montant_centimes ?? 0;
      }
      const d = donsDb.get(id);
      if ((don ?? 0) > 0 || dateDon) {
        if (!d) errors.push(`Versement ${id}: don absent`);
        else {
          eq(`Don ${id} montant`, don, d.montant_centimes);
          eq(`Don ${id} date`, dateDon, d.dd);
          eq(`Don ${id} membre`, r["Membre"], d.contact_id);
          if (r["Annee"].trim()) eq(`Don ${id} année`, r["Annee"], d.annee);
          sumDons += d.montant_centimes ?? 0;
        }
      } else if (d) errors.push(`Versement ${id}: don créé sans montant ni date`);
    }
    eq("total cotisations + dons séparés (centimes)", Math.round(sumA * 100), sumCoti + sumDons);
    console.log(`Séparation : ${cotis.size} cotisations, ${donsDb.size} dons (${(sumCoti / 100).toFixed(2)} + ${(sumDons / 100).toFixed(2)} CHF)`);

    console.log(`Formes de politesse : ${cats.length}  Contacts : ${contacts.length}  Versements : ${cds.length}`);
    console.log(`Total cotisations + dons : ${(sumD / 100).toFixed(2)} CHF`);
    console.log(`Années déduites de la date : ${[...dbCd.values()].filter((d) => d.annee_deduite).length}`);
    if (errors.length) {
      console.error(`\n${errors.length} différence(s) :`);
      for (const e of errors.slice(0, 50)) console.error(" - " + e);
      process.exit(1);
    }
    console.log("\nOK : toutes les données Access sont présentes dans la base.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
