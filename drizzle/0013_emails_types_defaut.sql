-- Anciennes liaisons : don ≤ seuil (« mail ») et don > seuil (« courrier »).
UPDATE "modeles_word" SET "categorie" = 'don' WHERE "categorie" = 'mail';
--> statement-breakpoint
UPDATE "modeles_word" SET "categorie" = 'don_grand' WHERE "categorie" = 'courrier';
--> statement-breakpoint
UPDATE "envois" SET "categorie" = 'don' WHERE "categorie" = 'mail';
--> statement-breakpoint
UPDATE "envois" SET "categorie" = 'don_grand' WHERE "categorie" = 'courrier';
--> statement-breakpoint
INSERT INTO "emails_types" ("type", "objet", "contenu") VALUES
('cotisation', 'Attestation de cotisation {{annee}} / Bestätigung Mitgliederbeitrag {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}}

FR – Nous vous remercions pour votre cotisation {{annee}} de {{montant_cotisation}}. Vous trouverez votre attestation en pièce jointe.

DE – Herzlichen Dank für Ihren Mitgliederbeitrag {{annee}} von {{montant_cotisation}}. Ihre Bestätigung finden Sie im Anhang.

{{association_nom}}'),
('don', 'Merci pour votre don {{annee}} / Danke für Ihre Spende {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}}

FR – Nous vous remercions chaleureusement pour votre don de {{montant_don}} en {{annee}}. Grâce à vous, nous pouvons former et remettre des chiens d''assistance. Votre attestation est en pièce jointe.

DE – Herzlichen Dank für Ihre Spende von {{montant_don}} im Jahr {{annee}}. Dank Ihnen können wir Assistenzhunde ausbilden und übergeben. Ihre Bestätigung finden Sie im Anhang.

{{association_nom}}'),
('don_grand', 'Merci pour votre généreux don {{annee}} / Danke für Ihre grosszügige Spende {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}}

FR – Votre généreux don de {{montant_don}} en {{annee}} nous touche profondément. Votre attestation est en pièce jointe.

DE – Ihre grosszügige Spende von {{montant_don}} im Jahr {{annee}} berührt uns sehr. Ihre Bestätigung finden Sie im Anhang.

{{association_nom}}'),
('demande', 'Cotisation et don {{annee}} / Mitgliederbeitrag und Spende {{annee}} – Farah Dogs',
'{{politesse}} {{nom_complet}}

FR – Votre soutien est essentiel pour former et remettre des chiens d''assistance. Merci de régler votre cotisation {{annee}} de {{cotisation_annee}} et, si vous le pouvez, de faire un don, sur le compte {{iban}}.

DE – Ihre Unterstützung ist für die Ausbildung von Assistenzhunden unerlässlich. Bitte überweisen Sie Ihren Mitgliederbeitrag {{annee}} von {{cotisation_annee}} und, wenn möglich, eine Spende auf das Konto {{iban}}.

{{association_nom}}')
ON CONFLICT DO NOTHING;
