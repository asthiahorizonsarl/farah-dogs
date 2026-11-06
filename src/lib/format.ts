const chf = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });

export function formatChf(centimes: number | null | undefined): string {
  if (centimes === null || centimes === undefined) return "";
  return chf.format(centimes / 100);
}

/** "2024-03-05" → "05.03.2024" */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, j] = d.slice(0, 10).split("-");
  return `${j}.${m}.${y}`;
}

/** Saisie utilisateur ("50", "50.5", "1'200,50") → centimes. Vide → null. */
export function parseMontant(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/['\s’]/g, "").replace(",", ".").trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Montant invalide : ${v}`);
  return Math.round(n * 100);
}

export function montantPourSaisie(centimes: number | null | undefined): string {
  if (centimes === null || centimes === undefined) return "";
  return (centimes / 100).toFixed(2);
}

export function nomComplet(c: { nom: string | null; prenom: string | null; societe?: string | null }): string {
  const n = [c.nom, c.prenom].filter(Boolean).join(" ").replace(/\n/g, " – ");
  return n || c.societe?.replace(/\n/g, " – ") || "(sans nom)";
}

/** Libellé unique d'un contact pour les listes de choix : « DUPONT Jean — 1950 Sion (n° 12) ». */
export function libelleContact(c: { id: number; nom: string | null; prenom: string | null; societe?: string | null; codePostal?: string | null; localite?: string | null }) {
  const lieu = [c.codePostal, c.localite].filter(Boolean).join(" ");
  return `${nomComplet(c)}${lieu ? ` — ${lieu}` : ""} (n° ${c.id})`;
}
