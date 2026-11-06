# Farah Dogs — gestion de l'association

Application Next.js 16 + PostgreSQL (Drizzle ORM) : membres, chiens et remises, suivis, cotisations, dons et attestations.

## Démarrer en local

```bash
brew install postgresql@17 mdbtools && brew services start postgresql@17
createdb farahdog
echo 'DATABASE_URL=postgres://localhost:5432/farahdog' > .env
npm install
npm run db:migrate
npm run import:access -- "Gestion des membres.accdb"
npm run import:chiens -- "Chiens Stage ou Remis.xlsx"
npm run verify:access && npm run verify:chiens
npm run admin:creer        # crée le super admin « admin », mot de passe généré dans .env
npm run dev
```

`--force` sur un import remplace les données existantes. Réimporter Access efface aussi les remises de chiens :
relancer ensuite `npm run import:chiens -- --force`.

## Connexion

Toute l'application est protégée (`src/proxy.ts` + contrôle dans chaque action). Le super administrateur peut tout
faire ; il change son identifiant et son mot de passe dans **Paramètres › Compte**.

- Créer ou réinitialiser le compte : `ADMIN_IDENTIFIANT=… ADMIN_MOT_DE_PASSE=… npm run admin:creer`
- Premier démarrage sur Railway : si aucun utilisateur n'existe, la première connexion avec
  `ADMIN_IDENTIFIANT` / `ADMIN_MOT_DE_PASSE` (variables d'environnement) crée le compte.

## Reprise des données

- **Access** : chaque champ est contrôlé par `verify:access`. Les ID Access sont conservés. Une copie brute des tables
  est écrite dans `data/access-backup/` à chaque import.
- **Cotisations et dons séparés** : la table Access combinée est gardée telle quelle (`cotisations_dons`, archive) et
  éclatée en `cotisations` et `dons` (`scripts/separer.sql`). Chaque ligne garde `origine_id`. Une ligne « don seul »
  ne crée pas de cotisation vide.
- **Excel des chiens** : chaque ligne = une remise. Les chiens sont regroupés par numéro de puce. La ligne Excel
  d'origine est gardée dans `remises.source_excel`.

## Documents et envois

Quatre documents, chacun avec **un seul modèle Word et un seul e-mail** (toutes les langues dans le même document,
seules les variables `{{nom_complet}}`, `{{montant_don}}`… sont remplacées — liste dans Paramètres) :

| Document | Qui | Où |
|---|---|---|
| Attestation de cotisation | cotisation de l'année payée | Cotisations › Demandes et attestations |
| Demande de cotisation / don | cotisation de l'année « à payer » | Cotisations › Demandes et attestations |
| Don jusqu'au seuil — attestation et remerciements | total des dons ≤ seuil | Dons › Attestations |
| Don au-dessus du seuil — attestation | total des dons > seuil | Dons › Attestations |

- Seuil réglable dans **Paramètres › Seuil et serveur e-mail** (100 CHF par défaut).
- Tout est manuel : bouton « E-mail » par personne, « Envoyer à tous » (ceux qui ne l'ont pas encore reçu),
  « Courrier » pour télécharger le document, « Courriers sans e-mail » (ZIP).
- Sans modèle Word : attestation PDF intégrée ; la demande part sans pièce jointe.
- Rien ne part tout seul : boutons « Envoyer » et « Générer les courriers (ZIP) » dans **Dons › Attestations**.

## Déploiement (Railway)

Ajouter un service PostgreSQL et définir les variables :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | base PostgreSQL Railway |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE` | premier compte super admin |
| `SMTP_PASSWORD` (facultatif) | mot de passe SMTP, prioritaire sur celui saisi dans Paramètres |

Build `npm run build`, démarrage `npm run db:migrate && npm start`. Les fichiers `.accdb`, `.xlsx`, `.env` et `data/`
contiennent des données personnelles ou des secrets et ne sont pas versionnés.
