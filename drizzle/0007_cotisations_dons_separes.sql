CREATE TABLE "cotisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"annee" integer,
	"annee_deduite" boolean DEFAULT false NOT NULL,
	"montant_centimes" integer,
	"date_paiement" date,
	"remarque" text,
	"origine_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dons" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"annee" integer,
	"annee_deduite" boolean DEFAULT false NOT NULL,
	"montant_centimes" integer,
	"date_don" date,
	"remarque" text,
	"origine_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotisations" ADD CONSTRAINT "cotisations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dons" ADD CONSTRAINT "dons_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotisations_contact_idx" ON "cotisations" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "cotisations_annee_idx" ON "cotisations" USING btree ("annee");--> statement-breakpoint
CREATE INDEX "dons_contact_idx" ON "dons" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "dons_annee_idx" ON "dons" USING btree ("annee");