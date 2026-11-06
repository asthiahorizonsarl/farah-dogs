CREATE TABLE "chiens" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"race_id" integer,
	"couleur_id" integer,
	"sexe" text,
	"date_naissance" date,
	"puce" text,
	"reforme" boolean DEFAULT false NOT NULL,
	"date_reforme" date,
	"decede" boolean DEFAULT false NOT NULL,
	"date_deces" date,
	"remarques" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chiens_puce_unique" UNIQUE("puce")
);
--> statement-breakpoint
CREATE TABLE "couleurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pathologies" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remise_pathologies" (
	"remise_id" integer NOT NULL,
	"pathologie_id" integer NOT NULL,
	CONSTRAINT "remise_pathologies_remise_id_pathologie_id_pk" PRIMARY KEY("remise_id","pathologie_id")
);
--> statement-breakpoint
CREATE TABLE "remises" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" integer,
	"chien_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"beneficiaire_nom" text,
	"beneficiaire_prenom" text,
	"type" text DEFAULT 'remise' NOT NULL,
	"date_remise" date,
	"date_fin" date,
	"motif_fin" text,
	"actif" boolean DEFAULT true NOT NULL,
	"moniteur_id" integer,
	"remarques" text,
	"source_excel" text,
	"rapprochement" text
);
--> statement-breakpoint
ALTER TABLE "chiens" ADD CONSTRAINT "chiens_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chiens" ADD CONSTRAINT "chiens_couleur_id_couleurs_id_fk" FOREIGN KEY ("couleur_id") REFERENCES "public"."couleurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remise_pathologies" ADD CONSTRAINT "remise_pathologies_remise_id_remises_id_fk" FOREIGN KEY ("remise_id") REFERENCES "public"."remises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remise_pathologies" ADD CONSTRAINT "remise_pathologies_pathologie_id_pathologies_id_fk" FOREIGN KEY ("pathologie_id") REFERENCES "public"."pathologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remises" ADD CONSTRAINT "remises_chien_id_chiens_id_fk" FOREIGN KEY ("chien_id") REFERENCES "public"."chiens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remises" ADD CONSTRAINT "remises_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remises" ADD CONSTRAINT "remises_moniteur_id_contacts_id_fk" FOREIGN KEY ("moniteur_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chiens_nom_idx" ON "chiens" USING btree ("nom");--> statement-breakpoint
CREATE INDEX "remises_chien_idx" ON "remises" USING btree ("chien_id");--> statement-breakpoint
CREATE INDEX "remises_contact_idx" ON "remises" USING btree ("contact_id");