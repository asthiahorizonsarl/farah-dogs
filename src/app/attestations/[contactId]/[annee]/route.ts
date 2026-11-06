import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { getAssociation } from "@/lib/data";
import { genererAttestation, type Versement } from "@/lib/attestation";

/** Attestation PDF de cotisation et de don d'un membre pour une année (toutes ses lignes de l'année). */
export async function GET(_req: Request, ctx: RouteContext<"/attestations/[contactId]/[annee]">) {
  await connection();
  const p = await ctx.params;
  const contactId = Number(p.contactId);
  const annee = Number(p.annee);
  if (!Number.isInteger(contactId) || !Number.isInteger(annee)) return new Response("Paramètres invalides", { status: 400 });

  const c = await db.query.contacts.findFirst({
    where: eq(schema.contacts.id, contactId),
    with: { formePolitesse: true, langues: { with: { langue: true } } },
  });
  if (!c) return new Response("Membre introuvable", { status: 404 });
  const [cotis, dons] = await Promise.all([
    db.select().from(schema.cotisations).where(and(eq(schema.cotisations.contactId, contactId), eq(schema.cotisations.annee, annee))),
    db.select().from(schema.dons).where(and(eq(schema.dons.contactId, contactId), eq(schema.dons.annee, annee))),
  ]);
  const versements: Versement[] = [
    ...cotis.filter((c) => (c.montantCentimes ?? 0) > 0).map((c) => ({ type: "cotisation" as const, date: c.datePaiement, centimes: c.montantCentimes! })),
    ...dons.filter((d) => (d.montantCentimes ?? 0) > 0).map((d) => ({ type: "don" as const, date: d.dateDon, centimes: d.montantCentimes! })),
  ];
  if (!versements.length) return new Response(`Aucune cotisation ni don payé en ${annee} pour ce membre.`, { status: 404 });

  const langues = c.langues.map((l) => l.langue.libelle.toLowerCase());
  const langue = langues.includes("allemand") && !langues.includes("français") ? "de" : "fr";

  const pdf = await genererAttestation({
    annee,
    langue,
    destinataire: {
      politesse: c.formePolitesse?.libelle ?? null, nom: c.nom, prenom: c.prenom, societe: c.societe, adresse: c.adresse,
      npaLocalite: [c.codePostal, c.localite].filter(Boolean).join(" ") || null, pays: c.pays,
    },
    versements,
    association: await getAssociation(),
  });

  const nom = `attestation-${annee}-${(c.nom ?? c.societe ?? "membre").split("\n")[0].normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nom}"` },
  });
}
