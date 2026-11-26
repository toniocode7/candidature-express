# Vertiko — stratégie pour gagner de l'argent

*Version 1 — 26 novembre 2026. Tous les chiffres marqués « hypothèse » sont à vérifier par les tests ci-dessous avant de dépenser.*

## 1. Ce que montre le marché

- **ShortCrew prouve la demande en France** : une app en français qui fabrique des shorts, vendue **une seule fois 59 à 97 €**, revendique **plus de 50 acheteurs** pendant sa pré-vente, surtout via X (comptes finance, créateurs de « faits »).
- **Les concurrents se louent au mois** : de 9 à 39 € par mois, soit 108 à 468 € par an (Revid, HeyGen, Klap, InVideo, Submagic, OpusClip — prix publics relevés par ShortCrew, à revérifier).
- **Deux publics paient** :
  1. les **créateurs** (chaînes de faits, finance, animaux, histoire, jeux vidéo) qui veulent publier tous les jours sans monter ;
  2. les **commerces locaux** (artisans, boutiques, garages, salons) qui savent qu'il faut des vidéos mais n'ont ni le temps ni l'envie de filmer.

## 2. Notre angle : ce qui fera choisir Vertiko

| | ShortCrew | Vertiko |
|---|---|---|
| Ce qu'il faut à côté | Abonnement Claude Pro/Max (~20 € / mois minimum) | **Une clé API payée à l'usage : environ 0,30 à 0,50 € par short** (hypothèse, voir §4) |
| Voix | Voix gratuite + ElevenLabs en option | Voix française gratuite intégrée + ElevenLabs en option |
| Commerces | Une section de la page | **Une offre dédiée** (modèles par métier, offre en fin de short) |
| Langue | Français | Français |

**Message clé :** « Tes shorts, faits pour toi. Tu paies l'app une fois, puis quelques centimes par short. Pas d'abonnement, nulle part. »

## 3. Le plan en 3 étapes (on ne paie qu'une fois l'étape précédente réussie)

### Étape A — Tester la demande (0 €, 3 semaines)
1. Mettre la page `vertiko/index.html` en ligne **gratuitement** (GitHub Pages ou Vercel) avec la liste d'attente branchée sur Supabase (gratuit).
2. Ouvrir **un compte TikTok + YouTube Shorts « Vertiko »** et y publier les shorts fabriqués par Vertiko, 1 par jour. C'est à la fois la démo et la pub.
3. Raconter la construction sur X / LinkedIn (« je construis un outil qui fait mes shorts, voici le résultat du jour »). C'est ce qui a lancé ShortCrew.
4. **Démarcher 20 commerces** autour de toi avec un short d'exemple fait pour *leur* métier (le moteur le fait en 2 minutes).

**Seuil pour passer à l'étape B** (à fixer ensemble, proposition) :
- **150 inscrits** sur la liste d'attente, **ou**
- **5 commerces** qui disent « oui, je paierais pour ça », **ou**
- un short du compte Vertiko qui dépasse **10 000 vues**.

### Étape B — Premières ventes (≈ 25 € de frais)
- **Service « fait pour toi » aux commerces** : tu fabriques leurs shorts avec le moteur (aucune app à installer). Hypothèse de prix : **149 € / mois pour 12 shorts**. Coût pour toi : ~6 € d'IA + ton temps de validation (~1 h / mois / client).
- **Pré-vente de l'app aux créateurs** à prix de lancement par paliers (49 → 59 → 69 → 97 €), comme sur la page.
- Frais : statut auto-entrepreneur (gratuit), compte Stripe (gratuit, ~1,5 % + 0,25 € par paiement en Europe), domaine (~10 € / an).

### Étape C — L'app installable (≈ 99 $ / an + pub éventuelle)
- App Mac + Windows qui reprend ce moteur (même code), avec le cerveau branché sur la clé API du client.
- Compte développeur Apple (99 $ / an) pour que le Mac ne bloque pas l'app.
- Programme d'affiliation : **30 % pour les créateurs** qui la recommandent.

## 4. Les chiffres

**Coût d'un short pour le client (hypothèse, Claude Opus 5.5 à 4 $ / 20 $ par million de jetons) :**
- écrire le scénario : ~0,15 $
- vérifier les images : ~0,06 $
- proposer des sujets avec recherche web : ~0,10 à 0,30 $ (pour plusieurs shorts)
- **≈ 0,30 à 0,50 € par short**, soit **10 à 15 € pour 30 shorts par mois**.
- Animation, voix et montage : 0 € (faits sur l'ordinateur du client).

**Seuil de rentabilité** : les frais fixes de l'étape C sont d'environ 110 € / an. **2 ventes à 69 € les remboursent.**

**Trois scénarios sur 12 mois (hypothèses, pas des promesses) :**

| | Prudent | Moyen | Bon |
|---|---|---|---|
| Ventes de l'app (prix moyen 75 €) | 40 | 150 | 400 |
| Clients commerces à 149 € / mois (moyenne sur l'année) | 1 | 4 | 10 |
| **Chiffre d'affaires** | **≈ 4 800 €** | **≈ 18 400 €** | **≈ 47 900 €** |

Repère réel : ShortCrew annonce 50+ ventes en pré-vente, ce qui place le scénario « prudent » à portée.

## 5. Les risques et comment on les réduit

| Risque | Réponse |
|---|---|
| Les shorts ne font pas de vues | On ne promet jamais de vues. On vend la **régularité** et le temps gagné. On mesure sur notre propre compte avant de vendre. |
| Les plateformes pénalisent l'IA | Elles écartent surtout le contenu répétitif ou copié : chaque short a une histoire neuve, rien ne part sans validation, l'étiquette « IA » est rappelée dans le kit de publication. |
| ShortCrew baisse ses prix | Notre différence : pas d'abonnement Claude obligatoire, offre commerces, voix intégrée. |
| Erreurs de faits | Le scénario cite ses sources, et l'utilisateur valide avant publication. |
| Dépendance à Claude | Le cerveau est un seul fichier (`engine/lib/brain.mjs`) : on peut changer de fournisseur. |
| Obligations légales | Auto-entreprise, CGV, mentions légales, RGPD pour la liste d'attente, renonciation au droit de rétractation pour un contenu numérique livré immédiatement. Modèles à rédiger à l'étape B. |

## 6. Ce qu'il te faut décider

1. Le seuil de passage à l'étape B (proposition au §3).
2. Commencer par les **commerces** (argent plus rapide, plus de temps passé) ou par les **créateurs** (plus de volume, plus lent) — ma recommandation : **les deux en parallèle à l'étape A**, puis on garde ce qui répond.
