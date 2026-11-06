INSERT INTO "parametres_envoi" ("id", "seuil_centimes", "expediteur_nom", "expediteur_email")
VALUES (1, 10000, 'Association Farah Dogs', 'info@farah-dogs.ch') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "modeles_email" ("langue_id", "objet", "contenu")
SELECT id, 'Votre attestation de don {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}},

Nous vous remercions chaleureusement pour votre don de {{montant_don}} en {{annee}}.
Grâce à vous, nous pouvons former et remettre des chiens d''assistance.

Vous trouverez votre attestation en pièce jointe.

Avec nos meilleures salutations,
{{association_nom}}'
FROM "langues" WHERE lower("libelle") = 'français' ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "modeles_email" ("langue_id", "objet", "contenu")
SELECT id, 'Ihre Spendenbestätigung {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}}

Herzlichen Dank für Ihre Spende von {{montant_don}} im Jahr {{annee}}.
Dank Ihnen können wir Assistenzhunde ausbilden und übergeben.

Ihre Bestätigung finden Sie im Anhang.

Freundliche Grüsse
{{association_nom}}'
FROM "langues" WHERE lower("libelle") = 'allemand' ON CONFLICT DO NOTHING;
