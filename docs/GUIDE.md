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
| Voir les offres trouvées pour moi | **Suggérées** (recherche automatique à 0 h, 6 h, 12 h et 18 h ; « Nouvelle recherche » en lance une tout de suite, voir plus bas) |
| Suivre mes candidatures | **Candidatures** : statuts, recherche, carte, mails à valider |
| Dire ce qui s'est passé | **Donner une instruction** (ex. « un recruteur de X m'a appelé, mets-le en premier contact ») |
| Ajouter un entretien au calendrier | bouton **+ Calendrier** sur l'entretien, ou abonnement dans les Paramètres |

## Ce qui tourne tout seul
- **Toutes les 15 min** : le script Google transmet les mails de recruteurs. L'IA lit chaque mail en entier et cite la phrase qui prouve un refus ou un entretien ; le statut change seul seulement si elle est sûre, sinon tu valides.
- **À 0 h, 6 h, 12 h et 18 h** (sauf si tu as lancé une recherche toi-même moins d'une heure avant) : recherche d'offres (France Travail, Indeed, LinkedIn, HelloWork, Meteojob, sites carrières de tes entreprises surveillées). Chaque annonce est lue en entier : expérience exigée, salaire, doublons publiés sur plusieurs sites. Puis tri selon tes critères et ton profil, et notification.
- **Entretien fixé** : la fiche de préparation est faite en arrière-plan ; rappel la veille (18 h) et le jour (7 h), vérifiés chaque heure.
- **Chaque jour** : vérification que les annonces de tes candidatures sont encore en ligne (une annonce retirée est signalée, jamais passée en Refusée toute seule) ; surveillance des automatisations, avec une notification si l'une s'arrête (site muet depuis 24 h, script Gmail, IA, sauvegarde).
- **Le dimanche** : sauvegarde complète dans ton Google Drive (4 h), bilan de la semaine (18 h). Objectif de la semaine le vendredi et le dimanche à 17 h.

## Recherche à la demande (clé GitHub, une seule fois)
« Nouvelle recherche » trie toujours les offres déjà récoltées. Avec cette clé, il lance en plus une récolte complète sur tous les sites, sans attendre le prochain passage (résultats en 5 à 15 minutes, avec une notification).
1. Sur github.com (site pour ordinateur), ta photo, **Settings**, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, **Generate new token**.
2. Nom : `Candidature Express`. Expiration : la plus longue proposée. **Repository access** : *Only select repositories*, choisir `candidature-express`.
3. **Permissions**, *Repository permissions*, **Actions** : *Read and write*. Rien d'autre.
4. **Generate token**, copier la clé (elle commence par `github_pat_`).
5. Dans le dépôt : **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Nom `GH_DISPATCH_TOKEN`, coller la clé, **Add secret**.
6. Onglet **Actions**, « Mettre à jour Supabase (base et fonctions) », **Run workflow**.
Quand la clé expire, l'app le dit au moment de la recherche : refais les étapes 1 à 6.

## Si quelque chose ne marche plus
| Symptôme | Que faire |
|---|---|
| Un point **orange** à côté d'une source dans Suggérées | Rien : elle est réessayée toute seule au prochain passage, les autres sources continuent. Si elle reste orange plus de 24 h, tu reçois une alerte : le site a sans doute changé, transmets-la à Claude. |
| « Plafond gratuit du jour atteint » | Gemini et Groq sont au maximum : réessaie le lendemain, ou utilise « Envoyer à Claude ». |
| Plus de mails mis à jour | script.google.com, projet « Candidature Express Gmail », Exécuter « installer » une fois. Si « Réponse 401 » : la phrase secrète du script et le secret GitHub `CE_MAIL_KEY` ne sont plus identiques. |
| Plus de notifications | Paramètres de l'app, « Activer sur cet appareil » ; vérifier Réglages de l'iPhone, Notifications, Candidatures. |
| Plus aucune recherche automatique | GitHub, onglet Actions : si un bandeau indique que les tâches planifiées sont en pause, cliquer « Enable workflow ». |
| L'app ne s'ouvre plus ou « Supabase » en pause | Se connecter sur supabase.com et cliquer « Restore project » (gratuit). |
| « Voir l'annonce » ouvre une autre offre | GitHub, Actions, « Vérifier les liens des offres suggérées », cocher « Retirer… et les retrier », Run workflow. |
| Une clé a expiré ou a été changée | La remplacer dans GitHub, Settings, Secrets and variables, Actions, puis relancer l'action « Mettre à jour Supabase ». |

## Gratuité
Aucune carte bancaire n'est enregistrée nulle part. À chaque plafond gratuit, le service refuse simplement et l'app passe au suivant : rien ne peut être facturé. Le compteur du jour est dans Paramètres, « Suivi des candidatures ».
