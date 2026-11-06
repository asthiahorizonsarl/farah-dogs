/** Règles métier des chiens, partagées entre pages. */

type RemiseMin = { dateFin: string | null; actif: boolean; type: string; dateRemise: string | null };
type ChienMin = { decede: boolean; reforme: boolean; remises: RemiseMin[] };

export const MOTIFS_FIN = ["rendu", "retiré", "repris", "décès"] as const;
export const TYPES_REMISE = [
  { value: "remise", label: "Remise" },
  { value: "stage", label: "Stage" },
] as const;

/** Remise en cours = la plus récente sans date de fin ni motif. */
export function remiseEnCours<R extends RemiseMin & { motifFin?: string | null }>(remises: R[]): R | undefined {
  return remises
    .filter((r) => !r.dateFin && !r.motifFin)
    .sort((a, b) => (b.dateRemise ?? "").localeCompare(a.dateRemise ?? ""))[0];
}

export function statutChien(c: ChienMin): { label: string; couleur: string } {
  if (c.decede) return { label: "Décédé", couleur: "bg-stone-200 text-stone-700" };
  if (c.reforme) return { label: "Réformé", couleur: "bg-amber-100 text-amber-800" };
  const r = remiseEnCours(c.remises as (RemiseMin & { motifFin?: string | null })[]);
  if (r && !r.actif) return { label: "Pas actif", couleur: "bg-orange-100 text-orange-800" };
  if (r) return r.type === "stage"
    ? { label: "En stage", couleur: "bg-sky-100 text-sky-800" }
    : { label: "Remis", couleur: "bg-brand-100 text-brand-800" };
  return { label: "Disponible", couleur: "bg-violet-100 text-violet-800" };
}

/** "756000000000123" → "756 000 000 000 123" */
export function formatPuce(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/(\d{3})(?=\d)/g, "$1 ");
}

const PAYS_PUCE: Record<string, string> = { "756": "CH", "250": "F", "380": "I", "276": "D", "040": "A" };
export function paysPuce(p: string | null | undefined): string {
  return p ? PAYS_PUCE[p.slice(0, 3)] ?? "" : "";
}

/** Âge en années à partir d'une date ISO. */
export function age(naissance: string | null | undefined): string {
  if (!naissance) return "";
  const n = new Date(naissance);
  const now = new Date();
  let a = now.getFullYear() - n.getFullYear();
  if (now.getMonth() < n.getMonth() || (now.getMonth() === n.getMonth() && now.getDate() < n.getDate())) a--;
  return `${a} an${a > 1 ? "s" : ""}`;
}
