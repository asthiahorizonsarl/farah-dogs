CREATE TABLE "motifs_suivi" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suivi_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"suivi_id" integer NOT NULL,
	"nom_fichier" text NOT NULL,
	"type" text NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suivis" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"chien_id" integer,
	"date" date NOT NULL,
	"motif_id" integer,
	"titre" text NOT NULL,
	"rapport" text,
	"etat" text DEFAULT 'ouvert' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suivi_photos" ADD CONSTRAINT "suivi_photos_suivi_id_suivis_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suivis" ADD CONSTRAINT "suivis_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suivis" ADD CONSTRAINT "suivis_chien_id_chiens_id_fk" FOREIGN KEY ("chien_id") REFERENCES "public"."chiens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suivis" ADD CONSTRAINT "suivis_motif_id_motifs_suivi_id_fk" FOREIGN KEY ("motif_id") REFERENCES "public"."motifs_suivi"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suivis_contact_idx" ON "suivis" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "suivis_chien_idx" ON "suivis" USING btree ("chien_id");