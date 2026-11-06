CREATE TABLE "envois" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"annee" integer NOT NULL,
	"mode" text NOT NULL,
	"categorie" text NOT NULL,
	"don_centimes" integer NOT NULL,
	"destinataire" text,
	"modele_word_id" integer,
	"statut" text NOT NULL,
	"erreur" text,
	"le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modeles_email" (
	"langue_id" integer PRIMARY KEY NOT NULL,
	"objet" text NOT NULL,
	"contenu" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modeles_word" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"nom_fichier" text NOT NULL,
	"fichier" text NOT NULL,
	"langue_id" integer,
	"categorie" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametres_envoi" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"seuil_centimes" integer DEFAULT 10000 NOT NULL,
	"smtp_hote" text,
	"smtp_port" integer DEFAULT 587,
	"smtp_securite" text DEFAULT 'starttls' NOT NULL,
	"smtp_utilisateur" text,
	"smtp_mot_de_passe" text,
	"expediteur_nom" text,
	"expediteur_email" text,
	"copie_cachee" text,
	"piece_jointe" text DEFAULT 'word' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "envois" ADD CONSTRAINT "envois_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envois" ADD CONSTRAINT "envois_modele_word_id_modeles_word_id_fk" FOREIGN KEY ("modele_word_id") REFERENCES "public"."modeles_word"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_email" ADD CONSTRAINT "modeles_email_langue_id_langues_id_fk" FOREIGN KEY ("langue_id") REFERENCES "public"."langues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_word" ADD CONSTRAINT "modeles_word_langue_id_langues_id_fk" FOREIGN KEY ("langue_id") REFERENCES "public"."langues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "envois_contact_annee_idx" ON "envois" USING btree ("contact_id","annee");