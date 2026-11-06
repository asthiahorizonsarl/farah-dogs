import Link from "next/link";
import { AlertTriangle, Download, Mail, Send } from "lucide-react";
import { TYPES_DOC, type Destinataire, type TypeDoc } from "@/lib/envois";
import { formatChf, formatDate, nomComplet } from "@/lib/format";
import { envoyerTous, envoyerUn } from "@/app/envois/actions";

/**
 * Envoi manuel d'un type de document pour une année : bouton par personne (e-mail ou courrier)
 * et boutons « envoyer à tous » / « courriers (ZIP) ». Rien ne part tout seul.
 */
export function EnvoiPanneau({
  type, annee, destinataires, retour, modeleDepose, montant,
}: {
  type: TypeDoc;
  annee: number;
  destinataires: Destinataire[];
  retour: string;
  modeleDepose: boolean;
  montant: (d: Destinataire) => number;
}) {
  const liste = destinataires.filter((d) => d.type === type);
  const aFaire = liste.filter((d) => !d.dejaFait);
  const mails = aFaire.filter((d) => d.email).length;
  const courriers = aFaire.filter((d) => !d.email).length;
  const t = TYPES_DOC[type];

  return (
    <section className="carte overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-5">
        <div className="mr-auto min-w-64">
          <h2 className="font-semibold text-stone-900">{t.titre} {annee}</h2>
          <p className="text-sm text-stone-500">
            {t.aide} {liste.length} personne{liste.length > 1 ? "s" : ""} · {aFaire.length} à faire.
            {!modeleDepose && (type === "demande"
              ? " Aucun modèle Word : l'e-mail part sans pièce jointe et les courriers ne peuvent pas être générés."
              : " Aucun modèle Word : l'attestation PDF intégrée est utilisée.")}
          </p>
        </div>
        <form action={envoyerTous}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="annee" value={annee} />
          <input type="hidden" name="retour" value={retour} />
          <button className="btn-principal" disabled={!mails}><Send /> Envoyer à tous ({mails} e-mail{mails > 1 ? "s" : ""})</button>
        </form>
        <a href={`/envois/courriers/${type}/${annee}`} className={`btn-secondaire ${courriers && (modeleDepose || type !== "demande") ? "" : "pointer-events-none opacity-50"}`}>
          <Download /> Courriers sans e-mail ({courriers})
        </a>
      </div>

      {courriers > 0 && (
        <p className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" /> {courriers} personne{courriers > 1 ? "s n'ont" : " n'a"} pas d&apos;e-mail : envoi par courrier.
        </p>
      )}

      {liste.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-stone-500">Personne n&apos;est concerné en {annee}.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="table-liste">
            <thead className="sticky top-0"><tr><th>Membre</th><th className="text-right">Montant</th><th>Langues</th><th>Dernier envoi</th><th className="text-right">Envoyer</th></tr></thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.contact.id} className={!d.email ? "bg-amber-50/40" : ""}>
                  <td>
                    <Link href={`/membres/${d.contact.id}`} className="font-medium text-stone-900 hover:text-brand-700">{nomComplet(d.contact)}</Link>
                    <div className="text-xs text-stone-400">{d.email ?? "pas d'e-mail"}</div>
                  </td>
                  <td className="text-right tabular-nums">{formatChf(montant(d)) || "—"}</td>
                  <td className="text-stone-500">{d.langues.map((l) => l.libelle).join(", ") || "—"}</td>
                  <td className="text-xs">
                    {d.dernierEnvoi ? (
                      <span className={d.dernierEnvoi.statut === "erreur" ? "text-red-600" : "text-emerald-700"} title={d.dernierEnvoi.erreur ?? ""}>
                        {d.dernierEnvoi.statut} ({d.dernierEnvoi.mode === "mail" ? "e-mail" : "courrier"}) le {formatDate(d.dernierEnvoi.le.toISOString())}
                      </span>
                    ) : <span className="text-stone-400">—</span>}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {d.email && (
                        <form action={envoyerUn}>
                          <input type="hidden" name="type" value={type} />
                          <input type="hidden" name="annee" value={annee} />
                          <input type="hidden" name="contactId" value={d.contact.id} />
                          <input type="hidden" name="retour" value={retour} />
                          <button className="btn-secondaire px-2.5 py-1 text-xs"><Mail /> {d.dejaFait ? "Renvoyer" : "E-mail"}</button>
                        </form>
                      )}
                      {(modeleDepose || type !== "demande") && (
                        <a href={`/envois/document/${type}/${d.contact.id}/${annee}`} className="btn-fantome px-2 py-1 text-xs" title="Document à imprimer (courrier)">
                          <Download /> Courrier
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
