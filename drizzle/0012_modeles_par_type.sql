CREATE TABLE "emails_types" (
	"type" text PRIMARY KEY NOT NULL,
	"objet" text NOT NULL,
	"contenu" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modeles_word" DROP CONSTRAINT "modeles_word_langue_id_langues_id_fk";
--> statement-breakpoint
ALTER TABLE "modeles_word" DROP COLUMN "langue_id";