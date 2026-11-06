// Lecture et normalisation du fichier Excel « Chiens Stage ou Remis ».
import ExcelJS from "exceljs";

export const COLONNES = "ABCDEFGHIJKLMNOP".split("");
export type LigneExcel = { ligne: number; brut: Record<string, string | number | null>; v: (col: string) => string };

function valeur(c: ExcelJS.CellValue): string | number | null {
  if (c === null || c === undefined) return null;
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "object" && "richText" in c) return c.richText.map((t) => t.text).join("");
  if (typeof c === "object" && "result" in c) return valeur(c.result as ExcelJS.CellValue);
  return c as string | number;
}

export async function lireExcel(file: string): Promise<LigneExcel[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const out: LigneExcel[] = [];
  ws.eachRow((row, n) => {
    if (n < 4) return; // lignes 1-3 : titre et en-têtes
    const brut: LigneExcel["brut"] = {};
    for (const col of COLONNES) brut[col] = valeur(row.getCell(col).value);
    if (!brut.B) return;
    out.push({ ligne: n, brut, v: (col) => String(brut[col] ?? "").trim() });
  });
  return out;
}

export const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const mots = (s: string | null | undefined) => sansAccent(s ?? "").split(/[^a-z0-9]+/).filter(Boolean);
export const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "CH 756 000 000000 123" → "756000000000123" */
export function puceChiffres(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length ? d : null;
}

/** Pathologies : « Diabète + Trisomie » → [Diabète, Trisomie]. Variantes harmonisées. */
const SYNONYMES: Record<string, string> = {
  autismus: "Autisme",
  "stress post-traumatique": "Stress post-traumatique",
  epilepsie: "Épilepsie",
  hemiplegie: "Hémiplégie",
  hemiparesie: "Hémiparésie",
  neuropathie: "Neuropathie",
  trisomie: "Trisomie",
  diabete: "Diabète",
  autisme: "Autisme",
  "divers troubles": "Divers troubles",
};
export function pathologiesDe(v: string): string[] {
  if (!v) return [];
  const parts = v
    .replace(/^Trisomie-Hémiparésie$/i, "Trisomie + Hémiparésie")
    .split(/\s*\+\s*|\s+et\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((p) => SYNONYMES[sansAccent(p)] ?? majuscule(p));
}

/** "4.7.25" / "24.09.26" / "2.4.2026" → "2025-07-04" */
function dateCourte(s: string): string | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s);
  if (!m) return null;
  const an = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${an}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Colonnes O et P (sans en-tête dans l'Excel) : fin de remise, réforme, décès. */
export function situation(o: string, p: string) {
  const txt = `${o} ${p}`.toLowerCase();
  const date = dateCourte(o);
  let motifFin: string | null = null;
  if (/d[ée]c[èe]s/.test(txt)) motifFin = "décès";
  else if (/rendu/.test(txt)) motifFin = "rendu";
  else if (/retir/.test(txt)) motifFin = "retiré";
  else if (/repris/.test(txt)) motifFin = "repris";
  return {
    motifFin,
    dateFin: motifFin ? date : null,
    actif: !/pas actif/.test(txt),
    reforme: /r[ée]forme/.test(txt),
    decede: motifFin === "décès",
  };
}
