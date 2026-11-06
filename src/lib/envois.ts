import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import nodemailer from "nodemailer";
import { db, schema } from "@/db";
import { wordEnPdf } from "./pdf";
import { getAssociation } from "./data";

/**
 * Types de documents. Un seul modèle Word et un seul e-mail par type, toutes langues dans le même document.
 * Tous les envois sont déclenchés à la main (bouton par personne ou « envoyer à tous »).
 */
export const TYPES_DOC = {
  cotisation: { titre: "Attestation de cotisation", aide: "Membres dont la cotisation de l'année est payée." },
  don: { titre: "Don jusqu'au seuil — attestation et remerciements", aide: "Donateurs dont le total de l'année est inférieur ou égal au seuil." },
  don_grand: { titre: "Don au-dessus du seuil — attestation", aide: "Donateurs au-dessus du seuil. Sans modèle propre, celui des dons jusqu'au seuil est utilisé." },
  demande: { titre: "Demande de cotisation / don", aide: "Membres dont la cotisation de l'année n'est pas encore payée." },
} as const;
export type TypeDoc = keyof typeof TYPES_DOC;
export const estTypeDoc = (v: unknown): v is TypeDoc => typeof v === "string" && v in TYPES_DOC;

/** Variables utilisables dans les modèles Word et les e-mails, sous la forme {{nom}}. */
export const VARIABLES: { nom: string; description: string }[] = [
  { nom: "politesse", description: "Forme de politesse de la fiche (Madame, Herr, Famiglia…)" },
  { nom: "prenom", description: "Prénom" },
  { nom: "nom", description: "Nom" },
  { nom: "nom_complet", description: "Prénom et nom" },
  { nom: "societe", description: "Société" },
  { nom: "adresse", description: "Rue (plusieurs lignes possibles)" },
  { nom: "npa", description: "Code postal" },
  { nom: "localite", description: "Localité" },
  { nom: "npa_localite", description: "Code postal et localité" },
  { nom: "pays", description: "Pays" },
  { nom: "email", description: "E-mail du membre" },
  { nom: "langues", description: "Langues parlées par le membre" },
  { nom: "annee", description: "Année concernée" },
  { nom: "montant_cotisation", description: "Cotisation payée dans l'année" },
  { nom: "date_cotisation", description: "Date de paiement de la cotisation" },
  { nom: "cotisation_annee", description: "Montant de la cotisation de l'année (demande)" },
  { nom: "montant_don", description: "Total des dons de l'année" },
  { nom: "nombre_dons", description: "Nombre de dons dans l'année" },
  { nom: "dates_dons", description: "Dates des dons (séparées par des virgules)" },
  { nom: "date_dernier_don", description: "Date du dernier don" },
  { nom: "montant_total", description: "Cotisation + dons de l'année" },
  { nom: "seuil", description: "Seuil des dons (Paramètres)" },
  { nom: "date_du_jour", description: "Date du jour (06.11.2026)" },
  { nom: "date_du_jour_fr", description: "Date du jour en français (6 novembre 2026)" },
  { nom: "date_du_jour_de", description: "Date du jour en allemand (6. November 2026)" },
  { nom: "date_du_jour_it", description: "Date du jour en italien (6 novembre 2026)" },
  { nom: "association_nom", description: "Nom de l'association" },
  { nom: "association_adresse", description: "Adresse de l'association" },
  { nom: "association_npa_localite", description: "NPA et localité de l'association" },
  { nom: "association_email", description: "E-mail de l'association" },
  { nom: "association_telephone", description: "Téléphone de l'association" },
  { nom: "iban", description: "IBAN de l'association" },
  { nom: "signataire", description: "Signataire" },
  { nom: "fonction_signataire", description: "Fonction du signataire" },
  { nom: "lieu_signature", description: "Lieu de signature" },
];

const chf = (c: number) => new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(c / 100);
const dateCourte = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "");
const dateLongue = (locale: string) => new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });

export async function getParametresEnvoi() {
  const [p] = await db.select().from(schema.parametresEnvoi).where(eq(schema.parametresEnvoi.id, 1));
  return p ?? {
    id: 1, seuilCentimes: 10000, smtpHote: null, smtpPort: 587, smtpSecurite: "starttls", smtpUtilisateur: null,
    smtpMotDePasse: null, expediteurNom: null, expediteurEmail: null, copieCachee: null, pieceJointe: "word",
  };
}

/** Remplace les {{variables}} d'un texte. Les variables inconnues sont laissées vides. */
export function remplir(texte: string, vars: Record<string, string>) {
  return texte.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Contrôle qu'un fichier .docx est un modèle valide et renvoie ses variables. */
export function verifierModeleWord(contenu: Buffer) {
  const doc = new Docxtemplater(new PizZip(contenu), { delimiters: { start: "{{", end: "}}" }, paragraphLoop: true, linebreaks: true });
  return [...new Set([...doc.getFullText().matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
}

function remplirWord(base64: string, vars: Record<string, string>): Buffer {
  const doc = new Docxtemplater(new PizZip(Buffer.from(base64, "base64")), {
    delimiters: { start: "{{", end: "}}" }, paragraphLoop: true, linebreaks: true, nullGetter: () => "",
  });
  doc.render(vars);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

// ——— Destinataires ———

async function contactsAvecDetails(ids: number[]) {
  if (!ids.length) return [];
  return db.query.contacts.findMany({
    where: inArray(schema.contacts.id, ids),
    with: { formePolitesse: true, langues: { with: { langue: true } } },
  });
}

/**
 * Personnes concernées par un type de document pour une année, avec leurs montants et le dernier envoi.
 * Pour les dons, le type (don / don_grand) dépend du total de l'année par rapport au seuil.
 */
export async function getDestinataires(type: TypeDoc | "dons", annee: number) {
  const p = await getParametresEnvoi();
  const [cotis, dons, [an]] = await Promise.all([
    db.select().from(schema.cotisations).where(eq(schema.cotisations.annee, annee)).orderBy(asc(schema.cotisations.datePaiement)),
    db.select().from(schema.dons).where(and(eq(schema.dons.annee, annee), sql`${schema.dons.montantCentimes} > 0`)).orderBy(asc(schema.dons.dateDon)),
    db.select().from(schema.annees).where(eq(schema.annees.annee, annee)),
  ]);
  const payee = (c: (typeof cotis)[number]) => (c.montantCentimes ?? 0) > 0;

  let ids: number[];
  if (type === "cotisation") ids = cotis.filter(payee).map((c) => c.contactId);
  else if (type === "demande") ids = cotis.filter((c) => c.montantCentimes === null && !c.datePaiement).map((c) => c.contactId);
  else ids = dons.map((d) => d.contactId);
  ids = [...new Set(ids)];
  // Une demande ne part pas à qui a déjà payé une autre ligne de l'année.
  if (type === "demande") ids = ids.filter((id) => !cotis.some((c) => c.contactId === id && payee(c)));

  const [contacts, journal] = await Promise.all([
    contactsAvecDetails(ids),
    ids.length ? db.select().from(schema.envois).where(and(eq(schema.envois.annee, annee), inArray(schema.envois.contactId, ids))).orderBy(asc(schema.envois.le)) : [],
  ]);

  return contacts.map((c) => {
    const sesCotis = cotis.filter((x) => x.contactId === c.id && payee(x));
    const sesDons = dons.filter((x) => x.contactId === c.id);
    const totalCoti = sesCotis.reduce((s, x) => s + x.montantCentimes!, 0);
    const totalDons = sesDons.reduce((s, x) => s + x.montantCentimes!, 0);
    const typeDoc: TypeDoc = type === "dons" || type === "don" || type === "don_grand" ? (totalDons <= p.seuilCentimes ? "don" : "don_grand") : type;
    const historique = journal.filter((e) => e.contactId === c.id && e.categorie === typeDoc);
    const email = c.email?.split(/[\s;,]+/).find((e) => e.includes("@")) ?? null;
    return {
      contact: c, email, type: typeDoc, annee, seuil: p.seuilCentimes,
      totalCoti, totalDons, cotisationAnnee: an?.cotisationDefautCentimes ?? null,
      dateCotisation: sesCotis.at(-1)?.datePaiement ?? null,
      datesDons: sesDons.map((d) => d.dateDon).filter(Boolean) as string[],
      langues: c.langues.map((l) => l.langue).sort((a, b) => a.ordre - b.ordre),
      dernierEnvoi: historique.at(-1) ?? null,
      dejaFait: historique.some((e) => e.statut === "envoyé" || e.statut === "généré"),
      versements: [
        ...(typeDoc === "demande" ? [] : sesCotis.map((x) => ({ type: "cotisation" as const, date: x.datePaiement, centimes: x.montantCentimes! }))),
        ...(typeDoc === "cotisation" || typeDoc === "demande" ? [] : sesDons.map((x) => ({ type: "don" as const, date: x.dateDon, centimes: x.montantCentimes! }))),
      ],
    };
  }).sort((a, b) => (a.contact.nom ?? a.contact.societe ?? "").localeCompare(b.contact.nom ?? b.contact.societe ?? "", "fr"));
}
export type Destinataire = Awaited<ReturnType<typeof getDestinataires>>[number];

export async function getDestinataire(type: TypeDoc, contactId: number, annee: number) {
  const liste = await getDestinataires(type === "don" || type === "don_grand" ? "dons" : type, annee);
  return liste.find((d) => d.contact.id === contactId) ?? null;
}

// ——— Documents ———

/** Modèle Word du type (pour don_grand : à défaut, celui des dons jusqu'au seuil). */
async function modelePour(type: TypeDoc) {
  const ordre = type === "don_grand" ? ["don_grand", "don"] : [type];
  const modeles = await db.select().from(schema.modelesWord).where(inArray(schema.modelesWord.categorie, ordre));
  for (const t of ordre) {
    const m = modeles.find((x) => x.categorie === t);
    if (m) return m;
  }
  return null;
}

async function variables(d: Destinataire) {
  const a = await getAssociation();
  const c = d.contact;
  return {
    politesse: c.formePolitesse?.libelle ?? "", prenom: c.prenom ?? "", nom: c.nom ?? "",
    nom_complet: [c.prenom, c.nom].filter(Boolean).join(" ").replace(/\n/g, " ") || (c.societe ?? "").replace(/\n/g, " "),
    societe: c.societe ?? "", adresse: c.adresse ?? "", npa: c.codePostal ?? "", localite: c.localite ?? "",
    npa_localite: [c.codePostal, c.localite].filter(Boolean).join(" "), pays: c.pays ?? "", email: d.email ?? "",
    langues: d.langues.map((l) => l.libelle).join(", "), annee: String(d.annee),
    montant_cotisation: d.totalCoti ? chf(d.totalCoti) : "", date_cotisation: dateCourte(d.dateCotisation),
    cotisation_annee: d.cotisationAnnee ? chf(d.cotisationAnnee) : "",
    montant_don: d.totalDons ? chf(d.totalDons) : "", nombre_dons: String(d.datesDons.length),
    dates_dons: d.datesDons.map(dateCourte).join(", "), date_dernier_don: dateCourte(d.datesDons.at(-1)),
    montant_total: chf(d.totalCoti + d.totalDons), seuil: chf(d.seuil),
    date_du_jour: dateCourte(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" })),
    date_du_jour_fr: dateLongue("fr-CH"), date_du_jour_de: dateLongue("de-CH"), date_du_jour_it: dateLongue("it-CH"),
    association_nom: a.nom, association_adresse: a.adresse ?? "", association_npa_localite: a.npaLocalite ?? "",
    association_email: a.email ?? "", association_telephone: a.telephone ?? "", iban: a.iban ?? "",
    signataire: a.signataire ?? "", fonction_signataire: a.fonctionSignataire ?? "", lieu_signature: a.lieuSignature ?? "",
  };
}

function nomFichier(d: Destinataire, ext: string) {
  const prefixe = { cotisation: "attestation-cotisation", don: "attestation-don", don_grand: "attestation-don", demande: "demande-cotisation" }[d.type];
  const base = (d.contact.nom ?? d.contact.societe ?? "membre").split("\n")[0].normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return `${prefixe}-${d.annee}-${base}-${d.contact.id}.${ext}`;
}

/**
 * Document à envoyer ou imprimer : modèle Word du type, rempli avec les variables, puis converti en PDF.
 * Sans modèle Word déposé pour ce type : null (rien n'est envoyé).
 */
export async function documentPour(d: Destinataire) {
  const modele = await modelePour(d.type);
  if (!modele) return null;
  const word = remplirWord(modele.fichier, await variables(d));
  return { contenu: await wordEnPdf(word), nom: nomFichier(d, "pdf"), type: "application/pdf", modeleId: modele.id };
}

export const SANS_MODELE = "Aucun modèle Word déposé pour ce document (Paramètres › Modèles).";

// ——— Envoi ———

export async function transporteur() {
  const p = await getParametresEnvoi();
  if (!p.smtpHote || !p.expediteurEmail) throw new Error("Serveur SMTP non configuré (Paramètres › Envoi).");
  return {
    p,
    t: nodemailer.createTransport({
      host: p.smtpHote,
      port: p.smtpPort ?? (p.smtpSecurite === "ssl" ? 465 : 587),
      secure: p.smtpSecurite === "ssl",
      ignoreTLS: p.smtpSecurite === "aucune",
      requireTLS: p.smtpSecurite === "starttls",
      auth: p.smtpUtilisateur ? { user: p.smtpUtilisateur, pass: process.env.SMTP_PASSWORD || p.smtpMotDePasse || "" } : undefined,
      // Ne pas rester bloqué si le serveur ne répond pas.
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    }),
  };
}

/** Message clair pour une erreur SMTP, et trace dans les journaux du serveur (sans mot de passe). */
export async function expliquerErreurSmtp(e: unknown, contexte: string) {
  const p = await getParametresEnvoi();
  const err = e as { code?: string; responseCode?: number; command?: string; message?: string };
  const brut = err?.message ?? String(e);
  console.error(`[SMTP] ${contexte} — hôte=${p.smtpHote} port=${p.smtpPort} sécurité=${p.smtpSecurite} utilisateur=${p.smtpUtilisateur ? "oui" : "non"} mot_de_passe=${process.env.SMTP_PASSWORD || p.smtpMotDePasse ? "oui" : "non"} code=${err?.code ?? "-"} réponse=${err?.responseCode ?? "-"} : ${brut}`);
  const m = brut.toLowerCase();
  let conseil = "";
  if (err?.code === "EAUTH" || err?.responseCode === 535) conseil = "Identifiant ou mot de passe SMTP refusé par le serveur.";
  else if (err?.code === "EDNS" || m.includes("enotfound") || m.includes("getaddrinfo")) conseil = "Nom du serveur SMTP introuvable : vérifiez l'adresse du serveur.";
  else if (m.includes("wrong version number") || m.includes("ssl routines")) conseil = "Mauvaise sécurité pour ce port : 465 = SSL/TLS, 587 = STARTTLS.";
  else if (err?.code === "ETIMEDOUT" || err?.code === "ESOCKET" || err?.code === "ECONNECTION" || m.includes("timeout") || m.includes("econnrefused"))
    conseil = "Le serveur SMTP ne répond pas : hôte ou port incorrect, ou port bloqué par l'hébergeur (Railway limite l'envoi SMTP sortant selon le forfait).";
  else if (err?.code === "EENVELOPE" || err?.responseCode === 553 || err?.responseCode === 550) conseil = "Adresse d'expéditeur refusée : elle doit correspondre au compte SMTP.";
  return conseil ? `${conseil} (détail : ${brut})` : brut;
}

async function journaliser(d: Destinataire, mode: "mail" | "courrier", statut: string, erreur: string | null, modeleId: number | null) {
  await db.insert(schema.envois).values({
    contactId: d.contact.id, annee: d.annee, mode, categorie: d.type,
    donCentimes: d.type === "cotisation" ? d.totalCoti : d.type === "demande" ? (d.cotisationAnnee ?? 0) : d.totalDons,
    destinataire: mode === "mail" ? d.email : [d.contact.adresse, d.contact.codePostal, d.contact.localite].filter(Boolean).join(" ").replace(/\n/g, ", "),
    modeleWordId: modeleId, statut, erreur,
  });
}

/** Envoie le document par e-mail et l'inscrit au journal. */
export async function envoyerParMail(d: Destinataire, tr?: Awaited<ReturnType<typeof transporteur>>) {
  if (!d.email) {
    await journaliser(d, "mail", "erreur", "Pas d'adresse e-mail : à envoyer par courrier.", null);
    return { ok: false as const, erreur: "Pas d'adresse e-mail" };
  }
  try {
    const { p, t } = tr ?? (await transporteur());
    const [m] = await db.select().from(schema.emailsTypes).where(eq(schema.emailsTypes.type, d.type === "don_grand" ? "don_grand" : d.type));
    const modeleMail = m ?? (d.type === "don_grand" ? (await db.select().from(schema.emailsTypes).where(eq(schema.emailsTypes.type, "don")))[0] : undefined);
    if (!modeleMail) throw new Error(`Aucun e-mail défini pour « ${TYPES_DOC[d.type].titre} » (Paramètres).`);
    const vars = await variables(d);
    const doc = await documentPour(d);
    if (!doc) throw new Error(SANS_MODELE);
    await t.sendMail({
      from: p.expediteurNom ? `"${p.expediteurNom}" <${p.expediteurEmail}>` : p.expediteurEmail!,
      to: d.email,
      bcc: p.copieCachee || undefined,
      subject: remplir(modeleMail.objet, vars),
      text: remplir(modeleMail.contenu, vars),
      attachments: [{ filename: doc.nom, content: doc.contenu, contentType: doc.type }],
    });
    await journaliser(d, "mail", "envoyé", null, doc.modeleId);
    return { ok: true as const };
  } catch (e) {
    const msg = await expliquerErreurSmtp(e, `envoi ${d.type} à la fiche ${d.contact.id}`);
    await journaliser(d, "mail", "erreur", msg, null);
    return { ok: false as const, erreur: msg };
  }
}

export async function journaliserCourrier(d: Destinataire, modeleId: number | null) {
  await journaliser(d, "courrier", "généré", null, modeleId);
}

/** Cotisations « à payer » de l'année (pour savoir qui reçoit une demande). */
export async function nbCotisationsAPayer(annee: number) {
  const [{ n }] = await db.select({ n: sql<number>`count(distinct ${schema.cotisations.contactId})::int` }).from(schema.cotisations)
    .where(and(eq(schema.cotisations.annee, annee), isNull(schema.cotisations.montantCentimes)));
  return n;
}
