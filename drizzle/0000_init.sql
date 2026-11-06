CREATE TABLE "contact_langues" (
	"contact_id" integer NOT NULL,
	"langue_id" integer NOT NULL,
	CONSTRAINT "contact_langues_contact_id_langue_id_pk" PRIMARY KEY("contact_id","langue_id")
);
--> statement-breakpoint
CREATE TABLE "contact_types" (
	"contact_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	CONSTRAINT "contact_types_contact_id_type_id_pk" PRIMARY KEY("contact_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"forme_politesse_id" integer,
	"nom" text,
	"prenom" text,
	"societe" text,
	"fonction" text,
	"email" text,
	"page_web" text,
	"page_web_texte" text,
	"tel_professionnel" text,
	"tel_personnel" text,
	"tel_mobile" text,
	"fax" text,
	"adresse" text,
	"code_postal" text,
	"localite" text,
	"canton" text,
	"pays" text,
	"sponsor_fondation" boolean DEFAULT false NOT NULL,
	"moniteur" boolean DEFAULT false NOT NULL,
	"magazine" boolean DEFAULT false NOT NULL,
	"archive" boolean DEFAULT false NOT NULL,
	"date_archivage" timestamp with time zone,
	"remarques" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotisations_dons" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"annee" integer,
	"annee_deduite" boolean DEFAULT false NOT NULL,
	"cotisation_centimes" integer,
	"date_cotisation" date,
	"don_centimes" integer,
	"date_don" date,
	"remarque" text
);
--> statement-breakpoint
CREATE TABLE "formes_politesse" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "langues" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "types_membre" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_langues" ADD CONSTRAINT "contact_langues_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_langues" ADD CONSTRAINT "contact_langues_langue_id_langues_id_fk" FOREIGN KEY ("langue_id") REFERENCES "public"."langues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_types" ADD CONSTRAINT "contact_types_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_types" ADD CONSTRAINT "contact_types_type_id_types_membre_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."types_membre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_forme_politesse_id_formes_politesse_id_fk" FOREIGN KEY ("forme_politesse_id") REFERENCES "public"."formes_politesse"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotisations_dons" ADD CONSTRAINT "cotisations_dons_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_nom_idx" ON "contacts" USING btree ("nom");--> statement-breakpoint
CREATE INDEX "contacts_localite_idx" ON "contacts" USING btree ("localite");--> statement-breakpoint
CREATE INDEX "cd_contact_idx" ON "cotisations_dons" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "cd_annee_idx" ON "cotisations_dons" USING btree ("annee");