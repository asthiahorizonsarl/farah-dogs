import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, ArrowRight, Dog, HandCoins, HeartHandshake, PiggyBank, UserCheck, Users } from "lucide-react";
import { getChiens, getCotisationsManquantes, getTableauDeBord } from "@/lib/data";
import { remiseEnCours, statutChien } from "@/lib/chiens";
import { formatChf, formatDate, nomComplet } from "@/lib/format";
import { Kpi, PageHeader } from "@/components/ui";

export const metadata = { title: "Tableau de bord" };

const ageAns = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 864e5)) : null);
const ORDRE_STATUTS = ["Remis", "En stage", "Pas actif", "Disponible", "Réformé", "Décédé"];
const COULEUR_BARRE: Record<string, string> = {
  Remis: "bg-emerald-500", "En stage": "bg-sky-500", "Pas actif": "bg-orange-400", Disponible: "bg-violet-500",
  Réformé: "bg-amber-400", Décédé: "bg-stone-400",
};

export default async function TableauDeBord() {
  await connection(); // données et date du jour calculées à chaque visite
  const annee = new Date().getFullYear();
  const [t, chiens, manquantes] = await Promise.all([getTableauDeBord(annee), getChiens(), getCotisationsManquantes(annee)]);

  // Chiens
  const avecStatut = chiens.map((c) => ({ c, s: statutChien(c).label, r: remiseEnCours(c.remises) }));
  const parStatut = new Map(ORDRE_STATUTS.map((s) => [s, avecStatut.filter((x) => x.s === s).length]));
  const auTravail = (parStatut.get("Remis") ?? 0) + (parStatut.get("En stage") ?? 0);
  const enVie = chiens.filter((c) => !c.decede).length;
  const besoins = new Map<string, number>();
  for (const x of avecStatut) {
    if (x.s !== "Remis" && x.s !== "En stage") continue;
    for (const p of x.r?.pathologies ?? []) besoins.set(p.pathologie.libelle, (besoins.get(p.pathologie.libelle) ?? 0) + 1);
  }
  const besoinsTries = [...besoins].sort((a, b) => b[1] - a[1]);
  const remisesAnnee = chiens.flatMap((c) => c.remises.map((r) => ({ r, c }))).filter(({ r }) => r.dateRemise?.startsWith(String(annee)));
  const dernieresRemises = chiens.flatMap((c) => c.remises.map((r) => ({ r, c })))
    .sort((a, b) => (b.r.dateRemise ?? "").localeCompare(a.r.dateRemise ?? "")).slice(0, 6);
  const seniors = avecStatut.filter((x) => (x.s === "Remis" || x.s === "En stage") && (ageAns(x.c.dateNaissance) ?? 0) >= 9);
  const aReplacer = avecStatut.filter((x) => x.s === "Disponible" || x.s === "Pas actif");

  // Finances
  const fin = new Map(t.finances.map((f) => [f.annee, f]));
  const cette = fin.get(annee) ?? { coti: 0, dons: 0, payeurs: 0, nbDons: 0 };
  const precedente = fin.get(annee - 1) ?? { coti: 0, dons: 0, payeurs: 0, nbDons: 0 };
  const maxTotal = Math.max(1, ...t.finances.map((f) => f.coti + f.dons));
  const tauxCoti = t.cotisations.attendues ? Math.round(((t.cotisations.attendues - t.cotisations.manquantes) / t.cotisations.attendues) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader titre="Tableau de bord" sousTitre={`Vue d'ensemble de l'association · ${new Date().toLocaleDateString("fr-CH", { dateStyle: "long" })}`} />

      {/* Indicateurs principaux */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi href="/chiens?statut=Remis" label="Chiens au travail" icone={<Dog />} valeur={auTravail}
          detail={`sur ${enVie} chiens en vie · ${chiens.length} au total`} />
        <Kpi href="/membres?type=1" label="Membres actifs" icone={<UserCheck />} valeur={t.cotisations.attendues}
          detail={`${t.membres.total} fiches actives · ${t.membres.mag} reçoivent le mag`} />
        <Kpi href={`/cotisations?manquantes=${annee}`} label={`Cotisations ${annee} manquantes`} icone={<AlertTriangle />}
          valeur={t.cotisations.manquantes} detail={`${tauxCoti} % des membres actifs ont payé`} />
        <Kpi href={`/dons?annee=${annee}`} label={`Dons ${annee}`} icone={<HeartHandshake />} valeur={formatChf(cette.dons)}
          detail={`${cette.nbDons} dons · ${formatChf(precedente.dons)} en ${annee - 1}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Chiens */}
        <section className="carte p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Chiens par situation</h2>
            <Link href="/chiens" className="lien text-sm">Tous les chiens</Link>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">
            {ORDRE_STATUTS.map((s) => {
              const n = parStatut.get(s) ?? 0;
              return n ? <div key={s} className={COULEUR_BARRE[s]} style={{ width: `${(n / chiens.length) * 100}%` }} title={`${s} : ${n}`} /> : null;
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ORDRE_STATUTS.map((s) => (
              <Link key={s} href={`/chiens?statut=${encodeURIComponent(s)}`} className="flex items-center gap-3 rounded-xl border border-stone-100 px-3 py-2.5 hover:bg-stone-50">
                <span className={`size-2.5 rounded-full ${COULEUR_BARRE[s]}`} />
                <span className="text-sm text-stone-600">{s}</span>
                <span className="ml-auto font-semibold tabular-nums">{parStatut.get(s)}</span>
              </Link>
            ))}
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-stone-500">Besoins couverts par les chiens au travail</h3>
              <ul className="space-y-2">
                {besoinsTries.map(([b, n]) => (
                  <li key={b} className="text-sm">
                    <div className="flex justify-between"><span>{b}</span><span className="tabular-nums text-stone-500">{n}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(n / Math.max(1, auTravail)) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-stone-500">Dernières remises</h3>
              <ul className="divide-y divide-stone-100">
                {dernieresRemises.map(({ r, c }) => (
                  <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                    <Link href={`/chiens/${c.id}?onglet=remises`} className="font-medium hover:text-brand-700">{c.nom}</Link>
                    <span className="min-w-0 truncate text-stone-500">{r.beneficiairePrenom ?? nomComplet(r.contact)}</span>
                    <span className="ml-auto whitespace-nowrap text-xs text-stone-400">{formatDate(r.dateRemise)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-stone-500">{remisesAnnee.length} remise{remisesAnnee.length > 1 ? "s" : ""} en {annee}</p>
            </div>
          </div>
        </section>

        {/* À suivre */}
        <section className="carte p-5">
          <h2 className="mb-4 font-semibold">À suivre</h2>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/suivis" className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 text-brand-800 hover:bg-brand-100">
                <span className="font-medium">Suivis ouverts ou en cours</span>
                <span className="font-semibold tabular-nums">{t.suivis.ouverts + t.suivis.enCours}</span>
              </Link>
            </li>
            <li className="border-t border-stone-100 pt-3">
              <div className="mb-1 font-medium text-stone-700">Chiens à replacer ou inactifs <span className="text-stone-400">({aReplacer.length})</span></div>
              <div className="flex flex-col">
                {aReplacer.map(({ c, s }) => (
                  <Link key={c.id} href={`/chiens/${c.id}`} className="flex justify-between rounded-lg px-2 py-1 hover:bg-stone-50">
                    <span>{c.nom}</span><span className="text-stone-400">{s}</span>
                  </Link>
                ))}
              </div>
            </li>
            <li className="border-t border-stone-100 pt-3">
              <div className="mb-1 font-medium text-stone-700">Chiens au travail de 9 ans et plus <span className="text-stone-400">({seniors.length})</span></div>
              <div className="flex flex-col">
                {seniors.map(({ c }) => (
                  <Link key={c.id} href={`/chiens/${c.id}`} className="flex justify-between rounded-lg px-2 py-1 hover:bg-stone-50">
                    <span>{c.nom}</span><span className="text-stone-400">{ageAns(c.dateNaissance)} ans</span>
                  </Link>
                ))}
              </div>
            </li>
            {t.beneficiairesSansEmail > 0 && (
              <li className="border-t border-stone-100 pt-3 text-stone-600">
                <span className="font-medium text-stone-700">{t.beneficiairesSansEmail} familles</span> avec un chien n&apos;ont pas d&apos;e-mail.
              </li>
            )}
            {t.anneesDeduites > 0 && (
              <li className="border-t border-stone-100 pt-3 text-stone-600">
                <span className="font-medium text-stone-700">{t.anneesDeduites} versements</span> avaient une année vide dans Access (déduite de la date).
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Finances */}
        <section className="carte p-5 xl:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">Cotisations et dons par année</h2>
            <Link href="/dons" className="lien text-sm">Dons</Link>
          </div>
          <p className="mb-4 text-xs text-stone-500">
            <span className="mr-3 inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink" /> Cotisations</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-500" /> Dons</span>
          </p>
          <div className="flex h-48 items-end gap-3">
            {t.finances.map((f) => (
              <Link key={f.annee} href={`/dons?annee=${f.annee}`} className="group flex h-full flex-1 flex-col justify-end" title={`${f.annee} : cotisations ${formatChf(f.coti)}, dons ${formatChf(f.dons)}`}>
                <span className="mb-1 text-center text-[11px] text-stone-500 tabular-nums">{Math.round((f.coti + f.dons) / 100000)}k</span>
                <div className="flex flex-col overflow-hidden rounded-md transition group-hover:opacity-80" style={{ height: `${((f.coti + f.dons) / maxTotal) * 100}%` }}>
                  <div className="flex-1 bg-brand-500" />
                  <div className="bg-ink" style={{ height: `${f.coti + f.dons ? (f.coti / (f.coti + f.dons)) * 100 : 0}%` }} />
                </div>
                <span className={`mt-1.5 text-center text-xs ${f.annee === annee ? "font-semibold text-stone-900" : "text-stone-500"}`}>{f.annee}</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-3">
            <div><div className="text-xs text-stone-500">Cotisations {annee}</div><div className="font-semibold tabular-nums">{formatChf(cette.coti)}</div><div className="text-xs text-stone-400">{cette.payeurs} payées · {formatChf(precedente.coti)} en {annee - 1}</div></div>
            <div><div className="text-xs text-stone-500">Dons {annee}</div><div className="font-semibold tabular-nums">{formatChf(cette.dons)}</div><div className="text-xs text-stone-400">{cette.nbDons} dons</div></div>
            <div><div className="text-xs text-stone-500">Total {annee}</div><div className="font-semibold tabular-nums">{formatChf(cette.coti + cette.dons)}</div><div className="text-xs text-stone-400">{formatChf(precedente.coti + precedente.dons)} en {annee - 1}</div></div>
          </div>
        </section>

        {/* Cotisations manquantes */}
        <section className="carte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Cotisations {annee} manquantes</h2>
            <span className="badge bg-brand-50 text-brand-700">{t.cotisations.manquantes}</span>
          </div>
          <div className="mb-3 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${tauxCoti}%` }} /></div>
          <p className="mb-3 text-xs text-stone-500">{t.cotisations.attendues - t.cotisations.manquantes} membres actifs sur {t.cotisations.attendues} ont payé.</p>
          <ul className="divide-y divide-stone-100 text-sm">
            {manquantes.slice(0, 8).map((m) => (
              <li key={Number(m.id)}>
                <Link href={`/membres/${m.id}?onglet=cotisations`} className="flex items-center justify-between gap-2 py-1.5 hover:text-brand-700">
                  <span className="truncate">{nomComplet(m as { nom: string | null; prenom: string | null })}</span>
                  <span className="whitespace-nowrap text-xs text-stone-400">{m.derniereAnnee ? `payé en ${m.derniereAnnee}` : "jamais payé"}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/cotisations?manquantes=${annee}`} className="btn-secondaire mt-3 w-full">Voir les {t.cotisations.manquantes} membres <ArrowRight /></Link>
        </section>
      </div>

      {/* Membres et derniers dons */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="carte p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Users className="size-4 text-brand-600" /> Membres</h2>
          <ul className="space-y-2 text-sm">
            {t.parType.map((p) => (
              <li key={p.libelle} className="flex justify-between"><span className="text-stone-600">{p.libelle}</span><span className="font-medium tabular-nums">{p.n}</span></li>
            ))}
            <li className="flex justify-between border-t border-stone-100 pt-2"><span className="text-stone-600">Sponsors / fondations</span><span className="font-medium tabular-nums">{t.membres.sponsors}</span></li>
            <li className="flex justify-between"><span className="text-stone-600">Moniteurs</span><span className="font-medium tabular-nums">{t.membres.moniteurs}</span></li>
            <li className="flex justify-between"><span className="text-stone-600">Abonnés au mag</span><span className="font-medium tabular-nums">{t.membres.mag}</span></li>
            <li className="flex justify-between"><span className="text-stone-600">Fiches archivées</span><span className="font-medium tabular-nums">{t.membres.archives}</span></li>
          </ul>
        </section>
        <section className="carte p-5 xl:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><PiggyBank className="size-4 text-brand-600" /> Derniers dons reçus</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {t.derniersDons.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><HandCoins className="size-4" /></span>
                <Link href={`/membres/${d.contactId}?onglet=dons`} className="min-w-0 truncate hover:text-brand-700">{nomComplet(d)}</Link>
                <span className="ml-auto whitespace-nowrap text-xs text-stone-400">{formatDate(d.date)}</span>
                <span className="w-28 text-right font-medium tabular-nums">{formatChf(Number(d.don))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
