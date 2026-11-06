/** Contrôle que chaque cellule de l'Excel des chiens se retrouve dans la base. */
import "dotenv/config";
import postgres from "postgres";
import { lireExcel, majuscule, pathologiesDe, puceChiffres, sansAccent } from "./chiens-excel";

const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "Chiens Stage ou Remis.xlsx";
const errors: string[] = [];
const eq = (w: string, a: unknown, b: unknown) => {
  if (String(a ?? "").trim() !== String(b ?? "").trim()) errors.push(`${w}: Excel=${JSON.stringify(a)} / base=${JSON.stringify(b)}`);
};

async function main() {
  const lignes = await lireExcel(file);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const rows = await sql`
      select r.*, r.date_remise::text dr, ch.nom chien, ch.puce, ch.date_naissance::text dn, ch.remarques chien_rem,
             ra.libelle race, co.libelle couleur,
             (select array_agg(p.libelle order by p.libelle) from remise_pathologies rp join pathologies p on p.id = rp.pathologie_id where rp.remise_id = r.id) patho,
             c.id contact_ok
      from remises r join chiens ch on ch.id = r.chien_id left join races ra on ra.id = ch.race_id
      left join couleurs co on co.id = ch.couleur_id left join contacts c on c.id = r.contact_id`;
    const parLigne = new Map(rows.map((r) => [JSON.parse(r.source_excel).ligne as number, r]));
    eq("nb remises", lignes.length, rows.length);
    for (const l of lignes) {
      const r = parLigne.get(l.ligne);
      const w = `Ligne ${l.ligne}`;
      if (!r) { errors.push(`${w} absente`); continue; }
      eq(`${w} ligne brute`, JSON.stringify({ ligne: l.ligne, ...l.brut }), r.source_excel);
      eq(`${w} N°`, l.v("A"), r.numero);
      eq(`${w} chien`, l.v("B"), r.chien);
      eq(`${w} race`, l.v("C"), r.race);
      if (sansAccent(majuscule(l.v("D"))) !== sansAccent(r.couleur ?? "")) eq(`${w} couleur`, l.v("D"), r.couleur);
      eq(`${w} puce`, puceChiffres(l.v("F")), r.puce);
      if (l.v("E") !== r.dn && !(r.chien_rem ?? "").includes(l.v("E"))) eq(`${w} naissance`, l.v("E"), r.dn);
      eq(`${w} reçu le`, l.v("G"), r.dr);
      eq(`${w} nom`, l.v("H"), r.beneficiaire_nom);
      eq(`${w} prénom`, l.v("I"), r.beneficiaire_prenom);
      eq(`${w} pathologies`, pathologiesDe(l.v("N")).sort().join(", "), (r.patho ?? []).join(", "));
      if (!r.contact_ok) errors.push(`${w}: aucun membre lié`);
    }
    const [{ n }] = await sql`select count(*)::int n from chiens`;
    const puces = new Set(lignes.map((l) => puceChiffres(l.v("F"))));
    eq("nb chiens (puces distinctes)", puces.size, n);
    console.log(`${lignes.length} lignes Excel, ${n} chiens, ${rows.length} remises.`);
    if (errors.length) {
      console.error(`${errors.length} différence(s) :`);
      errors.slice(0, 40).forEach((e) => console.error(" - " + e));
      process.exit(1);
    }
    console.log("OK : toutes les données de l'Excel sont présentes dans la base.");
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
