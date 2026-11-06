-- Années déjà présentes dans les données, avec le montant de cotisation le plus fréquent.
INSERT INTO "annees" ("annee", "cotisation_defaut_centimes")
SELECT annee, mode() WITHIN GROUP (ORDER BY cotisation_centimes) FILTER (WHERE cotisation_centimes > 0)
FROM "cotisations_dons" WHERE annee IS NOT NULL GROUP BY annee
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "association" ("id", "nom", "adresse", "npa_localite", "email", "telephone", "iban", "lieu_signature")
VALUES (1, 'Association Farah Dogs', 'Rte du Chenil 17', '3960 Sierre', 'info@farah-dogs.ch', '+41 27 306 14 27', 'CH49 0900 0000 1471 8978 0', 'Sierre')
ON CONFLICT DO NOTHING;
