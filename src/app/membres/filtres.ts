// Partagé entre le serveur (lecture de l'adresse) et la liste côté navigateur.
export type Filtres = {
  q: string;
  archive: "non" | "oui" | "tous";
  langue: string;
  type: string;
  sponsor: boolean;
  moniteur: boolean;
  magazine: boolean;
};
export const DEFAUT: Filtres = { q: "", archive: "non", langue: "", type: "", sponsor: false, moniteur: false, magazine: false };

/** Filtres lus depuis l'adresse de la page. */
export function filtresDepuis(sp: Record<string, string | string[] | undefined>): Partial<Filtres> {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const out: Partial<Filtres> = {};
  if (g("q")) out.q = g("q");
  const a = g("archive");
  if (a === "oui" || a === "tous") out.archive = a;
  if (g("langue")) out.langue = g("langue");
  if (g("type")) out.type = g("type");
  for (const k of ["sponsor", "moniteur", "magazine"] as const) if (g(k) === "true") out[k] = true;
  return out;
}

