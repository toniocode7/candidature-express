#!/usr/bin/env bash
# Installe tout ce qu'il faut au moteur Vertiko (gratuit) : dépendances Node, Piper, voix française.
set -euo pipefail
cd "$(dirname "$0")"
npm install
python3 -m pip install --quiet piper-tts
mkdir -p voices
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium
[ -f voices/fr_FR-siwis-medium.onnx ] || curl -fL -o voices/fr_FR-siwis-medium.onnx "$B/fr_FR-siwis-medium.onnx"
[ -f voices/fr_FR-siwis-medium.onnx.json ] || curl -fL -o voices/fr_FR-siwis-medium.onnx.json "$B/fr_FR-siwis-medium.onnx.json"
command -v ffmpeg >/dev/null || echo "⚠ Installe ffmpeg (brew install ffmpeg / apt install ffmpeg)"
echo "✔ Prêt. Essaie : node make.mjs stories/poulpe-trois-coeurs.json"
