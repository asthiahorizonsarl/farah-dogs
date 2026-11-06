/**
 * Conversion Word (.docx) → PDF en JavaScript pur, sans logiciel externe.
 *
 * Lit directement la mise en page du Word (page, marges, en-tête et pied de page, alignements, tailles,
 * gras/italique/couleurs, espacements, tabulations, retraits, listes, tableaux, images) et la reproduit
 * avec pdfmake. Les polices Microsoft sont remplacées par des polices libres aux mêmes métriques
 * (dossier /fonts) : Verdana → DejaVu Sans, Calibri → Carlito, Arial → Liberation Sans, Times → Liberation Serif, Courier → Liberation Mono.
 */
import path from "node:path";
import PizZip from "pizzip";
import { DOMParser, type Element as XEl } from "@xmldom/xmldom";
import * as fontkit from "fontkit";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

/** Nœud pdfmake (typage souple : la structure est construite dynamiquement). */
type Content = Record<string, unknown>;

// ——————————————————— Polices ———————————————————

const DOSSIER_POLICES = path.join(process.cwd(), "fonts");
const FICHIERS: Record<string, string> = { DejaVu: "DejaVuSans", Carlito: "Carlito", Arimo: "LiberationSans", Tinos: "LiberationSerif", Cousine: "LiberationMono" };
const fichierPolice = (fam: string, b: boolean, i: boolean) =>
  path.join(DOSSIER_POLICES, `${FICHIERS[fam]}-${b && i ? "BoldItalic" : b ? "Bold" : i ? "Italic" : "Regular"}.ttf`);

pdfmake.setFonts(Object.fromEntries(Object.keys(FICHIERS).map((f) => [f, {
  normal: fichierPolice(f, false, false), bold: fichierPolice(f, true, false),
  italics: fichierPolice(f, false, true), bolditalics: fichierPolice(f, true, true),
}])));
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((p: string) => p.startsWith(DOSSIER_POLICES));

/** Police libre la plus proche d'une police Word. */
function famille(nom?: string): string {
  const n = (nom ?? "").toLowerCase();
  if (/verdana|tahoma|dejavu|geneva|avdira/.test(n)) return "DejaVu";
  if (/calibri|carlito|candara|corbel/.test(n)) return "Carlito";
  if (/times|cambria|georgia|garamond|antiqua|palatino|minion|serif/.test(n)) return "Tinos";
  if (/courier|consolas|mono|console/.test(n)) return "Cousine";
  return "Arimo"; // Arial, Helvetica, Aptos, Segoe…
}

const polices = new Map<string, fontkit.Font>();
function police(fam: string, b: boolean, i: boolean): fontkit.Font {
  const k = `${fam}${b ? "B" : ""}${i ? "I" : ""}`;
  let f = polices.get(k);
  if (!f) { f = fontkit.openSync(fichierPolice(fam, b, i)) as fontkit.Font; polices.set(k, f); }
  return f;
}
const largeur = (t: string, r: Style) => {
  const f = police(r.fam, !!r.b, !!r.i);
  try {
    return (f.layout(t).advanceWidth / f.unitsPerEm) * r.sz;
  } catch (e) {
    if (process.env.DEBUG_PDF) console.error("[PDF] mesure", [...t].map((c) => c.codePointAt(0)!.toString(16)).join(","), r.fam, r.b, r.i, String(e).slice(0, 60));
    return t.length * r.sz * 0.55; // estimation si un caractère n'est pas mesurable
  }
};
const hauteurLigne = (r: Style) => {
  const f = police(r.fam, !!r.b, !!r.i);
  return ((f.ascent - f.descent) / f.unitsPerEm) * r.sz;
};

// ——————————————————— XML ———————————————————

const enfants = (e: XEl | null | undefined, nom?: string): XEl[] => {
  const out: XEl[] = [];
  if (!e) return out;
  for (let n = e.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!nom || (n as XEl).localName === nom)) out.push(n as XEl);
  }
  return out;
};
const enfant = (e: XEl | null | undefined, nom: string) => enfants(e, nom)[0] ?? null;
const at = (e: XEl | null | undefined, nom: string) => (e ? e.getAttribute(`w:${nom}`) || e.getAttribute(nom) || null : null);
const nb = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? undefined : Number(v));
const tw = (v: string | null | undefined) => { const n = nb(v); return n === undefined ? undefined : n / 20; }; // twips → points
const bascule = (e: XEl | null) => (e ? !["0", "false", "off"].includes(at(e, "val") ?? "") : undefined);
const definis = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const lireXml = (zip: PizZip, chemin: string) => {
  const f = zip.file(chemin);
  return f ? new DOMParser().parseFromString(f.asText(), "text/xml").documentElement as unknown as XEl : null;
};

// ——————————————————— Propriétés ———————————————————

type RP = { b?: boolean; i?: boolean; u?: boolean; strike?: boolean; color?: string; sz?: number; font?: string; caps?: boolean; vanish?: boolean };
type Tab = { pos: number; val: string };
type PP = {
  jc?: string; before?: number; after?: number; line?: number; lineRule?: string;
  left?: number; right?: number; firstLine?: number; hanging?: number; tabs?: Tab[];
  numId?: string; ilvl?: number; pageBreakBefore?: boolean;
  bordHaut?: Trait | null; bordBas?: Trait | null;
};
/** Trait de bordure : épaisseur (pt), couleur, espace avec le texte (pt). null = aucun. */
type Trait = { w: number; color: string; espace: number };
type Style = { fam: string; sz: number; b?: boolean; i?: boolean; u?: boolean; strike?: boolean; color?: string; caps?: boolean };

type Ctx = {
  zip: PizZip;
  theme: { minor?: string; major?: string };
  defaults: { rp: RP; pp: PP };
  styles: Map<string, { type: string; basedOn?: string; rp: RP; pp: PP; tblBorders?: XEl | null }>;
  styleParDefaut?: string;
  numerotation: Map<string, Map<number, { fmt: string; texte: string; pp: PP; debut: number }>>;
  compteurs: Map<string, number>;
  tabDefaut: number;
};

function lireRP(ctx: Pick<Ctx, "theme">, rPr: XEl | null): RP {
  if (!rPr) return {};
  const f = enfant(rPr, "rFonts");
  const theme = at(f, "asciiTheme") || at(f, "hAnsiTheme");
  const font = at(f, "ascii") || at(f, "hAnsi") || (theme ? (theme.startsWith("major") ? ctx.theme.major : ctx.theme.minor) : undefined) || undefined;
  const u = enfant(rPr, "u");
  const color = at(enfant(rPr, "color"), "val");
  return definis({
    b: bascule(enfant(rPr, "b")), i: bascule(enfant(rPr, "i")), strike: bascule(enfant(rPr, "strike")),
    caps: bascule(enfant(rPr, "caps")), vanish: bascule(enfant(rPr, "vanish")),
    u: u ? at(u, "val") !== "none" : undefined,
    color: color && color !== "auto" ? `#${color}` : undefined,
    sz: nb(at(enfant(rPr, "sz"), "val")) !== undefined ? Number(at(enfant(rPr, "sz"), "val")) / 2 : undefined,
    font,
  });
}

function lireTrait(e: XEl | null): Trait | null | undefined {
  if (!e) return undefined;
  const v = at(e, "val");
  if (!v || v === "nil" || v === "none") return null;
  const c = at(e, "color");
  return { w: Math.max(0.25, (nb(at(e, "sz")) ?? 4) / 8), color: c && c !== "auto" ? `#${c}` : "#000000", espace: nb(at(e, "space")) ?? 0 };
}

function lirePP(pPr: XEl | null): PP & { styleId?: string } {
  if (!pPr) return {};
  const sp = enfant(pPr, "spacing");
  const ind = enfant(pPr, "ind");
  const num = enfant(pPr, "numPr");
  const tabs = enfant(pPr, "tabs");
  return definis({
    styleId: at(enfant(pPr, "pStyle"), "val") ?? undefined,
    jc: at(enfant(pPr, "jc"), "val") ?? undefined,
    before: tw(at(sp, "before")), after: tw(at(sp, "after")),
    line: nb(at(sp, "line")), lineRule: at(sp, "lineRule") ?? undefined,
    left: tw(at(ind, "left") ?? at(ind, "start")), right: tw(at(ind, "right") ?? at(ind, "end")),
    firstLine: tw(at(ind, "firstLine")), hanging: tw(at(ind, "hanging")),
    tabs: tabs ? enfants(tabs, "tab").filter((t) => at(t, "val") !== "clear").map((t) => ({ pos: tw(at(t, "pos")) ?? 0, val: at(t, "val") ?? "left" })) : undefined,
    numId: at(enfant(num, "numId"), "val") ?? undefined,
    ilvl: nb(at(enfant(num, "ilvl"), "val")),
    pageBreakBefore: bascule(enfant(pPr, "pageBreakBefore")),
    bordHaut: lireTrait(enfant(enfant(pPr, "pBdr"), "top")),
    bordBas: lireTrait(enfant(enfant(pPr, "pBdr"), "bottom")),
  });
}

function chaineStyle(ctx: Ctx, id: string | undefined, vus = new Set<string>()): { rp: RP; pp: PP } {
  const s = id ? ctx.styles.get(id) : undefined;
  if (!s || vus.has(id!)) return { rp: {}, pp: {} };
  vus.add(id!);
  const base = chaineStyle(ctx, s.basedOn, vus);
  return { rp: { ...base.rp, ...s.rp }, pp: { ...base.pp, ...s.pp } };
}

function versStyle(rp: RP): Style {
  return { fam: famille(rp.font), sz: rp.sz ?? 11, b: rp.b, i: rp.i, u: rp.u, strike: rp.strike, color: rp.color, caps: rp.caps };
}

// ——————————————————— Contexte du document ———————————————————

function preparer(zip: PizZip): Ctx {
  const theme = lireXml(zip, "word/theme/theme1.xml");
  const police = (nom: string) => {
    if (!theme) return undefined;
    const fs = theme.getElementsByTagName(`a:${nom}`)[0] as unknown as XEl | undefined;
    const latin = fs ? (fs.getElementsByTagName("a:latin")[0] as unknown as XEl | undefined) : undefined;
    return latin?.getAttribute("typeface") || undefined;
  };
  const ctx: Ctx = {
    zip, theme: { minor: police("minorFont"), major: police("majorFont") },
    defaults: { rp: {}, pp: {} }, styles: new Map(), numerotation: new Map(), compteurs: new Map(), tabDefaut: 35.4,
  };
  const styles = lireXml(zip, "word/styles.xml");
  const dd = enfant(styles, "docDefaults");
  ctx.defaults.rp = lireRP(ctx, enfant(enfant(dd, "rPrDefault"), "rPr"));
  ctx.defaults.pp = lirePP(enfant(enfant(dd, "pPrDefault"), "pPr"));
  for (const s of enfants(styles, "style")) {
    const id = at(s, "styleId");
    if (!id) continue;
    const type = at(s, "type") ?? "paragraph";
    ctx.styles.set(id, {
      type, basedOn: at(enfant(s, "basedOn"), "val") ?? undefined,
      rp: lireRP(ctx, enfant(s, "rPr")), pp: lirePP(enfant(s, "pPr")),
      tblBorders: enfant(enfant(s, "tblPr"), "tblBorders"),
    });
    if (type === "paragraph" && at(s, "default") === "1") ctx.styleParDefaut = id;
  }
  const reglages = lireXml(zip, "word/settings.xml");
  ctx.tabDefaut = tw(at(enfant(reglages, "defaultTabStop"), "val")) ?? 35.4;

  const num = lireXml(zip, "word/numbering.xml");
  const abstraits = new Map<string, Map<number, { fmt: string; texte: string; pp: PP; debut: number }>>();
  for (const a of enfants(num, "abstractNum")) {
    const niveaux = new Map<number, { fmt: string; texte: string; pp: PP; debut: number }>();
    for (const l of enfants(a, "lvl")) {
      niveaux.set(Number(at(l, "ilvl") ?? 0), {
        fmt: at(enfant(l, "numFmt"), "val") ?? "decimal", texte: at(enfant(l, "lvlText"), "val") ?? "",
        pp: lirePP(enfant(l, "pPr")), debut: Number(at(enfant(l, "start"), "val") ?? 1),
      });
    }
    abstraits.set(at(a, "abstractNumId") ?? "", niveaux);
  }
  for (const n of enfants(num, "num")) {
    const ab = abstraits.get(at(enfant(n, "abstractNumId"), "val") ?? "");
    if (ab) ctx.numerotation.set(at(n, "numId") ?? "", ab);
  }
  return ctx;
}

function relations(ctx: Ctx, partie: string): Map<string, string> {
  const dossier = path.posix.dirname(partie);
  const x = lireXml(ctx.zip, `${dossier}/_rels/${path.posix.basename(partie)}.rels`);
  const m = new Map<string, string>();
  for (const r of enfants(x, "Relationship")) {
    const cible = r.getAttribute("Target") ?? "";
    m.set(r.getAttribute("Id") ?? "", cible.startsWith("/") ? cible.slice(1) : path.posix.normalize(`${dossier}/${cible}`));
  }
  return m;
}

// ——————————————————— Rendu ———————————————————

type Bloc = { c: Content; h: number };
type Morceau =
  | { k: "texte"; t: string; s: Style }
  | { k: "tab" }
  | { k: "ligne" }
  | { k: "page" }
  | { k: "image"; data: string; w: number; h: number; dx: number }
  | { k: "champ"; nom: "PAGE" | "NUMPAGES"; s: Style };

const MARQUE_PAGE = "\u0001PAGE\u0001";
const MARQUE_TOTAL = "\u0001NUMPAGES\u0001";

function image(ctx: Ctx, rels: Map<string, string>, dessin: XEl): Morceau | null {
  const conteneur = enfant(dessin, "inline") ?? enfant(dessin, "anchor");
  if (!conteneur) return null;
  const ext = enfant(conteneur, "extent");
  const w = Number(ext?.getAttribute("cx") ?? 0) / 12700;
  const h = Number(ext?.getAttribute("cy") ?? 0) / 12700;
  const blip = conteneur.getElementsByTagName("a:blip")[0] as unknown as XEl | undefined;
  const id = blip?.getAttribute("r:embed");
  const cible = id ? rels.get(id) : undefined;
  const f = cible ? ctx.zip.file(cible) : null;
  if (!f || !w || !h) return null;
  const ext2 = path.extname(cible!).toLowerCase();
  const mime = ext2 === ".png" ? "image/png" : ext2 === ".jpg" || ext2 === ".jpeg" ? "image/jpeg" : null;
  if (!mime) return null; // EMF/WMF/GIF non pris en charge par le PDF
  let dx = 0;
  if (conteneur.localName === "anchor") {
    const ph = enfant(conteneur, "positionH");
    const off = enfant(ph, "posOffset");
    if (off && ["column", "margin", "character"].includes(ph?.getAttribute("relativeFrom") ?? "")) dx = Number(off.textContent ?? 0) / 12700;
  }
  return { k: "image", data: `data:${mime};base64,${Buffer.from(f.asUint8Array()).toString("base64")}`, w, h, dx: Math.max(0, dx) };
}

/** Parcourt le contenu d'un paragraphe (runs, liens, champs…) et renvoie des morceaux à mettre en page. */
function morceaux(ctx: Ctx, rels: Map<string, string>, e: XEl, rpBase: RP, out: Morceau[], champ: { instr: string; dans: boolean }) {
  for (const n of enfants(e)) {
    switch (n.localName) {
      case "r": {
        const rStyle = at(enfant(enfant(n, "rPr"), "rStyle"), "val") ?? undefined;
        const rp: RP = { ...rpBase, ...chaineStyle(ctx, rStyle).rp, ...lireRP(ctx, enfant(n, "rPr")) };
        if (rp.vanish) break;
        const s = versStyle(rp);
        for (const c of enfants(n)) {
          switch (c.localName) {
            case "fldChar": {
              const t = at(c, "fldCharType");
              if (t === "begin") { champ.instr = ""; champ.dans = false; }
              else if (t === "separate") {
                champ.dans = true;
                const nom = /\bNUMPAGES\b/.test(champ.instr) ? "NUMPAGES" : /\bPAGE\b/.test(champ.instr) ? "PAGE" : null;
                if (nom) out.push({ k: "champ", nom, s });
              } else if (t === "end") { champ.instr = ""; champ.dans = false; }
              break;
            }
            case "instrText": champ.instr += c.textContent ?? ""; break;
            case "t": {
              if (champ.dans && /\b(NUM)?PAGES?\b/.test(champ.instr)) break; // remplacé par le numéro de page
              let t = c.textContent ?? "";
              if (s.caps) t = t.toUpperCase();
              if (t) out.push({ k: "texte", t, s });
              break;
            }
            case "tab": out.push({ k: "tab" }); break;
            case "br": out.push({ k: at(c, "type") === "page" ? "page" : "ligne" }); break;
            case "cr": out.push({ k: "ligne" }); break;
            case "noBreakHyphen": out.push({ k: "texte", t: "-", s }); break;
            case "sym": out.push({ k: "texte", t: "•", s }); break;
            case "drawing": { const im = image(ctx, rels, c); if (im) out.push(im); break; }
            case "pict": {
              const d = c.getElementsByTagName("v:imagedata")[0] as unknown as XEl | undefined;
              const id = d?.getAttribute("r:id");
              const cible = id ? rels.get(id) : undefined;
              const f = cible ? ctx.zip.file(cible) : null;
              const style = (c.getElementsByTagName("v:shape")[0] as unknown as XEl | undefined)?.getAttribute("style") ?? "";
              const w = Number(/width:([\d.]+)pt/.exec(style)?.[1] ?? 0), h = Number(/height:([\d.]+)pt/.exec(style)?.[1] ?? 0);
              if (f && w && h && /\.(png|jpe?g)$/i.test(cible!)) {
                out.push({ k: "image", data: `data:image/${/png$/i.test(cible!) ? "png" : "jpeg"};base64,${Buffer.from(f.asUint8Array()).toString("base64")}`, w, h, dx: 0 });
              }
              break;
            }
          }
        }
        break;
      }
      case "fldSimple": {
        const instr = at(n, "instr") ?? "";
        const nom = /\bNUMPAGES\b/.test(instr) ? "NUMPAGES" : /\bPAGE\b/.test(instr) ? "PAGE" : null;
        if (nom) out.push({ k: "champ", nom, s: versStyle(rpBase) });
        else morceaux(ctx, rels, n, rpBase, out, champ);
        break;
      }
      case "hyperlink": case "ins": case "smartTag": case "customXml": case "sdtContent": case "moveTo":
        morceaux(ctx, rels, n, rpBase, out, champ);
        break;
      case "sdt": morceaux(ctx, rels, enfant(n, "sdtContent") ?? n, rpBase, out, champ); break;
    }
  }
}

function texteMorceau(m: Morceau & ({ k: "texte" } | { k: "champ" })) {
  const s = m.s;
  return definis({
    text: m.k === "champ" ? (m.nom === "PAGE" ? MARQUE_PAGE : MARQUE_TOTAL) : m.t,
    font: s.fam, fontSize: s.sz, bold: s.b || undefined, italics: s.i || undefined, color: s.color,
    decoration: s.u ? "underline" : s.strike ? "lineThrough" : undefined,
  });
}

/** Nombre de lignes estimé d'un texte dans une largeur (pour calculer les hauteurs d'en-tête et de tableau). */
function lignes(textes: (Morceau & { k: "texte" | "champ" })[], largeurDispo: number): number {
  let n = 1, x = 0;
  for (const m of textes) {
    const t = m.k === "champ" ? "00" : m.t;
    for (const mot of t.split(/(\s+)/)) {
      if (!mot) continue;
      const w = largeur(mot, m.s);
      if (x + w > largeurDispo && x > 0 && mot.trim()) { n++; x = /\s/.test(mot) ? 0 : w; } else x += w;
    }
  }
  return n;
}

function marqueur(ctx: Ctx, pp: PP): string | null {
  if (!pp.numId || pp.numId === "0") return null;
  const niveaux = ctx.numerotation.get(pp.numId);
  const ilvl = pp.ilvl ?? 0;
  const lvl = niveaux?.get(ilvl);
  if (!lvl) return null;
  if (lvl.fmt === "bullet") return /[·•]/.test(lvl.texte) || !lvl.texte ? "•" : lvl.texte === "o" ? "◦" : "•";
  const cle = `${pp.numId}:${ilvl}`;
  const v = (ctx.compteurs.get(cle) ?? lvl.debut - 1) + 1;
  ctx.compteurs.set(cle, v);
  for (const [k] of ctx.compteurs) if (k.startsWith(`${pp.numId}:`) && Number(k.split(":")[1]) > ilvl) ctx.compteurs.delete(k);
  const romain = (x: number) => [["m", 1000], ["cm", 900], ["d", 500], ["cd", 400], ["c", 100], ["xc", 90], ["l", 50], ["xl", 40], ["x", 10], ["ix", 9], ["v", 5], ["iv", 4], ["i", 1]]
    .reduce((s, [l, n]) => { while (x >= (n as number)) { s += l; x -= n as number; } return s; }, "");
  const val = lvl.fmt === "lowerLetter" ? String.fromCharCode(96 + v) : lvl.fmt === "upperLetter" ? String.fromCharCode(64 + v)
    : lvl.fmt === "lowerRoman" ? romain(v) : lvl.fmt === "upperRoman" ? romain(v).toUpperCase() : String(v);
  return lvl.texte.replace(/%\d/g, val) || `${val}.`;
}

function paragraphe(ctx: Ctx, rels: Map<string, string>, p: XEl, largeurDispo: number): Bloc[] {
  const direct = lirePP(enfant(p, "pPr"));
  const styleId = direct.styleId ?? ctx.styleParDefaut;
  const st = chaineStyle(ctx, styleId);
  const numPP = direct.numId || st.pp.numId ? ctx.numerotation.get(direct.numId ?? st.pp.numId ?? "")?.get(direct.ilvl ?? st.pp.ilvl ?? 0)?.pp ?? {} : {};
  const pp: PP = { ...ctx.defaults.pp, ...st.pp, ...numPP, ...direct };
  const rpBase: RP = { ...ctx.defaults.rp, ...st.rp };
  const marque = versStyle({ ...rpBase, ...lireRP(ctx, enfant(enfant(p, "pPr"), "rPr")) });

  const ms: Morceau[] = [];
  morceaux(ctx, rels, p, rpBase, ms, { instr: "", dans: false });

  const alignement = pp.jc === "center" ? "center" : pp.jc === "right" || pp.jc === "end" ? "right" : pp.jc === "both" || pp.jc === "distribute" ? "justify" : "left";
  const gauche = Math.max(0, (pp.left ?? 0) - (pp.hanging ?? 0));
  const droite = Math.max(0, pp.right ?? 0);
  const avant = pp.before ?? 0, apres = pp.after ?? 0;
  const tailleMax = Math.max(marque.sz, ...ms.filter((m) => m.k === "texte").map((m) => (m as { s: Style }).s.sz));
  const styleRef = ms.find((m) => m.k === "texte") as { s: Style } | undefined;
  const lh = pp.lineRule === "exact" || pp.lineRule === "atLeast"
    ? Math.max(0.8, ((pp.line ?? 240) / 20) / hauteurLigne(styleRef?.s ?? marque))
    : (pp.line ?? 240) / 240;
  const hLigne = hauteurLigne({ ...(styleRef?.s ?? marque), sz: tailleMax }) * lh;

  const blocs: Bloc[] = [];
  const num = marqueur(ctx, pp);
  // Découpe en lignes visuelles sur les sauts de page ; les images deviennent des blocs.
  let courant: Morceau[] = [];
  let sautApres = false;
  const vider = () => {
    const textes = courant.filter((m) => m.k !== "image");
    const aTexte = textes.some((m) => (m.k === "texte" && m.t.trim()) || m.k === "champ");
    if (!aTexte && !textes.some((m) => m.k === "tab")) { courant = []; return; }
    const largeurTexte = largeurDispo - gauche - droite;
    let c: Content;
    let nbLignes = 1;
    if (textes.some((m) => m.k === "tab")) {
      // Tabulations : chaque segment est placé sur le taquet suivant (taquets du Word, sinon taquets par défaut).
      const segments: Morceau[][] = [[]];
      for (const m of textes) { if (m.k === "tab") segments.push([]); else if (m.k !== "ligne") segments.at(-1)!.push(m); }
      const taquets = [...(pp.tabs ?? [])].sort((a, b) => a.pos - b.pos);
      const colonnes: Content[] = [];
      let x = gauche;
      segments.forEach((seg, i) => {
        const runs = seg.filter((m) => m.k === "texte" || m.k === "champ") as (Morceau & { k: "texte" | "champ" })[];
        const w = runs.reduce((s, m) => s + largeur(m.k === "champ" ? "00" : m.t, m.s), 0);
        let debut = x;
        if (i > 0) {
          const t = taquets.find((t) => t.pos > x + 0.5);
          if (t && t.val !== "bar") {
            debut = t.val === "right" || t.val === "end" ? t.pos - w : t.val === "center" ? t.pos - w / 2 : t.pos;
          } else {
            debut = (Math.floor(x / ctx.tabDefaut + 1e-6) + 1) * ctx.tabDefaut;
          }
          debut = Math.max(debut, x);
        }
        if (debut > x) colonnes.push({ width: debut - x, text: "" });
        const dernier = i === segments.length - 1;
        colonnes.push(dernier ? { width: "*", text: runs.map(texteMorceau) } : { width: Math.max(w + 1, 1), text: runs.map(texteMorceau), noWrap: true });
        x = debut + w;
      });
      c = { columns: colonnes, columnGap: 0, margin: [0, 0, droite, 0], lineHeight: lh };
    } else {
      const runs: Content[] = [];
      if (num) runs.push({ text: `${num}  `, font: marque.fam, fontSize: marque.sz });
      for (const m of textes) {
        if (m.k === "ligne") runs.push({ text: "\n" });
        else if (m.k === "texte" || m.k === "champ") runs.push(texteMorceau(m));
      }
      const sansLigne = textes.filter((m) => m.k === "texte" || m.k === "champ") as (Morceau & { k: "texte" | "champ" })[];
      nbLignes = lignes(sansLigne, largeurTexte) + textes.filter((m) => m.k === "ligne").length;
      c = {
        text: runs, alignment: alignement, lineHeight: lh, preserveLeadingSpaces: true,
        leadingIndent: pp.firstLine && !pp.hanging ? pp.firstLine : undefined,
        margin: [gauche, 0, droite, 0],
      };
    }
    blocs.push({ c, h: nbLignes * hLigne });
    courant = [];
  };
  /** Position horizontale atteinte par une suite de morceaux (tabulations et texte), depuis la marge. */
  const positionApres = (liste: Morceau[]) => {
    const taquets = [...(pp.tabs ?? [])].sort((a, b) => a.pos - b.pos);
    let x = gauche;
    for (const m of liste) {
      if (m.k === "tab") {
        const t = taquets.find((t) => t.pos > x + 0.5 && (t.val === "left" || t.val === "start"));
        x = t ? t.pos : (Math.floor(x / ctx.tabDefaut + 1e-6) + 1) * ctx.tabDefaut;
      } else if (m.k === "texte") x += largeur(m.t, m.s);
    }
    return x;
  };
  for (const m of ms) {
    if (m.k === "page") { vider(); sautApres = true; continue; }
    if (m.k === "image") {
      // Image précédée seulement de tabulations/espaces : placée à la position du taquet (ex. signature).
      const seulementTabs = courant.every((c) => c.k === "tab" || (c.k === "texte" && !c.t.trim()));
      const x = seulementTabs ? positionApres(courant) : gauche;
      if (seulementTabs) courant = []; else vider();
      const decale = seulementTabs && x > gauche + 0.5;
      const r = Math.min(1, (largeurDispo - x) / m.w);
      blocs.push({
        c: { image: m.data, width: m.w * r, height: m.h * r, alignment: m.dx || decale ? "left" : alignement, margin: [(decale ? x : gauche) + m.dx, 0, 0, 0] },
        h: m.h * r,
      });
      continue;
    }
    courant.push(m);
  }
  vider();
  if (!blocs.length) blocs.push({ c: { text: " ", font: marque.fam, fontSize: marque.sz, lineHeight: lh }, h: hauteurLigne(marque) * lh });

  // Bordures haute/basse du paragraphe (ex. trait sous l'en-tête).
  const trait = (t: Trait, espaceAvant: number, espaceApres: number): Bloc => ({
    c: { canvas: [{ type: "line", x1: gauche, y1: 0, x2: largeurDispo - droite, y2: 0, lineWidth: t.w, lineColor: t.color }], margin: [0, espaceAvant, 0, espaceApres] },
    h: t.w + espaceAvant + espaceApres,
  });
  if (pp.bordHaut) blocs.unshift(trait(pp.bordHaut, 0, pp.bordHaut.espace));
  if (pp.bordBas) blocs.push(trait(pp.bordBas, pp.bordBas.espace, 0));

  // Espacements avant/après sur l'ensemble du paragraphe.
  const total = blocs.reduce((s, b) => s + b.h, 0) + avant + apres;
  const pile: Content = { stack: blocs.map((b) => b.c), margin: [0, avant, 0, apres] };
  if (pp.pageBreakBefore) (pile as { pageBreak?: string }).pageBreak = "before";
  if (sautApres) (pile as { pageBreak?: string }).pageBreak = "after";
  return [{ c: pile, h: total }];
}

type Cotes = Partial<Record<"top" | "left" | "bottom" | "right" | "insideH" | "insideV", Trait | null>>;
const COTES = ["top", "left", "bottom", "right", "insideH", "insideV"] as const;
const lireCotes = (e: XEl | null): Cotes => {
  const out: Cotes = {};
  for (const c of COTES) {
    const v = lireTrait(enfant(e, c) ?? (c === "left" ? enfant(e, "start") : c === "right" ? enfant(e, "end") : null));
    if (v !== undefined) out[c] = v;
  }
  return out;
};

/** Bordures du tableau : style (et ses parents), puis bordures propres au tableau, côté par côté. */
function bordures(ctx: Ctx, tbl: XEl): Cotes {
  const tblPr = enfant(tbl, "tblPr");
  const chaine: Cotes[] = [];
  let id = at(enfant(tblPr, "tblStyle"), "val") ?? undefined;
  const vus = new Set<string>();
  while (id && !vus.has(id)) {
    vus.add(id);
    const st = ctx.styles.get(id);
    if (st?.tblBorders) chaine.unshift(lireCotes(st.tblBorders));
    id = st?.basedOn;
  }
  return Object.assign({}, ...chaine, lireCotes(enfant(tblPr, "tblBorders")));
}

function tableau(ctx: Ctx, rels: Map<string, string>, tbl: XEl, largeurDispo: number): Bloc {
  const tblPr = enfant(tbl, "tblPr");
  let cols = enfants(enfant(tbl, "tblGrid"), "gridCol").map((g) => tw(at(g, "w")) ?? 0);
  const total = cols.reduce((s, c) => s + c, 0);
  if (!cols.length) cols = [largeurDispo];
  else if (total > largeurDispo) cols = cols.map((c) => (c * largeurDispo) / total);
  const mar = enfant(tblPr, "tblCellMar");
  const padG = tw(at(enfant(mar, "left") ?? enfant(mar, "start"), "w")) ?? 5.4;
  const padD = tw(at(enfant(mar, "right") ?? enfant(mar, "end"), "w")) ?? 5.4;
  const bords = bordures(ctx, tbl);
  const lignesTr = enfants(tbl, "tr");
  let epaisseur = 0;

  const corps: Content[][] = [];
  const fusions: ({ rowSpan?: number } & Record<string, unknown>)[] = [];
  const hauteurs: number[] = [];
  lignesTr.forEach((tr, iLigne) => {
    const ligne: Content[] = [];
    let col = 0, hMax = 0;
    for (const tc of enfants(tr, "tc")) {
      const tcPr = enfant(tc, "tcPr");
      const span = Number(at(enfant(tcPr, "gridSpan"), "val") ?? 1);
      const vm = enfant(tcPr, "vMerge");
      const larg = cols.slice(col, col + span).reduce((s, c) => s + c, 0);
      if (vm && at(vm, "val") !== "restart") {
        const origine = fusions[col];
        if (origine) origine.rowSpan = (origine.rowSpan ?? 1) + 1;
        ligne.push({});
        for (let k = 1; k < span; k++) ligne.push({});
        col += span;
        continue;
      }
      const contenu = blocs(ctx, rels, tc, Math.max(10, larg - padG - padD));
      const fond = at(enfant(tcPr, "shd"), "fill");
      // Bordures de la cellule : tableau (extérieur ou intérieur selon la position), puis cellule.
      const propres = lireCotes(enfant(tcPr, "tcBorders"));
      const choisir = (c: "top" | "left" | "bottom" | "right", interieur: "insideH" | "insideV", auBord: boolean) =>
        propres[c] !== undefined ? propres[c] : auBord ? bords[c] : bords[interieur];
      const traits = [
        choisir("left", "insideV", col === 0), choisir("top", "insideH", iLigne === 0),
        choisir("right", "insideV", col + span >= cols.length), choisir("bottom", "insideH", iLigne === lignesTr.length - 1),
      ];
      for (const t of traits) if (t) epaisseur = Math.max(epaisseur, t.w);
      const cellule: Record<string, unknown> = {
        stack: contenu.map((b) => b.c), colSpan: span > 1 ? span : undefined, fillColor: fond && fond !== "auto" ? `#${fond}` : undefined,
        border: traits.map((t) => !!t), borderColor: traits.map((t) => t?.color ?? "#000000"),
      };
      hMax = Math.max(hMax, contenu.reduce((s, b) => s + b.h, 0));
      ligne.push(definis(cellule) as Content);
      for (let k = 0; k < span; k++) fusions[col + k] = k === 0 ? (cellule as { rowSpan?: number }) : (undefined as never);
      for (let k = 1; k < span; k++) ligne.push({});
      col += span;
    }
    while (ligne.length < cols.length) ligne.push({});
    const hMin = tw(at(enfant(enfant(tr, "trPr"), "trHeight"), "val")) ?? 0;
    hauteurs.push(Math.max(hMax + 2, hMin));
    corps.push(ligne.slice(0, cols.length));
  });
  const t: Content = {
    table: { widths: cols, body: corps.length ? corps : [[{ text: "" }]] },
    layout: {
      hLineWidth: () => epaisseur || 0.5, vLineWidth: () => epaisseur || 0.5,
      paddingLeft: () => padG, paddingRight: () => padD, paddingTop: () => 1, paddingBottom: () => 1,
    },
  };
  const jc = at(enfant(tblPr, "jc"), "val");
  const largeurTable = cols.reduce((s, c) => s + c, 0);
  const c: Content = jc === "center" && largeurTable < largeurDispo - 1
    ? { columns: [{ width: "*", text: "" }, { width: largeurTable, stack: [t] }, { width: "*", text: "" }], columnGap: 0 } as Content
    : t;
  return { c, h: hauteurs.reduce((s, h) => s + h, 0) };
}

/** Rend le contenu d'un conteneur (corps, cellule, en-tête…) en blocs pdfmake. */
function blocs(ctx: Ctx, rels: Map<string, string>, conteneur: XEl, largeurDispo: number): Bloc[] {
  const out: Bloc[] = [];
  for (const n of enfants(conteneur)) {
    if (n.localName === "p") out.push(...paragraphe(ctx, rels, n, largeurDispo));
    else if (n.localName === "tbl") out.push(tableau(ctx, rels, n, largeurDispo));
    else if (n.localName === "sdt" || n.localName === "customXml") out.push(...blocs(ctx, rels, enfant(n, "sdtContent") ?? n, largeurDispo));
  }
  return out;
}

function partie(ctx: Ctx, rels: Map<string, string>, id: string | null, largeurDispo: number) {
  const cible = id ? rels.get(id) : undefined;
  const racine = cible ? lireXml(ctx.zip, cible) : null;
  if (!racine) return null;
  const b = blocs(ctx, relations(ctx, cible!), racine, largeurDispo);
  const vide = b.every((x) => JSON.stringify(x.c).replace(/\\u00a0| /g, "").match(/"text":"[^"]+"|"image"/) === null);
  return vide ? null : { contenu: b.map((x) => x.c), h: b.reduce((s, x) => s + x.h, 0) };
}

const remplacerPages = (c: Content[], page: number, total: number) =>
  JSON.parse(JSON.stringify(c).split(MARQUE_PAGE).join(String(page)).split(MARQUE_TOTAL).join(String(total))) as Content[];

/** Convertit un document Word (.docx) en PDF. */
export async function convertirDocxEnPdf(docx: Buffer): Promise<Buffer> {
  const zip = new PizZip(docx);
  const ctx = preparer(zip);
  const doc = lireXml(zip, "word/document.xml");
  const corps = enfant(doc, "body");
  if (!corps) throw new Error("Document Word illisible.");
  const sect = enfants(corps, "sectPr").at(-1) ?? null;
  const pgSz = enfant(sect, "pgSz"), pgMar = enfant(sect, "pgMar");
  const W = tw(at(pgSz, "w")) ?? 595.3, H = tw(at(pgSz, "h")) ?? 841.9;
  const haut = tw(at(pgMar, "top")) ?? 72, bas = tw(at(pgMar, "bottom")) ?? 72;
  const gauche = tw(at(pgMar, "left")) ?? 72, droite = tw(at(pgMar, "right")) ?? 72;
  const distEntete = tw(at(pgMar, "header")) ?? 35.4, distPied = tw(at(pgMar, "footer")) ?? 35.4;
  const largeurUtile = W - gauche - droite;

  const rels = relations(ctx, "word/document.xml");
  const ref = (type: "header" | "footer", t: string) =>
    enfants(sect, `${type}Reference`).find((r) => at(r, "type") === t)?.getAttribute("r:id") ?? null;
  const premiere = bascule(enfant(sect, "titlePg")) ?? false;
  const entete = partie(ctx, rels, ref("header", "default"), largeurUtile);
  const entete1 = premiere ? partie(ctx, rels, ref("header", "first"), largeurUtile) : entete;
  const pied = partie(ctx, rels, ref("footer", "default"), largeurUtile);
  const pied1 = premiere ? partie(ctx, rels, ref("footer", "first"), largeurUtile) : pied;

  // Word repousse le texte sous l'en-tête et au-dessus du pied de page s'ils sont plus grands que les marges.
  const hEntete = Math.max(entete?.h ?? 0, entete1?.h ?? 0);
  const hPied = Math.max(pied?.h ?? 0, pied1?.h ?? 0);
  const margeHaut = hEntete ? Math.max(haut, distEntete + hEntete + 6) : haut;
  const margeBas = hPied ? Math.max(bas, distPied + hPied + 6) : bas;

  const contenu = blocs(ctx, rels, corps, largeurUtile).map((b) => b.c);
  const normal = versStyle({ ...ctx.defaults.rp, ...chaineStyle(ctx, ctx.styleParDefaut).rp });
  const definition = {
    pageSize: { width: W, height: H },
    pageMargins: [gauche, margeHaut, droite, margeBas],
    defaultStyle: { font: normal.fam, fontSize: normal.sz },
    content: contenu,
    header: (page: number, total: number) => {
      const e = page === 1 ? entete1 : entete;
      return e ? { stack: remplacerPages(e.contenu, page, total), margin: [gauche, distEntete, droite, 0] } : null;
    },
    footer: (page: number, total: number) => {
      const p = page === 1 ? pied1 : pied;
      return p ? { stack: remplacerPages(p.contenu, page, total), margin: [gauche, Math.max(0, margeBas - distPied - p.h), droite, 0] } : null;
    },
  };
  return Buffer.from(await pdfmake.createPdf(definition as unknown as TDocumentDefinitions).getBuffer());
}
