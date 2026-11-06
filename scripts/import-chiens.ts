/**
 * Import des chiens depuis l'Excel « Chiens Stage ou Remis ».
 *
 *   npm run import:chiens -- "Chiens Stage ou Remis.xlsx" [--force]
 *
 * Chaque ligne Excel = une remise (un chien confié à un bénéficiaire).
 * - Races, couleurs et pathologies → tables de référence (valeurs distinctes).
 * - Chiens dédoublonnés par numéro de puce (un même chien peut avoir plusieurs remises).
 * - Chaque bénéficiaire est rattaché au membre correspondant ; s'il n'existe pas, une fiche est créée.
 * - La ligne Excel d'origine est conservée telle quelle dans la remise.
 */
import "dotenv/config";
import postgres from "postgres";
import { lireExcel, majuscule, mots, pathologiesDe, puceChiffres, sansAccent, situation } from "./chiens-excel";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? "Chiens Stage ou Remis.xlsx";
const force = args.includes("--force");
export const MARQUE_CREATION = "Fiche créée lors de l'import des chiens";

type Contact = { id: number; nom: string | null; prenom: string | null; adresse: string | null; code_postal: string | null; localite: string | null; archive: boolean };

/** Trouve le membre correspondant à un bénéficiaire de l'Excel. */
function rapprocher(contacts: Contact[], nom: string, prenom: string, npa: string, localite: string, rue: string) {
  const motsNom = mots(nom);
  const prenom1 = mots(prenom)[0];
  let meilleur: { c: Contact; score: number; pourquoi: string } | null = null;
  for (const c of contacts) {
    const motsContact = mots(c.nom);
    if (!motsNom.every((m) => motsContact.includes(m))) continue;
    const memePrenom = !!prenom1 && mots(c.prenom).includes(prenom1);
    const citeBeneficiaire = !!prenom1 && motsContact.includes(prenom1); // « HUMAIR (pour Axel) »
    const memeNpa = !!npa && (c.code_postal ?? "").trim() === npa;
    const memeLocalite = !!localite && sansAccent(c.localite ?? "") === sansAccent(localite);
    if (!memePrenom && !citeBeneficiaire && !memeNpa && !memeLocalite) continue;
    const memeRue = !!rue && sansAccent(c.adresse ?? "") === sansAccent(rue);
    const score = (memePrenom ? 4 : 0) + (citeBeneficiaire ? 3 : 0) + (memeNpa ? 2 : 0) + (memeLocalite ? 1 : 0) + (memeRue ? 2 : 0) + (c.archive ? 0 : 0.5);
    const pourquoi = memePrenom || citeBeneficiaire ? "Même nom et prénom" : "Même famille (même nom, même NPA ou localité)";
    if (!meilleur || score > meilleur.score) meilleur = { c, score, pourquoi };
  }
  return meilleur;
}

async function main() {
  const lignes = await lireExcel(file);
  console.log(`Lu ${lignes.length} lignes dans « ${file} »`);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const [{ n }] = await sql`select count(*)::int n from chiens`;
    if (n > 0 && !force) throw new Error(`La base contient déjà ${n} chiens. Relancer avec --force pour tout remplacer.`);

    await sql.begin(async (tx) => {
      // Remise à zéro (y compris les fiches créées par un import précédent).
      const crees = await tx`select distinct contact_id from remises where rapprochement = ${MARQUE_CREATION}`;
      await tx`truncate remise_pathologies, remises, chiens, races, couleurs, pathologies restart identity cascade`;
      for (const { contact_id } of crees) {
        await tx`delete from contacts c where c.id = ${contact_id} and not exists (select 1 from cotisations d where d.contact_id = c.id) and not exists (select 1 from dons d where d.contact_id = c.id) and not exists (select 1 from cotisations_dons d where d.contact_id = c.id)`;
      }

      // Tables de référence
      const ref = async (table: string, valeurs: string[]) => {
        const map = new Map<string, number>();
        let ordre = 0;
        for (const v of valeurs) {
          const k = sansAccent(v);
          if (!v || map.has(k)) continue;
          const [{ id }] = await tx`insert into ${tx(table)} (libelle, ordre) values (${v}, ${++ordre}) returning id`;
          map.set(k, id);
        }
        return map;
      };
      const tri = (a: string, b: string) => a.localeCompare(b, "fr");
      const races = await ref("races", [...new Set(lignes.map((l) => l.v("C")))].sort(tri));
      const couleurs = await ref("couleurs", [...new Set(lignes.map((l) => majuscule(l.v("D"))))].sort(tri));
      const patho = await ref("pathologies", [...new Set(lignes.flatMap((l) => pathologiesDe(l.v("N"))))].sort(tri));

      // Chiens (dédoublonnés par puce)
      const chienParPuce = new Map<string, { id: number; naissance: string; ligne: number }>();
      const contacts = (await tx`select id, nom, prenom, adresse, code_postal, localite, archive from contacts`) as unknown as Contact[];

      for (const l of lignes) {
        const puce = puceChiffres(l.v("F"));
        const naissance = l.v("E");
        let chien = puce ? chienParPuce.get(puce) : undefined;
        if (!chien) {
          const [{ id }] = await tx`insert into chiens ${tx({
            nom: l.v("B"),
            race_id: races.get(sansAccent(l.v("C"))) ?? null,
            couleur_id: couleurs.get(sansAccent(l.v("D"))) ?? null,
            date_naissance: naissance || null,
            puce,
          })} returning id`;
          chien = { id, naissance, ligne: l.ligne };
          if (puce) chienParPuce.set(puce, chien);
        } else if (chien.naissance !== naissance) {
          const note = `Excel ligne ${l.ligne} : date de naissance ${naissance} (ligne ${chien.ligne} : ${chien.naissance}).`;
          await tx`update chiens set remarques = concat_ws(E'\n', remarques, ${note}::text) where id = ${chien.id}`;
        }

        // Membre
        const [nom, prenom, rue, npa, localite, canton] = ["H", "I", "J", "K", "L", "M"].map(l.v);
        const trouve = rapprocher(contacts, nom, prenom, npa, localite, rue);
        let contactId: number;
        let rapprochement: string;
        if (trouve) {
          contactId = trouve.c.id;
          rapprochement = trouve.pourquoi;
        } else {
          const [{ id }] = await tx`insert into contacts ${tx({
            nom, prenom, adresse: rue || null, code_postal: npa || null, localite: localite || null,
            canton: canton || null, pays: "CH",
            remarques: `${MARQUE_CREATION} (Excel « Chiens Stage ou Remis », ligne ${l.ligne}).`,
          })} returning id`;
          contactId = id;
          rapprochement = MARQUE_CREATION;
          contacts.push({ id, nom, prenom, adresse: rue, code_postal: npa, localite, archive: false });
        }

        // Remise
        const s = situation(l.v("O"), l.v("P"));
        const notes = [l.v("O"), l.v("P")].filter(Boolean).join(" · ");
        const [{ id: remiseId }] = await tx`insert into remises ${tx({
          numero: Number(l.v("A")) || null,
          chien_id: chien.id,
          contact_id: contactId,
          beneficiaire_nom: nom || null,
          beneficiaire_prenom: prenom || null,
          type: "remise",
          date_remise: l.v("G") || null,
          date_fin: s.dateFin,
          motif_fin: s.motifFin,
          actif: s.actif && !s.motifFin,
          remarques: notes ? `Excel : ${notes}` : null,
          source_excel: JSON.stringify({ ligne: l.ligne, ...l.brut }),
          rapprochement,
        })} returning id`;
        for (const p of pathologiesDe(l.v("N"))) {
          await tx`insert into remise_pathologies values (${remiseId}, ${patho.get(sansAccent(p))!}) on conflict do nothing`;
        }
        if (s.reforme) await tx`update chiens set reforme = true, date_reforme = ${s.dateFin} where id = ${chien.id}`;
        if (s.decede) await tx`update chiens set decede = true where id = ${chien.id}`;
      }
    });

    const r = await sql`select rapprochement, count(*)::int n from remises group by 1 order by 1`;
    const [{ c }] = await sql`select count(*)::int c from chiens`;
    console.log(`${c} chiens, ${lignes.length} remises.`);
    for (const x of r) console.log(`  ${x.rapprochement} : ${x.n}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
