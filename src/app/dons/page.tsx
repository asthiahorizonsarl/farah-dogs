import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, Gift, HeartHandshake, Plus, Users } from "lucide-react";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAnneesDons, getContactsChoix, getDonsAnnee } from "@/lib/data";
import { getDestinataires, getParametresEnvoi } from "@/lib/envois";
import { formatChf, libelleContact, nomComplet } from "@/lib/format";
import { Bip } from "@/components/Bip";
import { Picker } from "@/components/ContactPicker";
import { Champ, Kpi, PageHeader } from "@/components/ui";
import { EnvoiPanneau } from "@/components/EnvoiPanneau";
import { LignesDons, type LigneDon } from "./LignesDons";
import { ajouterDon } from "./actions";

export const metadata = { title: "Dons" };

export default async function Dons({ searchParams }: PageProps<"/dons">) {
  await connection();
  const sp = await searchParams;
  const anneeCourante = new Date().getFullYear();
  const annees = await getAnneesDons();
  const listeAnnees = [...new Set([anneeCourante, ...annees.filter((a) => a.annee !== null).map((a) => a.annee!)])].sort((a, b) => b - a);
  const param = typeof sp.annee === "string" ? sp.annee : undefined;
  const annee: number | null = param === "sans" ? null : param && /^\d{4}$/.test(param) ? Number(param) : anneeCourante;
  const vue = sp.vue === "attestations" && annee !== null ? "attestations" : "dons";
  const stats = annees.find((a) => a.annee === annee) ?? { nb: 0, donateurs: 0, total: 0, deduites: 0 };

  const [brutes, contacts, donateurs, p, modeles] = await Promise.all([
    vue === "dons" ? getDonsAnnee(annee) : Promise.resolve([]),
    vue === "dons" ? getContactsChoix() : Promise.resolve([]),
    annee !== null ? getDestinataires("dons", annee) : Promise.resolve([]),
    getParametresEnvoi(),
    db.select({ categorie: schema.modelesWord.categorie }).from(schema.modelesWord).where(inArray(schema.modelesWord.categorie, ["don", "don_grand"])),
  ]);
  const seuil = p.seuilCentimes;
  const aModele = (t: string) => modeles.some((m) => m.categorie === t);
  const lignes: LigneDon[] = brutes.map((d) => ({
    id: d.id, contactId: d.contactId, membre: nomComplet(d.contact), lieu: [d.contact.codePostal, d.contact.localite].filter(Boolean).join(" "),
    archive: d.contact.archive, montant: d.montantCentimes, date: d.dateDon, remarque: d.remarque, anneeDeduite: d.anneeDeduite,
  }));
  const membres = contacts.filter((c) => !c.archive).map((c) => ({ id: c.id, libelle: libelleContact(c) }));
  const gros = donateurs.filter((d) => d.type === "don_grand");
  const aFaire = donateurs.filter((d) => !d.dejaFait);
  const mailsAEnvoyer = aFaire.filter((d) => d.email).length;
  const courriersAGenerer = aFaire.filter((d) => !d.email).length;
  const base = `/dons?annee=${annee ?? "sans"}`;

  return (
    <div className="space-y-6">
      <PageHeader titre="Dons" sousTitre={`Dons reçus et attestations. Seuil : ${formatChf(seuil)} (réglable dans Paramètres).`} />

      {sp.ok && <p className="notice-ok">{String(sp.ok)}</p>}
      {sp.erreur && <p className="notice-erreur">{String(sp.erreur)}</p>}
      {sp.sansmail && (
        <p className="notice-erreur flex items-center gap-2">
          <Bip /><AlertTriangle className="size-4" />
          {String(sp.sansmail)} personne(s) sans e-mail : à envoyer par courrier.
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {listeAnnees.map((a) => (
          <Link key={a} href={`/dons?annee=${a}${vue === "attestations" ? "&vue=attestations" : ""}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm tabular-nums ${annee === a ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
            {a}
          </Link>
        ))}
        {annees.some((a) => a.annee === null) && (
          <Link href="/dons?annee=sans" className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${annee === null ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-400 hover:text-stone-800"}`}>Sans année</Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={`Dons ${annee ?? ""}`} icone={<Gift />} valeur={formatChf(stats.total)} detail={`${stats.nb} don${stats.nb > 1 ? "s" : ""}`} />
        <Kpi label="Donateurs" icone={<Users />} valeur={stats.donateurs} detail={`${gros.length} au-dessus de ${formatChf(seuil)}`} />
        <Kpi href={annee !== null ? `${base}&vue=attestations` : undefined} label="Attestations à faire" icone={<HeartHandshake />}
          valeur={mailsAEnvoyer + courriersAGenerer} detail={`${mailsAEnvoyer} e-mails · ${courriersAGenerer} courriers`} />
      </div>

      {annee !== null && (
        <div className="flex w-fit rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
          <Link href={base} className={`rounded-md px-4 py-1.5 ${vue === "dons" ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>Dons</Link>
          <Link href={`${base}&vue=attestations`} className={`rounded-md px-4 py-1.5 ${vue === "attestations" ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>
            Attestations {mailsAEnvoyer + courriersAGenerer > 0 && <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white">{mailsAEnvoyer + courriersAGenerer}</span>}
          </Link>
        </div>
      )}

      {vue === "dons" && (
        <>
          <form action={ajouterDon} className="carte p-5">
            <input type="hidden" name="retour" value={`${base}&ok=${encodeURIComponent("Don enregistré.")}`} />
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-brand-600" /> Enregistrer un don</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,2fr)_9rem_10rem_minmax(10rem,1fr)_auto] lg:items-end">
              <Champ label="Donateur"><Picker name="contactId" choix={membres} placeholder="Tapez un nom…" required /></Champ>
              <Champ label="Montant CHF"><input name="montant" inputMode="decimal" className="champ text-right" required /></Champ>
              <Champ label="Date du don"><input name="date" type="date" className="champ" /></Champ>
              <Champ label="Remarque"><input name="remarque" className="champ" /></Champ>
              <button className="btn-principal">Enregistrer</button>
            </div>
            <p className="mt-2 text-xs text-stone-400">Sans date, la date du jour est utilisée. L&apos;année du don est celle de sa date.</p>
          </form>
          <LignesDons annee={annee} lignes={lignes} seuil={seuil} />
        </>
      )}

      {vue === "attestations" && annee !== null && (
        <div className="space-y-6">
          <EnvoiPanneau type="don" annee={annee} destinataires={donateurs} retour={`${base}&vue=attestations`} modeleDepose={aModele("don")} montant={(d) => d.totalDons} />
          <EnvoiPanneau type="don_grand" annee={annee} destinataires={donateurs} retour={`${base}&vue=attestations`} modeleDepose={aModele("don_grand") || aModele("don")} montant={(d) => d.totalDons} />
        </div>
      )}
    </div>
  );
}
