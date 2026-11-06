CREATE TABLE "annees" (
	"annee" integer PRIMARY KEY NOT NULL,
	"cotisation_defaut_centimes" integer,
	"remarque" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"nom" text DEFAULT 'Association Farah Dogs' NOT NULL,
	"adresse" text,
	"npa_localite" text,
	"email" text,
	"telephone" text,
	"iban" text,
	"signataire" text,
	"fonction_signataire" text,
	"lieu_signature" text,
	"mention_attestation" text
);
