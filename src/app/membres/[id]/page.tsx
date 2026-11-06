import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Contact as ContactIcon, Dog, FileText, Mail, Plus, Trash2 } from "lucide-react";
import { getChiensChoix, getContact, getContactsChoix, getListes, getListesChiens, getMotifsSuivi, getRemisesDuContact, getSuivis } from "@/lib/data";
import { Suivis } from "@/components/Suivis";
import { formatPuce } from "@/lib/chiens";
import { RemiseForm } from "@/app/chiens/RemiseForm";
import { formatChf, formatDate, montantPourSaisie, nomComplet } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Avatar, Champ, Onglets, PageHeader, Vide } from "@/components/ui";
import { MembreForm } from "../MembreForm";
import { archiverContact, supprimerContact } from "../actions";
import { modifierCotisation, saisirCotisation, supprimerCotisation } from "@/app/cotisations/actions";
import { ajouterDon, modifierDon, supprimerDon } from "@/app/dons/actions";

export async function generateMetadata({ params }: PageProps<"/membres/[id]">) {
  const c = await getContact(Number((await params).id));
  return { title: c ? nomComplet(c) : "Membre" };
}

export default async function FicheMembre({ params, searchParams }: PageProps<"/membres/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [c, listes, remises, listesChiens, chiens, contacts, suivis, motifs] = await Promise.all([
    getContact(n), getListes(), getRemisesDuContact(n), getListesChiens(), getChiensChoix(), getContactsChoix(),
    getSuivis({ contactId: n }), getMotifsSuivi(),
  ]);
  if (!c) notFound();
  const onglet = ["chiens", "suivis", "cotisations", "dons"].includes(String(sp.onglet)) ? String(sp.onglet) : "fiche";
  const base = `/membres/${c.id}`;

  const moniteurs = contacts.filter((x) => x.moniteur).map((x) => ({ id: x.id, libelle: nomComplet(x) }));
  const choixChiens = chiens.map((x) => ({ id: x.id, libelle: `${x.nom}${x.puce ? ` — ${formatPuce(x.puce)}` : ""}` }));
  const totalCoti = c.cotisations.reduce((s, v) => s + (v.montantCentimes ?? 0), 0);
  const totalDons = c.dons.reduce((s, v) => s + (v.montantCentimes ?? 0), 0);
  const anneeCourante = new Date().getFullYear();
  const email = c.email?.split(/[\s;,]+/).find((e) => e.includes("@"));
  const libType = new Map(listes.types.map((t) => [t.id, t.libelle.replace(/^Membre /i, "")]));
  const libLangue = new Map(listes.langues.map((l) => [l.id, l.libelle]));

  return (
    <div>
      <PageHeader
        retour={{ href: "/membres", label: "Membres" }}
        avant={<Avatar texte={nomComplet(c)} />}
        titre={
          <>
            {c.formePolitesse && <span className="font-normal text-stone-400">{c.formePolitesse.libelle} </span>}
            {nomComplet(c)}
          </>
        }
        sousTitre={
          <span className="flex flex-wrap items-center gap-1.5">
            <span>Fiche n° {c.id}</span>
            {[c.codePostal, c.localite].filter(Boolean).length > 0 && <span>· {[c.codePostal, c.localite].filter(Boolean).join(" ")}</span>}
            {c.types.map((t) => <span key={t.typeId} className="badge bg-brand-50 text-brand-700">{libType.get(t.typeId)}</span>)}
            {c.sponsorFondation && <span className="badge bg-violet-50 text-violet-700">Sponsor</span>}
            {c.moniteur && <span className="badge bg-sky-50 text-sky-700">Moniteur</span>}
            {c.magazine && <span className="badge bg-stone-100 text-stone-600">Mag</span>}
            {c.langues.map((l) => <span key={l.langueId} className="badge bg-stone-100 text-stone-600">{libLangue.get(l.langueId)}</span>)}
            {c.archive && (
              <span className="badge bg-amber-100 text-amber-800">
                Archivé{c.dateArchivage ? ` le ${c.dateArchivage.toLocaleDateString("fr-CH")}` : ""}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {email && <a href={`mailto:${email}`} className="btn-secondaire"><Mail /> E-mail</a>}
            <a href={`${base}/vcard`} className="btn-secondaire" title="Télécharger la fiche pour Outlook, Contacts…"><ContactIcon /> vCard</a>
            <form action={archiverContact}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="archive" value={c.archive ? "0" : "1"} />
              <button className="btn-secondaire">{c.archive ? <><ArchiveRestore /> Désarchiver</> : <><Archive /> Archiver</>}</button>
            </form>
            <form action={supprimerContact}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton className="btn-danger" title="Supprimer" message="Supprimer définitivement cette fiche ? Cette action est irréversible.">
                <Trash2 />
              </ConfirmButton>
            </form>
          </>
        }
      />

      {sp.ok && <p className="notice-ok mb-4">Fiche enregistrée.</p>}
      {sp.erreur && <p className="notice-erreur mb-4">{String(sp.erreur)}</p>}

      <Onglets
        items={[
          { href: base, label: "Fiche", actif: onglet === "fiche" },
          { href: `${base}?onglet=chiens`, label: "Chiens", nombre: remises.length, actif: onglet === "chiens" },
          { href: `${base}?onglet=suivis`, label: "Suivis", nombre: suivis.filter((x) => x.etat !== "ferme").length, actif: onglet === "suivis" },
          { href: `${base}?onglet=cotisations`, label: "Cotisations", nombre: c.cotisations.length, actif: onglet === "cotisations" },
          { href: `${base}?onglet=dons`, label: "Dons", nombre: c.dons.length, actif: onglet === "dons" },
        ]}
      />

      {onglet === "fiche" && <MembreForm key={c.modifieLe.toISOString()} contact={c} {...listes} />}

      {onglet === "chiens" && (
        <div className="space-y-5">
          {remises.length === 0 ? (
            <Vide>Aucun chien associé à ce membre.</Vide>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {remises.map((r) => {
                const enCours = !r.dateFin && !r.motifFin;
                return (
                  <Link key={r.id} href={`/chiens/${r.chienId}?onglet=remises`} className="carte group block p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      {r.chien.photoType ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/chiens/photo/${r.chienId}?v=${r.chien.modifieLe.getTime()}`} alt="" loading="lazy" className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-stone-200" />
                      ) : (
                        <span className={`grid size-11 place-items-center rounded-xl ${enCours ? "bg-brand-50 text-brand-600" : "bg-stone-100 text-stone-400"}`}>
                          <Dog className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-stone-900 group-hover:text-brand-700">{r.chien.nom}</div>
                        <div className="text-sm text-stone-500">{r.chien.race?.libelle}</div>
                      </div>
                      {enCours ? (
                        <span className={`badge ${r.actif ? "bg-emerald-50 text-emerald-700" : "bg-orange-100 text-orange-800"}`}>{r.actif ? "en cours" : "pas actif"}</span>
                      ) : (
                        <span className="badge bg-stone-100 text-stone-600">{r.motifFin ?? "terminée"}</span>
                      )}
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div><dt className="text-xs text-stone-400">Bénéficiaire</dt><dd>{[r.beneficiairePrenom, r.beneficiaireNom].filter(Boolean).join(" ") || "—"}</dd></div>
                      <div><dt className="text-xs text-stone-400">{r.type === "stage" ? "Stage dès le" : "Reçu le"}</dt><dd>{formatDate(r.dateRemise) || "—"}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-stone-400">Besoin</dt><dd>{r.pathologies.map((p) => p.pathologie.libelle).join(", ") || "—"}</dd></div>
                      {r.dateFin && <div className="col-span-2 text-xs text-stone-500">Fin le {formatDate(r.dateFin)}</div>}
                      {r.chien.decede && <div className="col-span-2"><span className="badge bg-stone-200 text-stone-700">Chien décédé</span></div>}
                    </dl>
                  </Link>
                );
              })}
            </div>
          )}
          <details className="carte p-5" open={remises.length === 0}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-900">
              <Plus className="size-4 text-brand-600" /> Associer un chien à ce membre
            </summary>
            <div className="mt-4">
              <RemiseForm contactId={c.id} chiens={choixChiens} moniteurs={moniteurs} pathologies={listesChiens.pathologies} retour={`${base}?onglet=chiens`} />
            </div>
          </details>
        </div>
      )}

      {onglet === "suivis" && <Suivis suivis={suivis} motifs={motifs} contactId={c.id} retour={`${base}?onglet=suivis`} />}

      {onglet === "cotisations" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="carte p-5"><div className="text-sm text-stone-500">Total des cotisations</div><div className="mt-1 text-xl font-semibold tabular-nums">{formatChf(totalCoti)}</div></div>
            <div className="carte p-5"><div className="text-sm text-stone-500">Cotisations payées</div><div className="mt-1 text-xl font-semibold">{c.cotisations.filter((v) => (v.montantCentimes ?? 0) > 0).length}</div></div>
            <div className="carte p-5"><div className="text-sm text-stone-500">Dernière payée</div><div className="mt-1 text-xl font-semibold">{c.cotisations.find((v) => (v.montantCentimes ?? 0) > 0)?.annee ?? "—"}</div></div>
          </div>
          <form action={saisirCotisation} className="carte grid gap-3 p-5 sm:grid-cols-[7rem_9rem_10rem_1fr_auto] sm:items-end">
            <input type="hidden" name="contactId" value={c.id} />
            <input type="hidden" name="retour" value={`${base}?onglet=cotisations`} />
            <Champ label="Année"><input name="annee" type="number" defaultValue={anneeCourante} className="champ" /></Champ>
            <Champ label="Montant CHF"><input name="montant" inputMode="decimal" placeholder="par défaut" className="champ text-right" /></Champ>
            <Champ label="Payée le"><input name="date" type="date" className="champ" /></Champ>
            <Champ label="Remarque"><input name="remarque" className="champ" /></Champ>
            <button className="btn-principal"><Plus /> Enregistrer</button>
          </form>
          {c.cotisations.length === 0 ? <Vide>Aucune cotisation enregistrée.</Vide> : (
            <div className="carte overflow-x-auto p-2">
              <div className="grid min-w-[46rem] grid-cols-[6rem_8rem_10rem_minmax(8rem,1fr)_auto_auto_auto] gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <span>Année</span><span>Montant</span><span>Payée le</span><span>Remarque</span><span /><span /><span />
              </div>
              {c.cotisations.map((v) => (
                <form key={v.id} action={modifierCotisation} className="grid min-w-[46rem] grid-cols-[6rem_8rem_10rem_minmax(8rem,1fr)_auto_auto_auto] items-center gap-2 border-t border-stone-100 px-2 py-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="contactId" value={c.id} />
                  <input type="hidden" name="retour" value={`${base}?onglet=cotisations`} />
                  <input type="hidden" name="anneeDeduite" value={v.anneeDeduite ? "1" : "0"} />
                  <input type="hidden" name="anneeOrigine" value={v.annee ?? ""} />
                  <input name="annee" type="number" defaultValue={v.annee ?? ""} className={`champ ${v.anneeDeduite ? "border-amber-300 bg-amber-50" : ""}`} title={v.anneeDeduite ? "Année vide dans Access, déduite de la date" : undefined} />
                  <input name="montant" inputMode="decimal" defaultValue={montantPourSaisie(v.montantCentimes)} placeholder={v.montantCentimes === null ? "à payer" : ""} className="champ text-right tabular-nums" />
                  <input name="date" type="date" defaultValue={v.datePaiement ?? ""} className="champ" />
                  <input name="remarque" defaultValue={v.remarque ?? ""} className="champ" />
                  <button className="btn-secondaire">Enregistrer</button>
                  {v.annee && (v.montantCentimes ?? 0) > 0 ? (
                    <a href={`/envois/document/cotisation/${c.id}/${v.annee}`} className="btn-fantome" title={`Attestation de cotisation ${v.annee}`}><FileText /></a>
                  ) : <span className="w-8" />}
                  <ConfirmButton formAction={supprimerCotisation} className="btn-fantome text-red-600" title="Supprimer" message="Supprimer cette cotisation ?"><Trash2 /></ConfirmButton>
                </form>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === "dons" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="carte p-5"><div className="text-sm text-stone-500">Total des dons</div><div className="mt-1 text-xl font-semibold tabular-nums">{formatChf(totalDons)}</div></div>
            <div className="carte p-5"><div className="text-sm text-stone-500">Nombre de dons</div><div className="mt-1 text-xl font-semibold">{c.dons.length}</div></div>
            <div className="carte p-5"><div className="text-sm text-stone-500">Dernier don</div><div className="mt-1 text-xl font-semibold">{formatDate(c.dons[0]?.dateDon) || "—"}</div></div>
          </div>
          <form action={ajouterDon} className="carte grid gap-3 p-5 sm:grid-cols-[9rem_10rem_1fr_auto] sm:items-end">
            <input type="hidden" name="contactId" value={c.id} />
            <input type="hidden" name="retour" value={`${base}?onglet=dons`} />
            <Champ label="Montant CHF"><input name="montant" inputMode="decimal" className="champ text-right" required /></Champ>
            <Champ label="Date du don"><input name="date" type="date" className="champ" /></Champ>
            <Champ label="Remarque"><input name="remarque" className="champ" /></Champ>
            <button className="btn-principal"><Plus /> Enregistrer</button>
          </form>
          {c.dons.length === 0 ? <Vide>Aucun don enregistré.</Vide> : (
            <div className="carte overflow-x-auto p-2">
              <div className="grid min-w-[46rem] grid-cols-[6rem_8rem_10rem_minmax(8rem,1fr)_auto_auto_auto] gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <span>Année</span><span>Montant</span><span>Date</span><span>Remarque</span><span /><span /><span />
              </div>
              {c.dons.map((v) => (
                <form key={v.id} action={modifierDon} className="grid min-w-[46rem] grid-cols-[6rem_8rem_10rem_minmax(8rem,1fr)_auto_auto_auto] items-center gap-2 border-t border-stone-100 px-2 py-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="contactId" value={c.id} />
                  <input type="hidden" name="retour" value={`${base}?onglet=dons`} />
                  <input type="hidden" name="anneeDeduite" value={v.anneeDeduite ? "1" : "0"} />
                  <input type="hidden" name="anneeOrigine" value={v.annee ?? ""} />
                  <input name="annee" type="number" defaultValue={v.annee ?? ""} className={`champ ${v.anneeDeduite ? "border-amber-300 bg-amber-50" : ""}`} title={v.anneeDeduite ? "Année vide dans Access, déduite de la date" : undefined} />
                  <input name="montant" inputMode="decimal" defaultValue={montantPourSaisie(v.montantCentimes)} className="champ text-right tabular-nums" />
                  <input name="date" type="date" defaultValue={v.dateDon ?? ""} className="champ" />
                  <input name="remarque" defaultValue={v.remarque ?? ""} className="champ" />
                  <button className="btn-secondaire">Enregistrer</button>
                  {v.annee && (v.montantCentimes ?? 0) > 0 ? (
                    <a href={`/envois/document/don/${c.id}/${v.annee}`} className="btn-fantome" title={`Attestation de don ${v.annee}`}><FileText /></a>
                  ) : <span className="w-8" />}
                  <ConfirmButton formAction={supprimerDon} className="btn-fantome text-red-600" title="Supprimer" message="Supprimer ce don ?"><Trash2 /></ConfirmButton>
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
