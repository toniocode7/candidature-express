import { speakable } from "./speak.mjs";

// Minutage d'un short : début/fin de chaque scène et des mots des sous-titres.
// Les durées de voix viennent de la synthèse ; chaque mot reçoit une part du temps
// proportionnelle à sa longueur (approximation de la vitesse de parole).

export const GAP = 0.25;      // blanc entre deux scènes (s)
export const LEAD = 0.08;     // petit temps avant le premier mot d'une scène
export const TAIL = 0.5;      // temps laissé après la dernière scène

// Poids d'un mot = longueur de ce que la voix prononce vraiment (« 36 000 € » → « trente-six mille euros »).
const weight = (w) => Math.max(2, speakable(w.replace(/\u00A0/g, " ")).replace(/[^\p{L}\p{N}]/gu, "").length) + (/[,.;:!?…]$/.test(w) ? 3 : 0);
// Garde ensemble les nombres et leur unité dans les sous-titres : « 36 000 € » reste un seul bloc.
const glue = (t) => t.replace(/(\d) (?=\d{3}\b)/g, "$1\u00A0").replace(/(\d) (%|€|°C|j|km|kg|M)(?=[\s,.;:!?]|$)/g, "$1\u00A0$2");

export function buildTiming(story, voiceDurations) {
  const scenes = [];
  const words = [];
  let t = 0;
  story.scenes.forEach((sc, i) => {
    const d = voiceDurations[i];
    const end = t + d + (i === story.scenes.length - 1 ? TAIL : GAP);
    scenes.push({ start: +t.toFixed(3), end: +end.toFixed(3), voice: d });
    const text = glue((sc.caption || sc.say).replace(/\s+/g, " ").trim());
    const ws = text.split(" ").filter(Boolean);
    const total = ws.reduce((s, w) => s + weight(w), 0);
    let cur = t + LEAD;
    const speak = Math.max(0.2, d - LEAD - 0.12);
    ws.forEach((w) => {
      const dw = (weight(w) / total) * speak;
      words.push({ text: w.replace(/[«»"]/g, ""), start: +cur.toFixed(3), end: +(cur + dw).toFixed(3), scene: i });
      cur += dw;
    });
    t = end;
  });
  return { total: +t.toFixed(3), scenes, words, groups: groupWords(words) };
}

// Groupes de 1 à 3 mots, coupés sur la ponctuation et les changements de scène.
export function groupWords(words) {
  const groups = [];
  let g = [];
  const flush = () => { if (g.length) { groups.push({ start: g[0].start, end: g[g.length - 1].end, words: g }); g = []; } };
  words.forEach((w, i) => {
    if (g.length && g[0].scene !== w.scene) flush();
    g.push(w);
    const chars = g.reduce((s, x) => s + x.text.length, 0);
    if (g.length >= 3 || chars > 14 || /[,.;:!?…]$/.test(w.text)) flush();
  });
  flush();
  // Les sous-titres restent affichés jusqu'au groupe suivant (dans la même scène).
  for (let i = 0; i < groups.length - 1; i++) {
    if (groups[i + 1].words[0].scene === groups[i].words[0].scene) groups[i].end = groups[i + 1].start;
  }
  return groups;
}
