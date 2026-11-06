import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Formes de politesse (ex-table Access « Catégorie ») : Madame, Herr, Famiglia… */
export const formesPolitesse = pgTable("formes_politesse", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

/** Langues parlées — liste modifiable. */
export const langues = pgTable("langues", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

/** Types de membre (actif, passif, honoraire…) — liste modifiable. */
export const typesMembre = pgTable("types_membre", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export const contacts = pgTable(
  "contacts",
  {
    // Les ID Access sont conservés tels quels pour garder les liaisons.
    id: serial("id").primaryKey(),
    formePolitesseId: integer("forme_politesse_id").references(() => formesPolitesse.id, {
      onDelete: "set null",
    }),
    nom: text("nom"),
    prenom: text("prenom"),
    societe: text("societe"),
    fonction: text("fonction"),
    email: text("email"),
    pageWeb: text("page_web"),
    /** Texte affiché du lien web dans Access, quand il différait de l'adresse. */
    pageWebTexte: text("page_web_texte"),
    telProfessionnel: text("tel_professionnel"),
    telPersonnel: text("tel_personnel"),
    telMobile: text("tel_mobile"),
    fax: text("fax"),
    adresse: text("adresse"),
    codePostal: text("code_postal"),
    localite: text("localite"),
    canton: text("canton"),
    pays: text("pays"),
    sponsorFondation: boolean("sponsor_fondation").notNull().default(false),
    moniteur: boolean("moniteur").notNull().default(false),
    magazine: boolean("magazine").notNull().default(false),
    archive: boolean("archive").notNull().default(false),
    dateArchivage: timestamp("date_archivage", { withTimezone: true }),
    remarques: text("remarques"),
    /** Remarques telles qu'enregistrées dans Access (texte enrichi HTML), conservées pour référence. */
    remarquesAccess: text("remarques_access"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contacts_nom_idx").on(t.nom), index("contacts_localite_idx").on(t.localite)],
);

export const contactLangues = pgTable(
  "contact_langues",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    langueId: integer("langue_id")
      .notNull()
      .references(() => langues.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.langueId] })],
);

export const contactTypes = pgTable(
  "contact_types",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    typeId: integer("type_id")
      .notNull()
      .references(() => typesMembre.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.typeId] })],
);

/**
 * ARCHIVE — ancienne table combinée cotisations + dons (copie fidèle de la table Access « cotisation-dons »).
 * Conservée telle quelle pour référence ; l'application utilise désormais `cotisations` et `dons`.
 */
export const cotisationsDons = pgTable(
  "cotisations_dons",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      // Empêche de supprimer un membre qui a un historique de paiements.
      .references(() => contacts.id, { onDelete: "restrict" }),
    annee: integer("annee"),
    /** true quand l'année était vide dans Access et a été déduite de la date de versement. */
    anneeDeduite: boolean("annee_deduite").notNull().default(false),
    cotisationCentimes: integer("cotisation_centimes"),
    dateCotisation: date("date_cotisation"),
    donCentimes: integer("don_centimes"),
    dateDon: date("date_don"),
    remarque: text("remarque"),
  },
  (t) => [index("cd_contact_idx").on(t.contactId), index("cd_annee_idx").on(t.annee)],
);

/** Cotisation annuelle d'un membre. Montant null = « à payer ». Montants en centimes. */
export const cotisations = pgTable(
  "cotisations",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    annee: integer("annee"),
    /** true quand l'année était vide dans Access et a été déduite d'une date. */
    anneeDeduite: boolean("annee_deduite").notNull().default(false),
    montantCentimes: integer("montant_centimes"),
    datePaiement: date("date_paiement"),
    remarque: text("remarque"),
    /** ID de la ligne d'origine dans l'archive Access (cotisations_dons). */
    origineId: integer("origine_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cotisations_contact_idx").on(t.contactId), index("cotisations_annee_idx").on(t.annee)],
);

/** Don d'un membre. Montants en centimes. */
export const dons = pgTable(
  "dons",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    annee: integer("annee"),
    anneeDeduite: boolean("annee_deduite").notNull().default(false),
    montantCentimes: integer("montant_centimes"),
    dateDon: date("date_don"),
    remarque: text("remarque"),
    origineId: integer("origine_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dons_contact_idx").on(t.contactId), index("dons_annee_idx").on(t.annee)],
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  formePolitesse: one(formesPolitesse, {
    fields: [contacts.formePolitesseId],
    references: [formesPolitesse.id],
  }),
  langues: many(contactLangues),
  types: many(contactTypes),
  cotisationsDons: many(cotisationsDons),
  cotisations: many(cotisations),
  dons: many(dons),
  remises: many(remises, { relationName: "beneficiaire" }),
  remisesMoniteur: many(remises, { relationName: "moniteur" }),
  suivis: many(suivis),
}));

export const cotisationsRelations = relations(cotisations, ({ one }) => ({
  contact: one(contacts, { fields: [cotisations.contactId], references: [contacts.id] }),
}));
export const donsRelations = relations(dons, ({ one }) => ({
  contact: one(contacts, { fields: [dons.contactId], references: [contacts.id] }),
}));

export const contactLanguesRelations = relations(contactLangues, ({ one }) => ({
  contact: one(contacts, { fields: [contactLangues.contactId], references: [contacts.id] }),
  langue: one(langues, { fields: [contactLangues.langueId], references: [langues.id] }),
}));

export const contactTypesRelations = relations(contactTypes, ({ one }) => ({
  contact: one(contacts, { fields: [contactTypes.contactId], references: [contacts.id] }),
  type: one(typesMembre, { fields: [contactTypes.typeId], references: [typesMembre.id] }),
}));

export const cotisationsDonsRelations = relations(cotisationsDons, ({ one }) => ({
  contact: one(contacts, { fields: [cotisationsDons.contactId], references: [contacts.id] }),
}));

// ——————————————————— Chiens ———————————————————

/** Races de chien — liste modifiable. */
export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

/** Couleurs de robe — liste modifiable. */
export const couleurs = pgTable("couleurs", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

/** Pathologies / besoins du bénéficiaire (diabète, autisme, épilepsie…) — liste modifiable. */
export const pathologies = pgTable("pathologies", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

export const chiens = pgTable(
  "chiens",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(),
    raceId: integer("race_id").references(() => races.id, { onDelete: "set null" }),
    couleurId: integer("couleur_id").references(() => couleurs.id, { onDelete: "set null" }),
    /** "M" mâle, "F" femelle, null = non renseigné. */
    sexe: text("sexe"),
    dateNaissance: date("date_naissance"),
    /** Numéro de puce ISO à 15 chiffres (les 3 premiers = pays : 756 CH, 250 F, 380 I). */
    puce: text("puce").unique(),
    reforme: boolean("reforme").notNull().default(false),
    dateReforme: date("date_reforme"),
    decede: boolean("decede").notNull().default(false),
    dateDeces: date("date_deces"),
    remarques: text("remarques"),
    /** Photo du chien (contenu en base64) et son type (image/jpeg, image/png, image/webp). */
    photo: text("photo"),
    photoType: text("photo_type"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chiens_nom_idx").on(t.nom)],
);

/**
 * Remise d'un chien à un membre (famille / bénéficiaire). Un membre peut avoir plusieurs chiens,
 * et un chien peut être remis successivement à plusieurs membres.
 */
export const remises = pgTable(
  "remises",
  {
    id: serial("id").primaryKey(),
    /** Numéro de la liste Excel « Chiens Stage ou Remis ». */
    numero: integer("numero"),
    chienId: integer("chien_id")
      .notNull()
      .references(() => chiens.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Personne qui utilise le chien, quand ce n'est pas le membre lui-même (ex. l'enfant). */
    beneficiaireNom: text("beneficiaire_nom"),
    beneficiairePrenom: text("beneficiaire_prenom"),
    /** "remise" ou "stage". */
    type: text("type").notNull().default("remise"),
    dateRemise: date("date_remise"),
    dateFin: date("date_fin"),
    /** rendu, retiré, repris, décès… */
    motifFin: text("motif_fin"),
    /** false = le chien n'est plus actif chez ce bénéficiaire (« pas actif » dans l'Excel). */
    actif: boolean("actif").notNull().default(true),
    moniteurId: integer("moniteur_id").references(() => contacts.id, { onDelete: "set null" }),
    remarques: text("remarques"),
    /** Ligne Excel d'origine, conservée telle quelle. */
    sourceExcel: text("source_excel"),
    /** Comment le membre a été retrouvé à l'import (à contrôler). */
    rapprochement: text("rapprochement"),
  },
  (t) => [index("remises_chien_idx").on(t.chienId), index("remises_contact_idx").on(t.contactId)],
);

export const remisePathologies = pgTable(
  "remise_pathologies",
  {
    remiseId: integer("remise_id")
      .notNull()
      .references(() => remises.id, { onDelete: "cascade" }),
    pathologieId: integer("pathologie_id")
      .notNull()
      .references(() => pathologies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.remiseId, t.pathologieId] })],
);

export const chiensRelations = relations(chiens, ({ one, many }) => ({
  race: one(races, { fields: [chiens.raceId], references: [races.id] }),
  couleur: one(couleurs, { fields: [chiens.couleurId], references: [couleurs.id] }),
  remises: many(remises),
  suivis: many(suivis),
}));

export const remisesRelations = relations(remises, ({ one, many }) => ({
  chien: one(chiens, { fields: [remises.chienId], references: [chiens.id] }),
  contact: one(contacts, { fields: [remises.contactId], references: [contacts.id], relationName: "beneficiaire" }),
  moniteur: one(contacts, { fields: [remises.moniteurId], references: [contacts.id], relationName: "moniteur" }),
  pathologies: many(remisePathologies),
}));

export const remisePathologiesRelations = relations(remisePathologies, ({ one }) => ({
  remise: one(remises, { fields: [remisePathologies.remiseId], references: [remises.id] }),
  pathologie: one(pathologies, { fields: [remisePathologies.pathologieId], references: [pathologies.id] }),
}));

// ——————————————————— Années de cotisation et dons ———————————————————

/** Une année de cotisation et de dons (campagne). Créée par l'utilisateur ou reprise des données. */
export const annees = pgTable("annees", {
  annee: integer("annee").primaryKey(),
  /** Montant de cotisation proposé par défaut pour cette année. */
  cotisationDefautCentimes: integer("cotisation_defaut_centimes"),
  remarque: text("remarque"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Coordonnées de l'association, utilisées sur les attestations (une seule ligne, id = 1). */
export const association = pgTable("association", {
  id: integer("id").primaryKey().default(1),
  nom: text("nom").notNull().default("Association Farah Dogs"),
  adresse: text("adresse"),
  npaLocalite: text("npa_localite"),
  email: text("email"),
  telephone: text("telephone"),
  iban: text("iban"),
  signataire: text("signataire"),
  fonctionSignataire: text("fonction_signataire"),
  lieuSignature: text("lieu_signature"),
  /** Texte libre ajouté au bas de l'attestation (ex. mention de déductibilité fiscale). */
  mentionAttestation: text("mention_attestation"),
});

// ——————————————————— Envoi des attestations de dons ———————————————————

/** Réglages d'envoi (une seule ligne, id = 1) : seuil et serveur SMTP. */
export const parametresEnvoi = pgTable("parametres_envoi", {
  id: integer("id").primaryKey().default(1),
  /** Don ≤ seuil : attestation par e-mail. Don > seuil : courrier spécifique. */
  seuilCentimes: integer("seuil_centimes").notNull().default(10000),
  smtpHote: text("smtp_hote"),
  smtpPort: integer("smtp_port").default(587),
  /** "starttls" (port 587), "ssl" (port 465) ou "aucune". */
  smtpSecurite: text("smtp_securite").notNull().default("starttls"),
  smtpUtilisateur: text("smtp_utilisateur"),
  smtpMotDePasse: text("smtp_mot_de_passe"),
  expediteurNom: text("expediteur_nom"),
  expediteurEmail: text("expediteur_email"),
  copieCachee: text("copie_cachee"),
  /** Pièce jointe de l'e-mail : "word" (modèle lié, sinon PDF) ou "pdf" (attestation intégrée). */
  pieceJointe: text("piece_jointe").notNull().default("word"),
});

/**
 * Objet et contenu de l'e-mail pour chaque type de document (toutes langues dans le même texte).
 * Types : "cotisation", "don", "don_grand", "demande". Variables {{...}}.
 */
export const emailsTypes = pgTable("emails_types", {
  type: text("type").primaryKey(),
  objet: text("objet").notNull(),
  contenu: text("contenu").notNull(),
});

/**
 * Modèles Word (.docx) déposés par l'utilisateur, avec variables {{...}} ; toutes les langues dans le même document.
 * `categorie` = type de document lié : "cotisation", "don", "don_grand" ou "demande" (un seul modèle par type).
 */
export const modelesWord = pgTable("modeles_word", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  nomFichier: text("nom_fichier").notNull(),
  fichier: text("fichier").notNull(), // contenu .docx en base64
  categorie: text("categorie"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Journal des attestations envoyées ou générées. */
export const envois = pgTable(
  "envois",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    annee: integer("annee").notNull(),
    /** "mail" ou "courrier". */
    mode: text("mode").notNull(),
    categorie: text("categorie").notNull(),
    donCentimes: integer("don_centimes").notNull(),
    destinataire: text("destinataire"),
    modeleWordId: integer("modele_word_id").references(() => modelesWord.id, { onDelete: "set null" }),
    /** "envoyé", "généré" ou "erreur". */
    statut: text("statut").notNull(),
    erreur: text("erreur"),
    le: timestamp("le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("envois_contact_annee_idx").on(t.contactId, t.annee)],
);

// ——————————————————— Suivis ———————————————————

/** Motifs de suivi — liste modifiable (visite, appel, bilan de santé…). */
export const motifsSuivi = pgTable("motifs_suivi", {
  id: serial("id").primaryKey(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
});

/** Suivi d'un membre (même sans chien) ou d'un chien : date, motif, titre, rapport, état. */
export const suivis = pgTable(
  "suivis",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    chienId: integer("chien_id").references(() => chiens.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    motifId: integer("motif_id").references(() => motifsSuivi.id, { onDelete: "set null" }),
    titre: text("titre").notNull(),
    rapport: text("rapport"),
    /** "ouvert", "en_cours" ou "ferme". */
    etat: text("etat").notNull().default("ouvert"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suivis_contact_idx").on(t.contactId), index("suivis_chien_idx").on(t.chienId)],
);

/** Photos jointes à un suivi (contenu en base64). */
export const suiviPhotos = pgTable("suivi_photos", {
  id: serial("id").primaryKey(),
  suiviId: integer("suivi_id")
    .notNull()
    .references(() => suivis.id, { onDelete: "cascade" }),
  nomFichier: text("nom_fichier").notNull(),
  type: text("type").notNull(),
  contenu: text("contenu").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const suivisRelations = relations(suivis, ({ one, many }) => ({
  contact: one(contacts, { fields: [suivis.contactId], references: [contacts.id] }),
  chien: one(chiens, { fields: [suivis.chienId], references: [chiens.id] }),
  motif: one(motifsSuivi, { fields: [suivis.motifId], references: [motifsSuivi.id] }),
  photos: many(suiviPhotos),
}));
export const suiviPhotosRelations = relations(suiviPhotos, ({ one }) => ({
  suivi: one(suivis, { fields: [suiviPhotos.suiviId], references: [suivis.id] }),
}));

// ——————————————————— Utilisateurs ———————————————————

export const utilisateurs = pgTable("utilisateurs", {
  id: serial("id").primaryKey(),
  identifiant: text("identifiant").notNull().unique(),
  nom: text("nom"),
  /** Empreinte scrypt du mot de passe (jamais le mot de passe lui-même). */
  motDePasseHash: text("mot_de_passe_hash").notNull(),
  /** "superadmin" : peut tout faire. */
  role: text("role").notNull().default("superadmin"),
  actif: boolean("actif").notNull().default(true),
  derniereConnexion: timestamp("derniere_connexion", { withTimezone: true }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  /** Empreinte SHA-256 du jeton stocké dans le cookie. */
  id: text("id").primaryKey(),
  utilisateurId: integer("utilisateur_id")
    .notNull()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});
