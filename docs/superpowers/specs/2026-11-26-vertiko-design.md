# Vertiko — conception (étape 1 : la preuve à 0 €)

## Pourquoi
Le porteur du projet veut lancer Vertiko, un outil qui fabrique des shorts (concurrent fonctionnel de ShortCrew,
avec sa propre marque, ses textes et ses visuels). Il ne veut **rien dépenser** tant qu'il n'est pas convaincu :
il faut lui montrer (1) de vrais shorts de bonne qualité et (2) une stratégie chiffrée pour gagner de l'argent.
Ensuite il investira (Stripe, compte Apple, domaine, publicité).

## Objectifs
- Un **moteur** qui va du sujet au fichier vidéo prêt à publier : texte → voix → animation (3D, dessin animé,
  schéma animé) → sous-titres → montage 1080×1920 → vérification image par image → kit de publication.
- Une dizaine de **shorts d'exemple** dans les 3 styles.
- Un **dossier stratégie** : cible, prix, acquisition, rentabilité, test de demande gratuit.
- La **page de vente** (déjà faite, `vertiko/index.html`) branchée sur une liste d'attente gratuite.

## Hors périmètre de l'étape 1
- App installable Mac/Windows (étape 2, réutilise ce moteur).
- Paiement, comptes clients, signature de l'app.
- Publication automatique réelle (nécessite des comptes TikTok/Instagram/YouTube).

## Anti-objectifs
- Copier les textes, la marque, les visuels ou les avis de ShortCrew.
- Des shorts qui ont l'air bâclés : la qualité visuelle est le produit.
- Toute dépense.

## Approches envisagées
1. **La preuve d'abord** (choisie) : moteur + vrais shorts + stratégie, tout gratuit, exécuté dans la session.
2. App complète d'emblée : long, et on construit avant de savoir si la qualité vend.
3. Stratégie + maquettes : rapide mais ne prouve rien sur la qualité.

## Choix techniques (décidés par Claude)
- **Animation** : Remotion (React → vidéo), gratuit pour un particulier / petite structure.
  3D avec @remotion/three (three.js), dessin animé et schéma animé en SVG animé.
- **Voix** : Piper (voix française libre, locale, gratuite).
- **Montage / vérification** : ffmpeg (extraction de 6 images réparties sur tout le short).
- **Cerveau** (idées, texte, scénario, contrôle) : à l'étape 1, Claude dans cette session écrit le scénario
  au format JSON. Le même format servira à l'étape 2 avec l'API Claude.
- Un scénario = un fichier JSON (titre, style, scènes avec texte dit et description visuelle) → une commande
  produit `short.mp4`, `frames/`, `publication.json`.

## Laissé au constructeur
Détails des modèles d'animation, palettes, rythme des sous-titres.
