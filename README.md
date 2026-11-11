# Candidature Express

Application personnelle de suivi de candidatures (app web installable sur iPhone et Mac).

- `web/` : l'application publiée sur GitHub Pages. Aucune donnée personnelle ni clé secrète.
- `supabase/` : structure de la base privée et fonctions serveur.
- `.github/workflows/` : publication et automatisations.

Les données vivent uniquement dans la base Supabase privée (accès réservé à un seul compte).
Les secrets sont stockés dans GitHub Secrets et Supabase, jamais dans ce dépôt.
