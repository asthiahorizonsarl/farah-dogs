import Link from "next/link";
import { notFound } from "next/navigation";
import { Dog, Plus, Trash2 } from "lucide-react";
import { getChien, getContactsChoix, getListesChiens, getMotifsSuivi, getSuivis } from "@/lib/data";
import { Suivis } from "@/components/Suivis";
import { age, formatPuce, paysPuce, remiseEnCours, statutChien } from "@/lib/chiens";
import { formatDate, libelleContact, nomComplet } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Onglets, PageHeader, Vide } from "@/components/ui";
import { ChienForm } from "../ChienForm";
import { RemiseForm } from "../RemiseForm";
import { supprimerChien } from "../actions";

export async function generateMetadata({ params }: PageProps<"/chiens/[id]">) {
  const c = await getChien(Number((await params).id));
  return { title: c?.nom ?? "Chien" };
}

export default async function FicheChien({ params, searchParams }: PageProps<"/chiens/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const [c, listes, contacts, suivis, motifs] = await Promise.all([
    getChien(n), getListesChiens(), getContactsChoix(), getSuivis({ chienId: n }), getMotifsSuivi(),
  ]);
  if (!c) notFound();
  const onglet = sp.onglet === "remises" || sp.onglet === "suivis" ? sp.onglet : "fiche";
  const base = `/chiens/${c.id}`;

  const s = statutChien(c);
  const enCours = remiseEnCours(c.remises);
  const membres = contacts.filter((x) => !x.archive).map((x) => ({ id: x.id, libelle: libelleContact(x) }));
  // Un membre archivé déjà lié à une remise doit rester sélectionnable.
  for (const r of c.remises) {
    const x = contacts.find((k) => k.id === r.contactId);
    if (x?.archive) membres.push({ id: x.id, libelle: libelleContact(x) });
  }
  const moniteurs = contacts.filter((x) => x.moniteur).map((x) => ({ id: x.id, libelle: nomComplet(x) }));
  const retour = `${base}?onglet=remises`;

  return (
    <div>
      <PageHeader
        retour={{ href: "/chiens", label: "Chiens" }}
        avant={
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Dog className="size-7" />
          </span>
        }
        titre={<span className="flex items-center gap-3">{c.nom} <span className={`badge ${s.couleur}`}>{s.label}</span></span>}
        sousTitre={
          <>
            {[c.race?.libelle, c.couleur?.libelle, c.sexe === "F" ? "Femelle" : c.sexe === "M" ? "Mâle" : null,
              c.dateNaissance && `né le ${formatDate(c.dateNaissance)} (${age(c.dateNaissance)})`].filter(Boolean).join(" · ")}
            {c.puce && <span className="ml-2 font-mono text-xs">puce {paysPuce(c.puce)} {formatPuce(c.puce)}</span>}
            {enCours && (
              <span className="mt-1 block">
                Chez <Link href={`/membres/${enCours.contactId}?onglet=chiens`} className="lien">{nomComplet(enCours.contact)}</Link>
                {enCours.beneficiairePrenom && <> pour {enCours.beneficiairePrenom}</>} depuis le {formatDate(enCours.dateRemise)}
              </span>
            )}
          </>
        }
        actions={
          <form action={supprimerChien}>
            <input type="hidden" name="id" value={c.id} />
            <ConfirmButton className="btn-danger" title="Supprimer" message={`Supprimer définitivement ${c.nom} et ses ${c.remises.length} remise(s) ?`}>
              <Trash2 /> Supprimer
            </ConfirmButton>
          </form>
        }
      />

      {sp.ok && <p className="notice-ok mb-4">Enregistré.</p>}
      {sp.erreur && <p className="notice-erreur mb-4">{String(sp.erreur)}</p>}

      <Onglets
        items={[
          { href: base, label: "Fiche", actif: onglet === "fiche" },
          { href: retour, label: "Remises", nombre: c.remises.length, actif: onglet === "remises" },
          { href: `${base}?onglet=suivis`, label: "Suivis", nombre: suivis.filter((x) => x.etat !== "ferme").length, actif: onglet === "suivis" },
        ]}
      />

      {onglet === "fiche" && <ChienForm key={c.modifieLe.toISOString()} chien={c} races={listes.races} couleurs={listes.couleurs} />}

      {onglet === "suivis" && <Suivis suivis={suivis} motifs={motifs} chienId={c.id} retour={`${base}?onglet=suivis`} />}

      {onglet === "remises" && (
        <div className="space-y-4">
          {c.remises.length === 0 && <Vide>{c.nom} n&apos;a encore été remis à personne.</Vide>}
          <ol className="relative space-y-4 border-l-2 border-stone-200 pl-6">
            {c.remises.map((r) => {
              const actuelle = r === enCours;
              return (
                <li key={r.id} className="relative">
                  <span className={`absolute -left-[33px] top-5 size-4 rounded-full border-4 border-fond ${actuelle ? "bg-brand-600" : "bg-stone-300"}`} />
                  <details className="carte" open={actuelle}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-sm">
                      <span className="font-semibold text-stone-900">{nomComplet(r.contact)}</span>
                      {r.beneficiairePrenom && <span className="text-stone-500">pour {r.beneficiairePrenom}</span>}
                      <span className="text-stone-400">
                        {r.type === "stage" ? "Stage" : "Remise"} le {formatDate(r.dateRemise) || "?"}
                        {r.numero !== null && ` · N° ${r.numero}`}
                      </span>
                      {(r.dateFin || r.motifFin) ? (
                        <span className="badge bg-stone-100 text-stone-600">{r.motifFin ?? "terminée"}{r.dateFin && ` le ${formatDate(r.dateFin)}`}</span>
                      ) : (
                        <span className={`badge ${r.actif ? "bg-emerald-50 text-emerald-700" : "bg-orange-100 text-orange-800"}`}>{r.actif ? "en cours" : "pas actif"}</span>
                      )}
                      {r.pathologies.map((p) => <span key={p.pathologieId} className="badge bg-brand-50 text-brand-700">{p.pathologie.libelle}</span>)}
                      <Link href={`/membres/${r.contactId}?onglet=chiens`} className="lien ml-auto text-sm">Fiche du membre →</Link>
                    </summary>
                    <div className="border-t border-stone-100 p-5">
                      <RemiseForm remise={r} chienId={c.id} membres={membres} moniteurs={moniteurs} pathologies={listes.pathologies} retour={retour} />
                      {r.rapprochement && <p className="mt-3 text-xs text-stone-400">Import Excel : membre retrouvé par « {r.rapprochement} ».</p>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
          <details className="carte p-5" open={c.remises.length === 0}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-900">
              <Plus className="size-4 text-brand-600" /> Remettre {c.nom} à un membre
            </summary>
            <div className="mt-4">
              <RemiseForm chienId={c.id} membres={membres} moniteurs={moniteurs} pathologies={listes.pathologies} retour={retour} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
