import Link from "next/link";
import { connection } from "next/server";
import { CalendarPlus, CircleDollarSign, Clock, Plus, Settings2, Trash2, Users } from "lucide-react";
import { getAnnees, getContactsChoix, getCotisationsAnnee, getCotisationsManquantes, getListes } from "@/lib/data";
import { formatChf, libelleContact, montantPourSaisie, nomComplet } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Picker } from "@/components/ContactPicker";
import { Champ, Kpi, PageHeader } from "@/components/ui";
import { LignesCotisations, type LigneCotisation } from "./LignesCotisations";
import { EnvoiPanneau } from "@/components/EnvoiPanneau";
import { Bip } from "@/components/Bip";
import { getDestinataires } from "@/lib/envois";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { creerAnnee, modifierAnnee, preparerCotisations, saisirCotisation, supprimerAnnee } from "./actions";

export const metadata = { title: "Cotisations" };

export default async function Cotisations({ searchParams }: PageProps<"/cotisations">) {
  await connection();
  const sp = await searchParams;
  const [annees, { types }] = await Promise.all([getAnnees(), getListes()]);
  const anneeCourante = new Date().getFullYear();

  // Vue choisie : une année, les lignes sans année, ou le récapitulatif.
  const param = typeof sp.annee === "string" ? sp.annee : undefined;
  const vue: number | "sans" | "recap" =
    param === "recap" ? "recap" : param === "sans" ? "sans" : param && /^\d{4}$/.test(param) ? Number(param)
      : annees.some((a) => a.annee === anneeCourante) ? anneeCourante : annees[0]?.annee ?? "recap";
  const stats = typeof vue === "number" ? annees.find((a) => a.annee === vue) : undefined;
  const anneeManquantes = typeof sp.manquantes === "string" && /^\d{4}$/.test(sp.manquantes) ? Number(sp.manquantes) : null;
  const sousVue = sp.vue === "envois" && stats ? "envois" : "lignes";
  const [demandes, attestations, modeles] = sousVue === "envois" && stats
    ? await Promise.all([
        getDestinataires("demande", stats.annee), getDestinataires("cotisation", stats.annee),
        db.select({ categorie: schema.modelesWord.categorie }).from(schema.modelesWord).where(inArray(schema.modelesWord.categorie, ["demande", "cotisation"])),
      ])
    : [[], [], []];

  const [lignesBrutes, contacts, manquantes] = await Promise.all([
    vue === "recap" ? Promise.resolve([]) : getCotisationsAnnee(vue === "sans" ? null : vue),
    vue === "recap" ? Promise.resolve([]) : getContactsChoix(),
    anneeManquantes ? getCotisationsManquantes(anneeManquantes) : Promise.resolve([]),
  ]);
  const lignes: LigneCotisation[] = lignesBrutes.map((l) => ({
    id: l.id, contactId: l.contactId, membre: nomComplet(l.contact), lieu: [l.contact.codePostal, l.contact.localite].filter(Boolean).join(" "),
    archive: l.contact.archive, montant: l.montantCentimes, date: l.datePaiement, remarque: l.remarque, anneeDeduite: l.anneeDeduite,
  }));
  const membres = contacts.filter((c) => !c.archive).map((c) => ({ id: c.id, libelle: libelleContact(c) }));
  const prochaine = Math.max(anneeCourante, ...annees.map((a) => a.annee + 1));
  const typeActif = types.find((t) => /(^|\s)actif/i.test(t.libelle));
  const sansAnnee = vue === "sans" ? lignes.length : null;

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Cotisations"
        sousTitre="Créez l'année de cotisation, puis enregistrez les paiements. Les dons ont leur propre page."
        actions={
          <details className="relative">
            <summary className="btn-principal list-none"><CalendarPlus /> Nouvelle année</summary>
            <form action={creerAnnee} className="carte absolute right-0 z-20 mt-2 w-[22rem] space-y-4 p-5">
              <h3 className="font-semibold">Créer une année</h3>
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Année"><input name="annee" type="number" defaultValue={prochaine} className="champ" required /></Champ>
                <Champ label="Cotisation par défaut (CHF)"><input name="defaut" inputMode="decimal" defaultValue={montantPourSaisie(annees[0]?.defaut ?? 5000)} className="champ" /></Champ>
              </div>
              <fieldset>
                <legend className="etiquette mb-1">Préparer une cotisation « à payer » pour :</legend>
                <div className="flex flex-col">
                  {types.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                      <input type="checkbox" name="types" value={t.id} defaultChecked={t.id === typeActif?.id} className="size-4 accent-brand-600" />
                      {t.libelle}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-stone-400">Fiches non archivées uniquement. Ne rien cocher pour créer l&apos;année vide.</p>
              </fieldset>
              <Champ label="Remarque"><input name="remarque" className="champ" placeholder="ex. campagne envoyée en mars" /></Champ>
              <button className="btn-principal w-full">Créer l&apos;année</button>
            </form>
          </details>
        }
      />

      {sp.ok && <p className="notice-ok">{String(sp.ok)}</p>}
      {sp.erreur && <p className="notice-erreur">{String(sp.erreur)}</p>}

      {/* Choix de l'année */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
        <Link href="/cotisations?annee=recap" className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${vue === "recap" ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
          Récapitulatif
        </Link>
        {annees.map((a) => (
          <Link key={a.annee} href={`/cotisations?annee=${a.annee}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm tabular-nums ${vue === a.annee ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
            {a.annee}
            {a.aPayer > 0 && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 text-xs text-amber-700" title="Cotisations à payer">{a.aPayer}</span>}
          </Link>
        ))}
        <Link href="/cotisations?annee=sans" className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${vue === "sans" ? "border-brand-600 font-medium text-stone-900" : "border-transparent text-stone-400 hover:text-stone-800"}`}>
          Sans année
        </Link>
      </div>

      {vue === "recap" && (
        <div className="carte overflow-x-auto">
          <table className="table-liste">
            <thead>
              <tr><th>Année</th><th className="text-right">Cotisation par défaut</th><th className="text-right">Lignes</th><th className="text-right">Payées</th>
                <th className="text-right">À payer</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {annees.map((a) => (
                <tr key={a.annee} className="hover:bg-stone-50">
                  <td><Link href={`/cotisations?annee=${a.annee}`} className="lien">{a.annee}</Link></td>
                  <td className="text-right tabular-nums">{formatChf(a.defaut)}</td>
                  <td className="text-right">{a.lignes}</td>
                  <td className="text-right">{a.payees}</td>
                  <td className="text-right">{a.aPayer || ""}</td>
                  <td className="text-right font-medium tabular-nums">{formatChf(a.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-stone-200 font-semibold">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td />
                <td className="px-4 py-3 text-right">{annees.reduce((s, a) => s + a.lignes, 0)}</td>
                <td className="px-4 py-3 text-right">{annees.reduce((s, a) => s + a.payees, 0)}</td>
                <td />
                <td className="px-4 py-3 text-right tabular-nums">{formatChf(annees.reduce((s, a) => s + a.total, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {typeof vue === "number" && !stats && (
        <p className="notice-erreur">L&apos;année {vue} n&apos;existe pas encore. Créez-la avec « Nouvelle année ».</p>
      )}

      {(stats || vue === "sans") && (
        <>
          {stats && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Kpi label="Cotisations payées" icone={<Users />} valeur={stats.payees} detail={`sur ${stats.lignes} lignes`} />
              <Kpi label="À payer" icone={<Clock />} valeur={stats.aPayer} detail={stats.aPayer ? "Bouton « Payée » sur chaque ligne" : "Aucune en attente"} />
              <Kpi label={`Total ${stats.annee}`} icone={<CircleDollarSign />} valeur={formatChf(stats.total)} detail={stats.defaut ? `Cotisation de ${formatChf(stats.defaut)}` : undefined} />
            </div>
          )}

          {stats && (
            <div className="flex w-fit rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
              <Link href={`/cotisations?annee=${stats.annee}`} className={`rounded-md px-4 py-1.5 ${sousVue === "lignes" ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>Cotisations</Link>
              <Link href={`/cotisations?annee=${stats.annee}&vue=envois`} className={`rounded-md px-4 py-1.5 ${sousVue === "envois" ? "bg-ink font-medium text-white" : "text-stone-600 hover:text-stone-900"}`}>Demandes et attestations</Link>
            </div>
          )}

          {sp.sansmail && <p className="notice-erreur flex items-center gap-2"><Bip /> {String(sp.sansmail)} personne(s) sans e-mail : à envoyer par courrier.</p>}

          {sousVue === "envois" && stats && (
            <div className="space-y-6">
              <EnvoiPanneau type="demande" annee={stats.annee} destinataires={demandes} retour={`/cotisations?annee=${stats.annee}&vue=envois`}
                modeleDepose={modeles.some((m) => m.categorie === "demande")} montant={(d) => d.cotisationAnnee ?? 0} />
              <EnvoiPanneau type="cotisation" annee={stats.annee} destinataires={attestations} retour={`/cotisations?annee=${stats.annee}&vue=envois`}
                modeleDepose={modeles.some((m) => m.categorie === "cotisation")} montant={(d) => d.totalCoti} />
            </div>
          )}

          {/* Saisie rapide */}
          {stats && sousVue === "lignes" && (
            <form action={saisirCotisation} className="carte p-5">
              <input type="hidden" name="annee" value={stats.annee} />
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4 text-brand-600" /> Enregistrer une cotisation {stats.annee}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,2fr)_9rem_10rem_minmax(10rem,1fr)_auto] lg:items-end">
                <Champ label="Membre"><Picker name="contactId" choix={membres} placeholder="Tapez un nom…" required /></Champ>
                <Champ label="Montant CHF"><input name="montant" inputMode="decimal" placeholder={stats.defaut ? montantPourSaisie(stats.defaut) : ""} className="champ text-right" /></Champ>
                <Champ label="Payée le"><input name="date" type="date" className="champ" /></Champ>
                <Champ label="Remarque"><input name="remarque" className="champ" /></Champ>
                <button className="btn-principal">Enregistrer</button>
              </div>
              <p className="mt-2 text-xs text-stone-400">Sans montant, la cotisation par défaut est utilisée ; sans date, la date du jour. Une cotisation « à payer » du membre est complétée.</p>
            </form>
          )}

          {sansAnnee !== null && (
            <p className="notice-erreur">Ces {sansAnnee} cotisations n&apos;ont ni année ni date dans Access. Modifiez-les pour leur donner une année.</p>
          )}

          {sousVue === "lignes" && <LignesCotisations annee={stats?.annee ?? null} lignes={lignes} defaut={stats?.defaut ?? null} />}

          {/* Réglages de l'année */}
          {stats && sousVue === "lignes" && (
            <details className="carte p-5">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-brand-600" /> Réglages de l&apos;année {stats.annee}</summary>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <form action={modifierAnnee} className="space-y-3">
                  <input type="hidden" name="annee" value={stats.annee} />
                  <Champ label="Cotisation par défaut (CHF)"><input name="defaut" inputMode="decimal" defaultValue={montantPourSaisie(stats.defaut)} className="champ max-w-40" /></Champ>
                  <Champ label="Remarque"><input name="remarque" defaultValue={stats.remarque ?? ""} className="champ" /></Champ>
                  <button className="btn-secondaire">Enregistrer</button>
                </form>
                <div className="space-y-4">
                  <form action={preparerCotisations} className="space-y-2">
                    <input type="hidden" name="annee" value={stats.annee} />
                    <div className="etiquette">Ajouter des cotisations « à payer » pour les membres :</div>
                    <div className="flex flex-col">
                      {types.map((t) => (
                        <label key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50">
                          <input type="checkbox" name="types" value={t.id} className="size-4 accent-brand-600" /> {t.libelle}
                        </label>
                      ))}
                    </div>
                    <button className="btn-secondaire">Ajouter</button>
                    <p className="text-xs text-stone-400">Les membres qui ont déjà une ligne en {stats.annee} ne sont pas dupliqués.</p>
                  </form>
                  <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                    <Link href={`/cotisations?annee=${stats.annee}&manquantes=${stats.annee}`} className="btn-secondaire">Membres actifs sans cotisation</Link>
                    <form action={supprimerAnnee}>
                      <input type="hidden" name="annee" value={stats.annee} />
                      <ConfirmButton className="btn-danger" message={`Supprimer l'année ${stats.annee} ? Possible seulement si aucune cotisation n'y est payée.`}>
                        <Trash2 /> Supprimer l&apos;année
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {anneeManquantes && (
        <section className="carte p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Membres actifs sans cotisation {anneeManquantes} · {manquantes.length}</h2>
            <Link href={`/cotisations?annee=${anneeManquantes}`} className="lien text-sm">Fermer</Link>
          </div>
          <table className="table-liste">
            <thead><tr><th>Membre</th><th>Localité</th><th>E-mail</th><th>Dernière cotisation</th></tr></thead>
            <tbody>
              {manquantes.map((m) => (
                <tr key={Number(m.id)}>
                  <td><Link href={`/membres/${m.id}?onglet=cotisations`} className="lien">{nomComplet(m as { nom: string | null; prenom: string | null })}</Link></td>
                  <td>{[m.codePostal, m.localite].filter(Boolean).join(" ")}</td>
                  <td className="text-stone-500">{String(m.email ?? "")}</td>
                  <td>{m.derniereAnnee ? String(m.derniereAnnee) : <span className="text-stone-400">jamais</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
