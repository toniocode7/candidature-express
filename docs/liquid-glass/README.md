# Liquid Glass (mis de côté)

Style Liquid Glass (iOS 26) préparé pour Candidature Express, **non appliqué** : le design actuel est gardé pour le moment.

- `fonds-accueil.png`, `fonds-offres.png` : maquettes des 3 fonds calmes retenus comme pistes
  (1 · Indigo profond, 2 · Noir Apple, 3 · Gris clair Apple). Conseil : 1 en mode sombre, 3 en mode clair.
- `liquid-glass.patch` : première version de la couche de styles (verre, capsule d'onglets, boutons indigo).
  Elle utilise encore le fond multicolore, jugé trop chargé : à remplacer par un des fonds calmes avant de l'appliquer.

Principes à garder si on reprend :
- apparence seulement, aucune fonctionnalité touchée ; les 5 onglets et leurs noms restent ;
- vrai flou du verre réservé à ce qui flotte (barre d'onglets, boutons du haut, fenêtres, bandeau Annuler),
  cartes en verre translucide sans flou pour garder un défilement fluide ;
- l'indigo de l'app (#4338CA) reste la couleur d'action.

Pour reprendre : `git apply docs/liquid-glass/liquid-glass.patch`, changer le fond, puis tout revérifier
(affichage 390 et 1440 px, tests, parcours des fonctionnalités).
