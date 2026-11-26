#!/usr/bin/env node
// Vertiko — fabrique un ou plusieurs shorts à partir de scénarios JSON.
// Usage : node make.mjs stories/poulpe.json [stories/autre.json ...]
// Sortie : out/<id>/short.mp4, out/<id>/verification.jpg (une image par scène, du début à la fin),
//          out/<id>/frames/*.jpg, out/<id>/publication.json, out/<id>/rapport.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { validateStory } from "./lib/story.mjs";
import { buildTiming } from "./lib/timing.mjs";
import { speakable } from "./lib/speak.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VOICES = path.join(ROOT, "voices");
const BROWSER = process.env.VERTIKO_BROWSER || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

function pickVoice() {
  if (process.env.VERTIKO_VOICE) return process.env.VERTIKO_VOICE;
  for (const v of ["fr_FR-siwis-medium.onnx", "fr_FR-tom-medium.onnx", "fr-siwis-medium.onnx"]) {
    if (fs.existsSync(path.join(VOICES, v))) return path.join(VOICES, v);
  }
  throw new Error("Aucune voix trouvée dans voices/");
}

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "pipe"], ...opts }).toString();
const duration = (f) => parseFloat(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));

function tts(text, out, voice, speed) {
  execFileSync("python3", ["-m", "piper", "-m", voice, "-f", out, "--length-scale", String(speed), "--sentence-silence", "0.15"], { input: speakable(text), stdio: ["pipe", "ignore", "ignore"] });
  return duration(out);
}

async function makeOne(serveUrl, file) {
  const story = JSON.parse(fs.readFileSync(file, "utf8"));
  validateStory(story);
  const dir = path.join(ROOT, "out", story.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const voice = pickVoice();
  const t0 = Date.now();

  // 1. Voix, scène par scène
  console.log(`▶ ${story.id} : voix (${path.basename(voice)})`);
  const durs = story.scenes.map((sc, i) => tts(sc.say, path.join(dir, "audio", `s${i}.wav`), voice, story.voiceSpeed || 0.92));

  // 2. Minutage : scènes + sous-titres mot par mot
  const timing = buildTiming(story, durs);

  // 3. Piste audio unique (scènes bout à bout, avec le petit blanc prévu entre elles)
  const parts = [], filters = [];
  story.scenes.forEach((_, i) => {
    parts.push("-i", path.join(dir, "audio", `s${i}.wav`));
    const pad = timing.scenes[i].end - timing.scenes[i].start - durs[i];
    filters.push(`[${i}:a]aresample=44100,apad=pad_dur=${Math.max(0, pad).toFixed(3)}[a${i}]`);
  });
  const concat = story.scenes.map((_, i) => `[a${i}]`).join("") + `concat=n=${story.scenes.length}:v=0:a=1,loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  sh("ffmpeg", ["-y", ...parts, "-filter_complex", filters.join(";") + ";" + concat, "-map", "[out]", path.join(dir, "voix.wav")]);

  // 4. Animation
  console.log(`▶ ${story.id} : animation ${story.style} (${timing.total.toFixed(1)} s)`);
  const inputProps = { story, timing };
  const composition = await selectComposition({ serveUrl, id: "Short", inputProps, browserExecutable: BROWSER, chromiumOptions: { gl: "swangle" } });
  const silent = path.join(dir, "image.mp4");
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: "h264", outputLocation: silent, inputProps, muted: true,
    browserExecutable: BROWSER, chromiumOptions: { gl: "swangle" }, concurrency: story.style === "3d" ? 2 : 4,
    crf: 20, timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; process.stdout.write(` ${p * 10}%`); } },
  });
  process.stdout.write("\n");

  // 5. Montage final : image + voix
  const final = path.join(dir, "short.mp4");
  sh("ffmpeg", ["-y", "-i", silent, "-i", path.join(dir, "voix.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);
  fs.rmSync(silent);

  // 6. Vérification : 6 images réparties du début à la fin + planche contact
  const total = duration(final);
  // une image au milieu de chaque scène (là où l'animation est posée)
  const stamps = timing.scenes.map((sc) => Math.min(total - 0.1, sc.start + (sc.end - sc.start) * 0.6));
  stamps.forEach((s, i) => sh("ffmpeg", ["-y", "-ss", s.toFixed(2), "-i", final, "-frames:v", "1", "-q:v", "3", "-vf", "scale=540:-1", path.join(dir, "frames", `${i + 1}.jpg`)]));
  sh("ffmpeg", ["-y", "-i", path.join(dir, "frames", "%d.jpg"), "-vf", `tile=${stamps.length}x1:padding=8:color=white`, "-frames:v", "1", path.join(dir, "verification.jpg")]);

  const checks = {
    duree_ok: total >= 12 && total <= 75,
    format: "1080x1920",
    son_ok: duration(path.join(dir, "voix.wav")) > 3,
    scenes: story.scenes.length,
  };

  // 7. Kit de publication
  const pub = story.publish || {};
  const hashtags = (pub.hashtags || []).map((h) => (h.startsWith("#") ? h : "#" + h));
  const publication = {
    fichier: "short.mp4",
    titre: pub.title || story.title,
    description: `${pub.description || ""}\n\n${hashtags.join(" ")}`.trim(),
    plateformes: {
      tiktok: { legende: `${pub.title || story.title} ${hashtags.slice(0, 5).join(" ")}`.trim(), ia: "Contenu généré par IA : cocher l'étiquette IA si la plateforme le demande" },
      instagram: { legende: `${pub.description || story.title}\n\n${hashtags.join(" ")}` },
      youtube_shorts: { titre: `${pub.title || story.title} #shorts`.slice(0, 100), description: pub.description || "" },
    },
  };
  fs.writeFileSync(path.join(dir, "publication.json"), JSON.stringify(publication, null, 2));
  fs.writeFileSync(path.join(dir, "rapport.json"), JSON.stringify({ id: story.id, style: story.style, duree: +total.toFixed(2), fabrication_s: Math.round((Date.now() - t0) / 1000), voix: path.basename(voice), verifications: checks }, null, 2));
  console.log(`✔ ${story.id} : ${total.toFixed(1)} s, fabriqué en ${Math.round((Date.now() - t0) / 1000)} s → out/${story.id}/short.mp4`);
}

const files = process.argv.slice(2);
if (!files.length) { console.error("Usage : node make.mjs stories/<scenario>.json ..."); process.exit(1); }
console.log("▶ Préparation du moteur d'animation…");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.jsx") });
for (const f of files) {
  try { await makeOne(serveUrl, f); } catch (e) { console.error(`✖ ${f} : ${e.message}`); process.exitCode = 1; }
}
