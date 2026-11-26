// Cerveau de Vertiko pour l'app (étape 2) : appelle Claude avec la clé API du client.
// - proposeTopics : idées de sujets dans une niche (avec recherche web)
// - writeStory    : un sujet → un scénario JSON prêt pour make.mjs
// - reviseStory   : « refais l'accroche, plus punchy » → ne modifie que ce point
// - checkFrames   : vérifie les images extraites du short par rapport à la demande
//
// Pendant l'étape 1 (la preuve gratuite), ce rôle est tenu par Claude dans la session :
// ce module n'a donc pas encore été exécuté contre l'API (il faut une clé). À tester en étape 2.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { validateStory, KINDS, STYLES } from "./story.mjs";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"]; // si un filtre de sécurité refuse, l'API relance sur un autre modèle

// Schéma « à plat » : tous les champs existent, ceux qui ne servent pas valent null.
const Item = z.object({ emoji: z.string().nullable(), label: z.string(), value: z.number().nullable() });
const Side = z.object({ emoji: z.string(), label: z.string() });
const Visual = z.object({
  kind: z.enum(KINDS),
  emoji: z.string().nullable(),
  text: z.string().nullable(),
  label: z.string().nullable(),
  kicker: z.string().nullable(),
  title: z.string().nullable(),
  unit: z.string().nullable(),
  suffix: z.string().nullable(),
  to: z.number().nullable(),
  items: z.array(Item).nullable(),
  left: Side.nullable(),
  right: Side.nullable(),
  verdict: z.string().nullable(),
});
const StorySchema = z.object({
  id: z.string(),
  title: z.string(),
  style: z.enum(STYLES),
  scenes: z.array(z.object({ say: z.string(), visual: Visual })),
  publish: z.object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) }),
  sources: z.array(z.string()),
});

const WRITER = `Tu écris des scénarios de shorts verticaux (TikTok, Reels, YouTube Shorts) en français, tutoiement.
Règles :
- 20 à 45 secondes, 5 à 8 scènes, 110 à 160 mots en tout.
- Scène 1 = accroche qui crée une question dans la tête du spectateur en moins de 2 secondes.
- Une seule idée par scène, phrases courtes et orales. Les nombres en chiffres (« 36 000 € »).
- Dernière scène = question ouverte (visual.kind "question") pour faire réagir en commentaire.
- N'affirme que des faits vérifiables ; mets les sources dans "sources". Si un chiffre est une hypothèse, dis-le.
- Choisis pour chaque scène le visuel qui montre l'idée : title (emoji + texte), emoji (1 à 3 emojis + label),
  counter (to + suffix + label), bars (2 à 4 items avec value), compare (left/right + verdict), steps (2 à 4 items),
  fact (kicker + text), question (text). Les champs inutiles valent null.
- id : minuscules et tirets. Hashtags sans #.`;

function client(apiKey) {
  return new Anthropic(apiKey ? { apiKey } : {});
}

function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, clean(x)]));
  return v;
}

async function parse(c, { system, content, schema, tools }) {
  const res = await c.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(schema) },
    system,
    ...(tools ? { tools } : {}),
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error(`Demande refusée par l'IA (${res.stop_details?.category ?? "raison non précisée"}). Reformule le sujet.`);
  if (!res.parsed_output) throw new Error(`Réponse illisible (arrêt : ${res.stop_reason}).`);
  return res.parsed_output;
}

export async function proposeTopics({ niche, followedAccounts = [], bestShorts = [], count = 6, apiKey }) {
  const schema = z.object({ topics: z.array(z.object({ title: z.string(), angle: z.string(), why: z.string(), sources: z.array(z.string()) })) });
  const out = await parse(client(apiKey), {
    system: "Tu proposes des sujets de shorts qui ont de bonnes chances de marcher. Réponds en français.",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    schema,
    content: `Niche : ${niche}
Comptes suivis : ${followedAccounts.join(", ") || "aucun"}
Mes shorts qui ont le mieux marché : ${bestShorts.join(" | ") || "aucun encore"}
Propose ${count} sujets : des sujets dont on parle en ce moment dans cette niche, et des variantes de ce qui a déjà marché.
Pour chacun : titre accrocheur, angle précis, pourquoi il devrait marcher, sources.`,
  });
  return out.topics;
}

export async function writeStory({ topic, style = "toon", niche = "", voiceSample = "", exampleStory = null, business = null, apiKey }) {
  const parts = [`Sujet : ${topic}`, `Style visuel : ${style}`];
  if (niche) parts.push(`Thème de la chaîne : ${niche}`);
  if (voiceSample) parts.push(`Façon de parler du créateur (imite le ton, les expressions, pas le contenu) :\n${voiceSample}`);
  if (exampleStory) parts.push(`Short d'exemple dont il faut reprendre la recette (accroche, rythme, chute) mais PAS l'histoire, le texte ni les images :\n${JSON.stringify(exampleStory)}`);
  if (business) parts.push(`Entreprise : ${business.name}, ${business.activity}. Offre : ${business.offer}.
Le short donne d'abord un vrai conseil de ce métier, et l'entreprise n'apparaît qu'à l'avant-dernière scène avec son offre.`);
  const raw = await parse(client(apiKey), { system: WRITER, schema: StorySchema, content: parts.join("\n\n") });
  const story = clean(raw);
  validateStory(story);
  return story;
}

export async function reviseStory({ story, instruction, apiKey }) {
  const raw = await parse(client(apiKey), {
    system: WRITER + "\nTu corriges un scénario existant : modifie UNIQUEMENT ce que la demande vise, recopie tout le reste à l'identique.",
    schema: StorySchema,
    content: `Scénario actuel :\n${JSON.stringify(story)}\n\nDemande de correction : ${instruction}`,
  });
  const out = clean(raw);
  validateStory(out);
  return out;
}

export async function checkFrames({ story, framePaths, request = "", apiKey }) {
  const schema = z.object({
    ok: z.boolean(),
    seen: z.array(z.string()),
    problems: z.array(z.object({ frame: z.number(), problem: z.string(), fix: z.string() })),
  });
  const images = framePaths.map((p) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(p).toString("base64") } }));
  return parse(client(apiKey), {
    system: "Tu contrôles la qualité d'un short avant publication. Sois exigeant mais factuel. Réponds en français.",
    schema,
    content: [
      ...images,
      { type: "text", text: `Voici ${framePaths.length} images prises du début à la fin du short (une par scène, dans l'ordre).
Demande initiale : ${request || story.title}
Scénario : ${JSON.stringify(story.scenes.map((s) => s.say))}
Vérifie : le texte est-il lisible sur chaque image (rien de coupé, rien de caché) ? Chaque image montre-t-elle l'idée de sa scène ?
Le short répond-il à la demande ? "seen" = ce que tu vois sur chaque image, en une phrase.` },
    ],
  });
}
