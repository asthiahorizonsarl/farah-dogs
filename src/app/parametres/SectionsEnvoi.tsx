import { Download, Trash2, Upload } from "lucide-react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { TYPES_DOC, VARIABLES, getParametresEnvoi, type TypeDoc } from "@/lib/envois";
import { montantPourSaisie } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Champ } from "@/components/ui";
import { deposerModeleWord, enregistrerEmailType, enregistrerEnvoi, lierModeleWord, supprimerModeleWord, testerSmtp } from "./envois-actions";

function Carte({ id, titre, aide, children }: { id: string; titre: string; aide: string; children: React.ReactNode }) {
  return (
    <section id={id} className="carte scroll-mt-6 overflow-hidden">
      <div className="border-b border-stone-100 px-5 py-4">
        <h3 className="font-semibold text-stone-900">{titre}</h3>
        <p className="text-sm text-stone-500">{aide}</p>
      </div>
      {children}
    </section>
  );
}

const TYPES = Object.entries(TYPES_DOC) as [TypeDoc, (typeof TYPES_DOC)[TypeDoc]][];

export async function SectionsEnvoi({ message }: { message?: { section?: string; ok?: string; erreur?: string } }) {
  const [p, emails, modeles] = await Promise.all([
    getParametresEnvoi(),
    db.select().from(schema.emailsTypes),
    db.select({ id: schema.modelesWord.id, nom: schema.modelesWord.nom, nomFichier: schema.modelesWord.nomFichier,
      categorie: schema.modelesWord.categorie, creeLe: schema.modelesWord.creeLe })
      .from(schema.modelesWord).orderBy(asc(schema.modelesWord.nom)),
  ]);
  const nonLies = modeles.filter((m) => !m.categorie || !(m.categorie in TYPES_DOC));

  return (
    <>
      {/* Seuil et SMTP */}
      <Carte id="envois" titre="Seuil et serveur e-mail" aide="Seuil qui sépare les deux attestations de dons, et serveur d'envoi des e-mails. Tous les envois sont manuels.">
        {message?.section === "envois" && (message.erreur || message.ok) && (
          <p className={`m-5 mb-0 ${message.erreur ? "notice-erreur" : "notice-ok"}`}>{message.erreur ?? message.ok}</p>
        )}
        <form action={enregistrerEnvoi}>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
              <Champ label="Seuil des dons (CHF)"><input name="seuil" inputMode="decimal" defaultValue={montantPourSaisie(p.seuilCentimes)} className="champ text-right" /></Champ>
              <p className="pb-2 text-sm text-stone-500">Total des dons de l&apos;année ≤ seuil → modèle « attestation et remerciements ». Au-dessus → modèle « don au-dessus du seuil ».</p>
            </div>
            <div className="grid gap-4 border-t border-stone-100 pt-5 sm:grid-cols-2">
              <Champ label="Serveur SMTP"><input name="smtpHote" defaultValue={p.smtpHote ?? ""} placeholder="ex. mail.infomaniak.com" className="champ" /></Champ>
              <div className="grid grid-cols-2 gap-4">
                <Champ label="Port"><input name="smtpPort" type="number" defaultValue={p.smtpPort ?? 587} className="champ" /></Champ>
                <Champ label="Sécurité">
                  <select name="smtpSecurite" defaultValue={p.smtpSecurite} className="champ">
                    <option value="starttls">STARTTLS (587)</option>
                    <option value="ssl">SSL/TLS (465)</option>
                    <option value="aucune">Aucune</option>
                  </select>
                </Champ>
              </div>
              <Champ label="Utilisateur"><input name="smtpUtilisateur" defaultValue={p.smtpUtilisateur ?? ""} autoComplete="off" className="champ" /></Champ>
              <Champ label="Mot de passe">
                <input name="smtpMotDePasse" type="password" autoComplete="new-password" placeholder={p.smtpMotDePasse ? "•••••••• (enregistré, laisser vide pour garder)" : ""} className="champ" />
              </Champ>
              <Champ label="Nom de l'expéditeur"><input name="expediteurNom" defaultValue={p.expediteurNom ?? ""} className="champ" /></Champ>
              <Champ label="E-mail de l'expéditeur"><input name="expediteurEmail" defaultValue={p.expediteurEmail ?? ""} className="champ" /></Champ>
              <Champ label="Copie cachée (facultatif)"><input name="copieCachee" defaultValue={p.copieCachee ?? ""} placeholder="ex. archive@farah-dogs.ch" className="champ" /></Champ>
            </div>
            {p.smtpMotDePasse && (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" name="effacerMotDePasse" className="size-4 accent-brand-600" /> Effacer le mot de passe enregistré
              </label>
            )}
          </div>
          <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-3"><button className="btn-principal">Enregistrer</button></div>
        </form>
        <form action={testerSmtp} className="flex flex-wrap items-end gap-3 border-t border-stone-100 px-5 py-4">
          <Champ label="Tester l'envoi vers" className="min-w-64 flex-1"><input name="adresseTest" type="email" placeholder="votre@adresse.ch" className="champ" /></Champ>
          <button className="btn-secondaire">Envoyer un e-mail de test</button>
        </form>
      </Carte>

      {/* Un bloc par type de document : modèle Word + e-mail */}
      <section id="modeles" className="scroll-mt-6 space-y-5">
        <p className="text-sm text-stone-500">
          Un modèle Word et un e-mail par document. Mettez toutes les langues dans le même document : seules les variables
          <code className="mx-1 rounded bg-stone-100 px-1">{"{{…}}"}</code>sont remplacées. Le Word rempli est converti en PDF,
          puis envoyé en pièce jointe ou téléchargé pour le courrier.
        </p>

        {TYPES.map(([type, info]) => {
          const modele = modeles.find((m) => m.categorie === type);
          const email = emails.find((e) => e.type === type);
          return (
            <Carte key={type} id={`modele-${type}`} titre={info.titre} aide={info.aide}>
              <div className="grid gap-0 2xl:grid-cols-2">
                <div className="space-y-3 border-b border-stone-100 p-5 2xl:border-b-0 2xl:border-r">
                  <h4 className="text-sm font-semibold">Modèle Word</h4>
                  {modele ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{modele.nom}</div>
                        <div className="text-xs text-stone-500">{modele.nomFichier} · {modele.creeLe.toLocaleDateString("fr-CH")}</div>
                      </div>
                      <a href={`/parametres/modeles-word/${modele.id}`} className="btn-fantome" title="Télécharger pour le modifier"><Download /></a>
                      <form action={supprimerModeleWord}>
                        <input type="hidden" name="id" value={modele.id} />
                        <ConfirmButton className="btn-fantome text-red-600" title="Supprimer" message={`Supprimer le modèle « ${modele.nom} » ?`}><Trash2 /></ConfirmButton>
                      </form>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-stone-200 px-3 py-2 text-sm text-stone-500">
                      {type === "don_grand" ? "Aucun modèle propre : celui des dons jusqu'au seuil est utilisé." : "Aucun modèle : ce document ne peut pas être envoyé tant qu'un Word n'est pas déposé."}
                    </p>
                  )}
                  <form action={deposerModeleWord} className="space-y-2">
                    <input type="hidden" name="type" value={type} />
                    <input name="fichier" type="file" accept=".docx" required className="champ file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-2 file:py-1 file:text-sm" />
                    <div className="flex gap-2">
                      <input name="nom" placeholder="Nom du modèle (facultatif)" className="champ" />
                      <button className="btn-secondaire"><Upload /> {modele ? "Remplacer" : "Déposer"}</button>
                    </div>
                  </form>
                </div>
                <form action={enregistrerEmailType} className="space-y-3 p-5">
                  <input type="hidden" name="type" value={type} />
                  <h4 className="text-sm font-semibold">E-mail</h4>
                  <Champ label="Objet"><input name="objet" defaultValue={email?.objet ?? ""} className="champ" required /></Champ>
                  <Champ label="Contenu"><textarea name="contenu" defaultValue={email?.contenu ?? ""} rows={9} className="champ resize-y font-mono text-[13px]" required /></Champ>
                  <button className="btn-secondaire">Enregistrer l&apos;e-mail</button>
                </form>
              </div>
            </Carte>
          );
        })}

        {nonLies.length > 0 && (
          <Carte id="modeles-non-lies" titre="Modèles non utilisés" aide="Modèles déposés qui ne sont liés à aucun document.">
            {nonLies.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3 last:border-0">
                <span className="min-w-48 flex-1 font-medium">{m.nom} <span className="text-xs font-normal text-stone-400">{m.nomFichier}</span></span>
                <form action={lierModeleWord} className="flex gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <select name="type" defaultValue="" className="champ w-80" aria-label="Document">
                    <option value="">— choisir le document —</option>
                    {TYPES.map(([k, v]) => <option key={k} value={k}>{v.titre}</option>)}
                  </select>
                  <button className="btn-secondaire">Utiliser</button>
                </form>
                <form action={supprimerModeleWord}>
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton className="btn-fantome text-red-600" title="Supprimer" message={`Supprimer le modèle « ${m.nom} » ?`}><Trash2 /></ConfirmButton>
                </form>
              </div>
            ))}
          </Carte>
        )}

        <details className="carte px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold">Variables disponibles dans les modèles et les e-mails</summary>
          <p className="mt-2 text-xs text-stone-500">Écrivez-les telles quelles dans Word ou dans l&apos;e-mail, par exemple <code className="rounded bg-stone-100 px-1">{"{{nom_complet}}"}</code>.</p>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {VARIABLES.map((v) => (
              <div key={v.nom} className="flex gap-3">
                <dt><code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{`{{${v.nom}}}`}</code></dt>
                <dd className="text-stone-500">{v.description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </>
  );
}
