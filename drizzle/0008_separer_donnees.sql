-- Séparation de l'archive combinée (cotisations_dons) en deux tables : cotisations et dons.
-- Une ligne « don seul » (don > 0, sans cotisation ni date de cotisation) ne crée pas de cotisation vide.
INSERT INTO "cotisations" ("contact_id", "annee", "annee_deduite", "montant_centimes", "date_paiement", "remarque", "origine_id")
SELECT "contact_id",
  CASE WHEN "annee_deduite" AND "date_cotisation" IS NOT NULL THEN extract(year FROM "date_cotisation")::int ELSE "annee" END,
  "annee_deduite", "cotisation_centimes", "date_cotisation", "remarque", "id"
FROM "cotisations_dons"
WHERE NOT (coalesce("don_centimes", 0) > 0 AND coalesce("cotisation_centimes", 0) = 0 AND "date_cotisation" IS NULL)
ORDER BY "id";
--> statement-breakpoint
INSERT INTO "dons" ("contact_id", "annee", "annee_deduite", "montant_centimes", "date_don", "remarque", "origine_id")
SELECT "contact_id",
  CASE WHEN "annee_deduite" AND "date_don" IS NOT NULL THEN extract(year FROM "date_don")::int ELSE "annee" END,
  "annee_deduite", "don_centimes", "date_don",
  CASE WHEN coalesce("don_centimes", 0) > 0 AND coalesce("cotisation_centimes", 0) = 0 AND "date_cotisation" IS NULL THEN "remarque" END,
  "id"
FROM "cotisations_dons"
WHERE "don_centimes" > 0 OR "date_don" IS NOT NULL
ORDER BY "id";
