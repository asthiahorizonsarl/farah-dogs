// Lecture du fichier Access via mdbtools (brew install mdbtools).
import { execFileSync } from "node:child_process";
import { parse } from "csv-parse/sync";

export const ACCESS_TABLES = ["Catégorie", "Contacts", "cotisation-dons"] as const;

export function exportCsv(file: string, table: string): string {
  return execFileSync(
    "mdb-export",
    ["-D", "%Y-%m-%d", "-T", "%Y-%m-%d %H:%M:%S", "-b", "strip", file, table],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, LC_ALL: "fr_FR.UTF-8" } },
  );
}

export function parseCsv(csv: string): Record<string, string>[] {
  return parse(csv, { columns: true, skip_empty_lines: false, relax_quotes: false });
}

/** Texte nettoyé : espaces de début/fin retirés, fins de ligne uniformisées, vide → null. */
export function txt(v: string | undefined): string | null {
  if (v === undefined) return null;
  // Retours à la ligne Windows (\r\n) d'Access → \n, comme ceux saisis dans le navigateur.
  const t = v.replace(/\r\n?/g, "\n").trim();
  return t === "" ? null : t;
}

export function bool(v: string): boolean {
  if (v === "1" || v === "-1") return true;
  if (v === "0" || v === "") return false;
  throw new Error(`Valeur booléenne inattendue: ${JSON.stringify(v)}`);
}

/** Montant Access ("50.0000") → centimes. Vide → null. */
export function centimes(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Montant invalide: ${v}`);
  return Math.round(n * 100);
}

/** Date Access "2014-09-30 00:00:00" → "2014-09-30". Refuse une heure non nulle. */
export function dateOnly(v: string): string | null {
  if (v.trim() === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(v.trim());
  if (!m) throw new Error(`Date invalide: ${v}`);
  if (m[2] !== "00:00:00") throw new Error(`Date avec heure (perte possible): ${v}`);
  return m[1];
}

/** Lien hypertexte Access "texte#adresse#sous-adresse#" → { url, texte }. */
export function hyperlink(v: string): { url: string | null; texte: string | null } {
  const raw = v.trim();
  if (!raw) return { url: null, texte: null };
  if (!raw.includes("#")) return { url: raw, texte: null };
  const [display = "", address = "", sub = ""] = raw.split("#");
  const url = txt(address + (sub ? `#${sub}` : "")) ?? txt(display);
  const texte = txt(display);
  return { url, texte: texte && texte !== url && `http://${texte}` !== url ? texte : null };
}

export const LANGUES = [
  { id: 1, libelle: "Français", champ: "Langue francais" },
  { id: 2, libelle: "Allemand", champ: "Langue allemande" },
  { id: 3, libelle: "Italien", champ: "Langue italienne" },
  { id: 4, libelle: "Anglais", champ: "Langue anglaise" },
] as const;

export const TYPES = [
  { id: 1, libelle: "Membre actif", champ: "Statut actif" },
  { id: 2, libelle: "Membre passif", champ: "Statut passif" },
  { id: 3, libelle: "Membre honoraire", champ: "Statut honoraire" },
] as const;

export function anneeEffective(r: Record<string, string>) {
  const a = r["Annee"].trim();
  if (a) {
    if (!/^\d{4}$/.test(a)) throw new Error(`Année invalide: ${a}`);
    return { annee: Number(a), deduite: false };
  }
  const d = dateOnly(r["Date versement coti"]) ?? dateOnly(r["Date versement dons"]);
  return d ? { annee: Number(d.slice(0, 4)), deduite: true } : { annee: null, deduite: false };
}

/** Texte enrichi Access (<div>, <strong>, &nbsp;) → texte simple avec retours à la ligne. */
export function richTextToPlain(v: string): string | null {
  const t = v
    .replace(/\r\n/g, "\n")
    .replace(/<\/div>\s*/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return txt(t);
}
