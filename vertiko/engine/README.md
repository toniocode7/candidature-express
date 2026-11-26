# Moteur Vertiko

Du scénario au short vertical prêt à publier, **sans aucun service payant** : voix (Piper), animation (Remotion), montage (ffmpeg).

```bash
./setup.sh                                   # une seule fois
node make.mjs stories/poulpe-trois-coeurs.json   # un ou plusieurs scénarios
npm test
```

Pour chaque scénario, `out/<id>/` contient :

| Fichier | Rôle |
|---|---|
| `short.mp4` | le short 1080×1920, voix + sous-titres animés |
| `verification.jpg` | une image par scène, du début à la fin, pour la vérification |
| `publication.json` | titre, description et légendes pour TikTok, Instagram, YouTube Shorts |
| `rapport.json` | durée, temps de fabrication, contrôles automatiques |

## Écrire un scénario

Un fichier JSON dans `stories/` : `id`, `title`, `style` (`3d`, `toon` = dessin animé, `schema` = schéma animé),
`palette` facultative (`sunset`, `chalk`, `ocean`), `scenes` (texte dit `say` + visuel `visual`), `publish`.
Les types de visuels sont décrits en tête de `src/scenes.jsx`. Les nombres s'écrivent en chiffres : la voix les lit
en toutes lettres, l'écran les affiche en chiffres.

## Organisation

- `make.mjs` : la chaîne complète (voix → minutage → animation → montage → vérification → kit de publication)
- `lib/` : minutage, lecture des nombres, validation des scénarios, `brain.mjs` (IA, pour l'app)
- `src/` : les animations Remotion (`scenes.jsx` 2D, `three/Stage3D.jsx` 3D, `Captions.jsx` sous-titres)
