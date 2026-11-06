import "server-only";
import path from "node:path";
import mammoth from "mammoth";
import htmlToPdfmake from "html-to-pdfmake";
import { JSDOM } from "jsdom";
import PizZip from "pizzip";
import pdfmake from "pdfmake";
import type { Content } from "pdfmake/interfaces";

/**
 * Conversion Word (.docx) → PDF en JavaScript pur, sans logiciel externe.
 * 1. mammoth lit le Word et le transforme en HTML (titres, gras/italique, listes, tableaux, images) ;
 * 2. html-to-pdfmake et pdfmake mettent ce contenu en page dans un PDF A4.
 * La mise en page est proche du Word mais pas identique (police, espacements exacts).
 */

const polices = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");
pdfmake.setFonts({
  Roboto: {
    normal: path.join(polices, "Roboto-Regular.ttf"),
    bold: path.join(polices, "Roboto-Medium.ttf"),
    italics: path.join(polices, "Roboto-Italic.ttf"),
    bolditalics: path.join(polices, "Roboto-MediumItalic.ttf"),
  },
});
// Les images viennent du Word (data:…) ; aucun accès réseau ni disque à partir du document.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((chemin: string) => chemin.startsWith(polices));

const LARGEUR_UTILE = 595.28 - 2 * 56; // A4 moins les marges, en points

/** Tailles des images du corps du Word (en points), dans l'ordre du document. */
function taillesImages(docx: Buffer): { w: number; h: number }[] {
  try {
    const xml = new PizZip(docx).file("word/document.xml")?.asText() ?? "";
    return [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => ({ w: Number(m[1]) / 12700, h: Number(m[2]) / 12700 }));
  } catch {
    return [];
  }
}

/** Applique aux images du PDF la taille qu'elles ont dans le Word (sans dépasser la largeur de la page). */
function dimensionnerImages(noeud: unknown, tailles: { w: number; h: number }[], i = { n: 0 }) {
  if (Array.isArray(noeud)) { for (const x of noeud) dimensionnerImages(x, tailles, i); return; }
  if (!noeud || typeof noeud !== "object") return;
  const o = noeud as Record<string, unknown>;
  if (typeof o.image === "string") {
    const t = tailles[i.n++];
    delete o.width; delete o.height;
    if (t) {
      const r = Math.min(1, LARGEUR_UTILE / t.w);
      o.width = t.w * r; o.height = t.h * r;
    } else {
      o.fit = [LARGEUR_UTILE, 400];
    }
  }
  for (const v of Object.values(o)) if (v && typeof v === "object") dimensionnerImages(v, tailles, i);
}

const STYLES_WORD = [
  "p[style-name='Title'] => h1.titre:fresh",
  "p[style-name='Titre'] => h1.titre:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Sous-titre'] => h2:fresh",
  "p[style-name='Titre 1'] => h1:fresh",
  "p[style-name='Titre 2'] => h2:fresh",
  "p[style-name='Titre 3'] => h3:fresh",
];

/** Convertit un document Word (.docx) en PDF. */
export async function wordEnPdf(docx: Buffer): Promise<Buffer> {
  const { value: html } = await mammoth.convertToHtml(
    { buffer: docx },
    {
      styleMap: STYLES_WORD,
      // Images intégrées au PDF depuis le Word.
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    },
  );
  const { window } = new JSDOM("");
  const contenu = htmlToPdfmake(html || "<p></p>", {
    window,
    imagesByReference: false,
    defaultStyles: {
      p: { margin: [0, 0, 0, 6] },
      h1: { fontSize: 18, bold: true, margin: [0, 10, 0, 8] },
      h2: { fontSize: 14, bold: true, margin: [0, 8, 0, 6] },
      h3: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
      table: { margin: [0, 4, 0, 10] },
      th: { bold: true, fillColor: "#f5f5f4" },
    },
  }) as Content;
  dimensionnerImages(contenu, taillesImages(docx));
  const doc = pdfmake.createPdf({
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    content: contenu,
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25 },
  });
  return Buffer.from(await doc.getBuffer());
}
