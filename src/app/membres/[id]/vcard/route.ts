import { getContact } from "@/lib/data";
import { nomComplet } from "@/lib/format";

const esc = (v: string | null | undefined) =>
  (v ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

/** Fiche au format vCard, importable dans Outlook, Contacts (Mac/iPhone), Gmail… */
export async function GET(_req: Request, ctx: RouteContext<"/membres/[id]/vcard">) {
  const c = await getContact(Number((await ctx.params).id));
  if (!c) return new Response("Introuvable", { status: 404 });

  const lignes = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(c.nom)};${esc(c.prenom)};;${esc(c.formePolitesse?.libelle)};`,
    `FN:${esc(nomComplet(c))}`,
    c.societe && `ORG:${esc(c.societe)}`,
    c.fonction && `TITLE:${esc(c.fonction)}`,
    c.email && `EMAIL;TYPE=INTERNET:${esc(c.email)}`,
    c.telProfessionnel && `TEL;TYPE=WORK:${esc(c.telProfessionnel)}`,
    c.telPersonnel && `TEL;TYPE=HOME:${esc(c.telPersonnel)}`,
    c.telMobile && `TEL;TYPE=CELL:${esc(c.telMobile)}`,
    c.fax && `TEL;TYPE=FAX:${esc(c.fax)}`,
    (c.adresse || c.localite) &&
      `ADR;TYPE=HOME:;;${esc(c.adresse)};${esc(c.localite)};${esc(c.canton)};${esc(c.codePostal)};${esc(c.pays)}`,
    c.pageWeb && `URL:${esc(c.pageWeb)}`,
    c.remarques && `NOTE:${esc(c.remarques)}`,
    "END:VCARD",
  ].filter(Boolean);

  const fichier = nomComplet(c).replace(/[^\p{L}\p{N} -]/gu, "").trim() || `contact-${c.id}`;
  return new Response(lignes.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="contact-${c.id}.vcf"; filename*=UTF-8''${encodeURIComponent(fichier)}.vcf`,
    },
  });
}
