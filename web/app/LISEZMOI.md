# Code de l'app, rangé par thème

L'app charge `web/app.js`, qui est l'assemblage de ces fichiers dans l'ordre de leur numéro
(ils forment ensemble une seule fonction : chacun pris seul n'est pas du JavaScript complet).

Après une modification ici : `node tests/assemble.cjs` (les tests vérifient que `app.js` est à jour).

| Fichier | Contenu |
|---|---|
| 00-base | Outils communs, données locales, statuts |
| 01-mails | Réponses reçues par mail (Gmail) |
| 02-assistant | Assistant (instructions libres) |
| 03-accueil | Navigation, prise en main, accueil |
| 04-suivi | Entretiens, historique, tri, archives, annuler, objectif, export |
| 05-enseignements | Ce qu'il faut retenir, raison d'écart, comparateur |
| 06-entreprise-sauvegarde | Après l'entretien, fiche entreprise, sauvegarde |
| 07-fiche | Fiche candidature, glisser, spontanées, synchronisation |
| 08-salaire-expirees | Salaire conseillé, annonces expirées |
| 09-carte | Carte |
| 10-statistiques | Statistiques |
| 11-synchro-parametres-cv | Synchronisation, paramètres, profil, CV |
| 12-analyse | Analyse d'une annonce |
| 13-suggestions | Offres suggérées, doublons entre sites |
| 14-simulation | Simulation d'entretien à la voix |
| 15-pdf-generation-demarrage | PDF, génération des documents, démarrage (ferme la fonction : toujours le dernier) |
