# Candidature Express : guide d'utilisation

## Installer
- **iPhone** : ouvre https://toniocode7.github.io/candidature-express/ dans Safari, puis Partager, « Sur l'écran d'accueil ».
- **Mac** : même adresse dans Safari, puis Fichier, « Ajouter au Dock ».
- Connecte-toi avec ton e-mail et ton mot de passe. Tes données arrivent toutes seules.
- Sur chaque appareil : engrenage, « Notifications et calendrier », « Activer sur cet appareil ».

## Au quotidien
| Je veux… | Où |
|---|---|
| Analyser une annonce | **Analyser** : colle le lien, le texte ou des captures d'écran |
| CV et lettre | dans l'analyse : **CV + lettre en un toucher**, puis « Télécharger les 2 PDF » |
| Une lettre plus soignée | dans la fenêtre du document : **Envoyer à Claude** (la demande est copiée, colle-la dans Claude) |
| Voir les offres trouvées pour moi | **Suggérées** (recherche automatique toutes les heures de 6 h à 22 h) |
| Suivre mes candidatures | **Candidatures** : statuts, recherche, carte, mails à valider |
| Dire ce qui s'est passé | **Donner une instruction** (ex. « un recruteur de X m'a appelé, mets-le en premier contact ») |
| Ajouter un entretien au calendrier | bouton **+ Calendrier** sur l'entretien, ou abonnement dans les Paramètres |

## Ce qui tourne tout seul
- **Toutes les 15 min** : le script Google lit les mails de recruteurs ; l'app met à jour les statuts quand elle est sûre (sinon elle te demande de valider).
- **Toutes les heures (6 h à 22 h)** : recherche d'offres (France Travail, Indeed, LinkedIn, HelloWork, Meteojob), tri avec tes critères, notifications.
- **Chaque jour** : vérification que les annonces de tes candidatures sont encore en ligne ; passage en « Refusée » sans réponse après le délai choisi.
- **Rappels** : la veille (18 h) et le jour (7 h) d'un entretien ; objectif de la semaine le vendredi et le dimanche à 17 h.

## Si quelque chose ne marche plus
| Symptôme | Que faire |
|---|---|
| Un point **orange** à côté d'une source dans Suggérées | Rien : elle est réessayée toute seule à l'heure suivante, les autres sources continuent. Si elle reste orange plusieurs jours, le site a changé : lance l'action GitHub « Diagnostic d'une source d'offres » et transmets le résultat à Claude. |
| « Plafond gratuit du jour atteint » | Gemini et Groq sont au maximum : réessaie le lendemain, ou utilise « Envoyer à Claude ». |
| Plus de mails mis à jour | script.google.com, projet « Candidature Express Gmail », Exécuter « installer » une fois. Si « Réponse 401 » : la phrase secrète du script et le secret GitHub `CE_MAIL_KEY` ne sont plus identiques. |
| Plus de notifications | Paramètres de l'app, « Activer sur cet appareil » ; vérifier Réglages de l'iPhone, Notifications, Candidatures. |
| Plus aucune recherche automatique | GitHub, onglet Actions : si un bandeau indique que les tâches planifiées sont en pause, cliquer « Enable workflow ». |
| L'app ne s'ouvre plus ou « Supabase » en pause | Se connecter sur supabase.com et cliquer « Restore project » (gratuit). |
| Une clé a expiré ou a été changée | La remplacer dans GitHub, Settings, Secrets and variables, Actions, puis relancer l'action « Mettre à jour Supabase ». |

## Gratuité
Aucune carte bancaire n'est enregistrée nulle part. À chaque plafond gratuit, le service refuse simplement et l'app passe au suivant : rien ne peut être facturé. Le compteur du jour est dans Paramètres, « Suivi des candidatures ».
