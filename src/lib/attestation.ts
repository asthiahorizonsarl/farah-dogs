import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type Versement = { type: "cotisation" | "don"; date: string | null; centimes: number };
export type DonneesAttestation = {
  annee: number;
  langue: "fr" | "de";
  destinataire: { politesse: string | null; nom: string | null; prenom: string | null; societe: string | null; adresse: string | null; npaLocalite: string | null; pays: string | null };
  versements: Versement[];
  association: { nom: string; adresse: string | null; npaLocalite: string | null; email: string | null; telephone: string | null;
    iban: string | null; signataire: string | null; fonctionSignataire: string | null; lieuSignature: string | null; mentionAttestation: string | null };
};

const TXT = {
  fr: {
    titre: (c: boolean, d: boolean, a: number) => `Attestation ${c && d ? "de cotisation et de don" : c ? "de cotisation" : "de don"} ${a}`,
    intro: (nom: string, a: number) => `Nous attestons avoir reçu de ${nom} les montants suivants au titre de l'année ${a} :`,
    cols: ["Nature", "Date de versement", "Montant"],
    cotisation: "Cotisation annuelle", don: "Don", total: "Total",
    merci: "Nous vous remercions chaleureusement de votre précieux soutien, qui permet de former et de remettre des chiens d'assistance.",
    le: "le", mois: "fr-CH",
  },
  de: {
    titre: (c: boolean, d: boolean, a: number) => `${c && d ? "Bestätigung Mitgliederbeitrag und Spende" : c ? "Bestätigung Mitgliederbeitrag" : "Spendenbestätigung"} ${a}`,
    intro: (nom: string, a: number) => `Wir bestätigen, von ${nom} folgende Beträge für das Jahr ${a} erhalten zu haben:`,
    cols: ["Art", "Zahlungsdatum", "Betrag"],
    cotisation: "Jahresbeitrag", don: "Spende", total: "Total",
    merci: "Wir danken Ihnen herzlich für Ihre wertvolle Unterstützung, die die Ausbildung und Übergabe von Assistenzhunden ermöglicht.",
    le: "den", mois: "de-CH",
  },
};

const ROUGE = rgb(0.894, 0.027, 0.157);
const NOIR = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.45, 0.45, 0.45);
const LIGNE = rgb(0.88, 0.88, 0.88);

/** Les polices standard PDF ne connaissent que le jeu WinAnsi : on remplace le reste proprement. */
function sur(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[   ]/g, " ")
    .replace(/[‘‛]/g, "'")
    .replace(/[^\u0000-ÿ’“”–—…€]/g, (ch) => ch.normalize("NFD").replace(/[̀-ͯ]/g, "") || "?");
}
const chf = (c: number) => sur(new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(c / 100));
const date = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "—");

function texte(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color = NOIR) {
  page.drawText(sur(s), { x, y, size, font, color });
}
function droite(page: PDFPage, s: string, xDroite: number, y: number, font: PDFFont, size: number, color = NOIR) {
  const v = sur(s);
  page.drawText(v, { x: xDroite - font.widthOfTextAtSize(v, size), y, size, font, color });
}
/** Texte sur plusieurs lignes dans une largeur donnée. Renvoie la position y suivante. */
function paragraphe(page: PDFPage, s: string, x: number, y: number, largeur: number, font: PDFFont, size: number, color = NOIR, interligne = 1.45) {
  for (const bloc of sur(s).split("\n")) {
    let ligne = "";
    for (const mot of bloc.split(/\s+/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (font.widthOfTextAtSize(essai, size) > largeur && ligne) {
        page.drawText(ligne, { x, y, size, font, color });
        y -= size * interligne;
        ligne = mot;
      } else ligne = essai;
    }
    if (ligne) { page.drawText(ligne, { x, y, size, font, color }); y -= size * interligne; }
  }
  return y;
}

export async function genererAttestation(d: DonneesAttestation): Promise<Uint8Array> {
  const L = TXT[d.langue];
  const pdf = await PDFDocument.create();
  pdf.setTitle(sur(L.titre(true, true, d.annee)));
  pdf.setAuthor(sur(d.association.nom));
  const page = pdf.addPage([595.28, 841.89]); // A4
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 56; // marge
  const W = 595.28 - 2 * M;

  // Bandeau rouge + logo
  page.drawRectangle({ x: 0, y: 841.89 - 6, width: 595.28, height: 6, color: ROUGE });
  try {
    const png = await pdf.embedPng(await readFile(path.join(process.cwd(), "public/brand/logo.png")));
    page.drawImage(png, { x: M - 6, y: 841.89 - 140, width: 110, height: 110 });
  } catch {
    texte(page, d.association.nom, M, 841.89 - 80, bold, 16, ROUGE);
  }

  // Expéditeur (en haut à droite)
  const a = d.association;
  let y = 841.89 - 60;
  for (const [s, f] of [[a.nom, bold], [a.adresse, reg], [a.npaLocalite, reg], [a.email, reg], [a.telephone, reg]] as const) {
    if (!s) continue;
    droite(page, s, M + W, y, f, 9, f === bold ? NOIR : GRIS);
    y -= 13;
  }

  // Destinataire (fenêtre d'enveloppe suisse, à droite)
  const r = d.destinataire;
  const nomComplet = [r.prenom, r.nom].filter(Boolean).join(" ").replace(/\n/g, " ");
  y = 841.89 - 190;
  const xDest = 330;
  for (const s of [r.politesse, r.societe?.split("\n")[0], nomComplet || null, ...(r.adresse?.split("\n") ?? []), r.npaLocalite,
    r.pays && r.pays !== "CH" ? r.pays : null]) {
    if (!s) continue;
    texte(page, s, xDest, y, reg, 10.5);
    y -= 14;
  }

  // Lieu et date
  y = 841.89 - 320;
  const auj = new Date().toLocaleDateString(L.mois, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
  droite(page, `${a.lieuSignature ?? ""}${a.lieuSignature ? ", " : ""}${L.le} ${auj}`, M + W, y, reg, 10, GRIS);

  // Titre
  const aCoti = d.versements.some((v) => v.type === "cotisation");
  const aDon = d.versements.some((v) => v.type === "don");
  y -= 40;
  texte(page, L.titre(aCoti, aDon, d.annee), M, y, bold, 17);
  page.drawRectangle({ x: M, y: y - 9, width: 42, height: 3, color: ROUGE });

  // Introduction
  y -= 36;
  const nomIntro = [r.politesse, nomComplet || r.societe?.replace(/\n/g, " ")].filter(Boolean).join(" ");
  y = paragraphe(page, L.intro(nomIntro, d.annee), M, y, W, reg, 10.5);

  // Tableau
  y -= 14;
  const cx = [M, M + 250, M + W];
  page.drawRectangle({ x: M, y: y - 7, width: W, height: 24, color: rgb(0.965, 0.96, 0.955) });
  texte(page, L.cols[0], cx[0] + 10, y, bold, 9, GRIS);
  texte(page, L.cols[1], cx[1], y, bold, 9, GRIS);
  droite(page, L.cols[2], cx[2] - 10, y, bold, 9, GRIS);
  y -= 28;
  const tries = [...d.versements].sort((p, q) => (p.type === q.type ? (p.date ?? "").localeCompare(q.date ?? "") : p.type === "cotisation" ? -1 : 1));
  for (const v of tries) {
    texte(page, v.type === "cotisation" ? L.cotisation : L.don, cx[0] + 10, y, reg, 10.5);
    texte(page, date(v.date), cx[1], y, reg, 10.5);
    droite(page, chf(v.centimes), cx[2] - 10, y, reg, 10.5);
    page.drawLine({ start: { x: M, y: y - 9 }, end: { x: M + W, y: y - 9 }, thickness: 0.6, color: LIGNE });
    y -= 26;
  }
  const total = d.versements.reduce((s, v) => s + v.centimes, 0);
  texte(page, L.total, cx[0] + 10, y, bold, 11);
  droite(page, chf(total), cx[2] - 10, y, bold, 11, ROUGE);
  page.drawLine({ start: { x: M, y: y - 9 }, end: { x: M + W, y: y - 9 }, thickness: 1.2, color: NOIR });

  // Mention et remerciements
  y -= 44;
  if (a.mentionAttestation) y = paragraphe(page, a.mentionAttestation, M, y, W, reg, 9.5, GRIS) - 8;
  y = paragraphe(page, L.merci, M, y, W, reg, 10.5);

  // Signature
  y -= 30;
  texte(page, a.nom, M + W - 200, y, bold, 10.5);
  if (a.signataire) { y -= 46; texte(page, a.signataire, M + W - 200, y, reg, 10.5); }
  if (a.fonctionSignataire) { y -= 14; texte(page, a.fonctionSignataire, M + W - 200, y, reg, 9.5, GRIS); }

  // Pied de page
  const pied = [a.nom, [a.adresse, a.npaLocalite].filter(Boolean).join(", "), a.iban ? `IBAN ${a.iban}` : null].filter(Boolean).join("  ·  ");
  page.drawLine({ start: { x: M, y: 50 }, end: { x: M + W, y: 50 }, thickness: 0.6, color: LIGNE });
  const p = sur(pied);
  texte(page, p, M + (W - reg.widthOfTextAtSize(p, 8)) / 2, 36, reg, 8, GRIS);

  return pdf.save();
}
