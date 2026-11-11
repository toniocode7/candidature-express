// IA de Candidature Express : Gemini (offre gratuite) en priorité, Groq (gratuit) en secours.
// Les clés restent ici, côté serveur. Sans moyen de paiement enregistré, rien ne peut être facturé :
// au plafond, le service refuse la demande et on passe au modèle suivant.
import { authorize, bumpUsage, CORS, exhaustedToday, json } from "../_shared/common.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GEM = "https://generativelanguage.googleapis.com/v1beta";

type Msg = { role: "user" | "assistant"; content: string };
type Img = { mime: string; data: string };
type Req = { mode?: "text" | "json"; prompt?: string; messages?: Msg[]; images?: Img[]; tier?: "quality" | "light"; url?: string; search?: boolean; system?: string };
type Cand = { provider: "gemini" | "groq"; model: string };

class Exhausted extends Error {}

// ---------- Choix des modèles (lus en direct : les noms changent souvent) ----------
let cache: { at: number; flash: string[]; lite: string[]; groq: string[]; groqVision: string[] } | null = null;

function ver(name: string): number {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(name);
  return m ? +m[1] * 100 + +(m[2] ?? 0) : 0;
}

async function models() {
  if (cache && Date.now() - cache.at < 6 * 3600e3) return cache;
  const flash: string[] = [], lite: string[] = [];
  if (GEMINI_KEY) {
    try {
      const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { "x-goog-api-key": GEMINI_KEY } });
      const j = await r.json();
      const names: string[] = (j.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m: any) => String(m.name).replace(/^models\//, ""))
        .filter((n: string) => /^gemini-\d/.test(n) && !/(tts|image|live|audio|embedding|robotics|computer|exp|thinking|native|nano)/i.test(n));
      const rank = (a: string, b: string) => (ver(b) - ver(a)) || (+a.includes("preview") - +b.includes("preview")) || a.length - b.length;
      flash.push(...names.filter((n) => /-flash(-preview[\w-]*|-latest)?$/.test(n) && !/lite/.test(n)).sort(rank));
      lite.push(...names.filter((n) => /-flash-lite(-preview[\w-]*|-latest)?$/.test(n)).sort(rank));
    } catch (_) { /* repli plus bas */ }
    if (!flash.length) flash.push("gemini-flash-latest");
    if (!lite.length) lite.push("gemini-flash-lite-latest");
  }
  const groq: string[] = [], groqVision: string[] = [];
  if (GROQ_KEY) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${GROQ_KEY}` } });
      const ids: string[] = ((await r.json()).data ?? []).map((m: any) => m.id);
      const pref = ["openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct-0905", "moonshotai/kimi-k2-instruct", "llama-3.3-70b-versatile", "qwen/qwen3-32b", "openai/gpt-oss-20b"];
      groq.push(...pref.filter((p) => ids.includes(p)));
      if (!groq.length) groq.push(...ids.filter((i) => !/(whisper|guard|tts|compound|prompt)/i.test(i)).slice(0, 2));
      groqVision.push(...ids.filter((i) => /llama-4|vision/i.test(i)));
    } catch (_) { /* ignore */ }
  }
  cache = { at: Date.now(), flash: flash.slice(0, 3), lite: lite.slice(0, 2), groq: groq.slice(0, 2), groqVision: groqVision.slice(0, 1) };
  return cache;
}

// ---------- Appels ----------
async function callGemini(model: string, r: Req): Promise<string> {
  const msgs: Msg[] = r.messages?.length ? r.messages : [{ role: "user", content: r.prompt ?? "" }];
  const contents = msgs.map((m, i) => {
    const parts: any[] = [{ text: m.content }];
    if (i === msgs.length - 1 && r.images?.length) for (const im of r.images) parts.push({ inline_data: { mime_type: im.mime, data: im.data } });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
  const body: any = { contents, generationConfig: { temperature: r.mode === "json" ? 0.4 : 0.6 } };
  if (r.system) body.systemInstruction = { parts: [{ text: r.system }] };
  if (r.mode === "json" && !r.url && !r.search) body.generationConfig.responseMimeType = "application/json";
  if (r.url) body.tools = [{ url_context: {} }];
  if (r.search) body.tools = [...(body.tools ?? []), { google_search: {} }];
  // Réflexion courte : réponses plus rapides, même qualité pour nos usages.
  body.generationConfig.thinkingConfig = { thinkingLevel: "low" };
  const send = () => fetch(`${GEM}/models/${model}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(r.images?.length ? 70000 : 55000),
  });
  let res = await send();
  if (res.status === 400) {
    const t = await res.text();
    if (!/thinking/i.test(t)) throw new Error(`gemini 400: ${t.slice(0, 300)}`);
    delete body.generationConfig.thinkingConfig;
    res = await send();
  }
  if (res.status === 429) throw new Exhausted((await res.text()).slice(0, 600));
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
  if (!text.trim()) throw new Error(`gemini vide (${j.candidates?.[0]?.finishReason ?? j.promptFeedback?.blockReason ?? "?"})`);
  return text;
}

async function callGroq(model: string, r: Req): Promise<string> {
  const msgs: any[] = (r.messages?.length ? r.messages : [{ role: "user", content: r.prompt ?? "" }]).map((m) => ({ role: m.role, content: m.content }));
  if (r.system) msgs.unshift({ role: "system", content: r.system });
  if (r.images?.length) {
    const last = msgs[msgs.length - 1];
    last.content = [{ type: "text", text: last.content }, ...r.images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.data}` } }))];
  }
  const body: any = { model, messages: msgs, temperature: r.mode === "json" ? 0.4 : 0.6 };
  if (r.mode === "json") body.response_format = { type: "json_object" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  if (res.status === 429) throw new Exhausted((await res.text()).slice(0, 600));
  if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = (await res.json()).choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("groq vide");
  return text;
}

function parseJson(t: string): unknown {
  const s = t.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(s); } catch (_) { /* suite */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error("réponse JSON illisible");
}

// Une limite par minute n'épuise pas la journée : on ne marque « épuisé » que la limite quotidienne.
function isDaily(msg: string): boolean {
  return /per ?day|PerDay|daily|RPD|requests_per_day|tokens per day|TPD/i.test(msg);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await authorize(req))) return json({ error: "non autorisé" }, 401);
  let r: Req;
  try { r = await req.json(); } catch (_) { return json({ error: "requête illisible" }, 400); }
  if ((r as any).ping) {
    const m = await models();
    return json({ ok: true, gemini: !!GEMINI_KEY, groq: !!GROQ_KEY, models: { flash: m.flash, lite: m.lite, groq: m.groq, groqVision: m.groqVision } });
  }

  const m = await models();
  const ex = await exhaustedToday();
  const g = (l: string[]): Cand[] => l.map((model) => ({ provider: "gemini" as const, model }));
  const q = (l: string[]): Cand[] => l.map((model) => ({ provider: "groq" as const, model }));
  const groqList = r.images?.length ? m.groqVision : m.groq;
  let order: Cand[] = r.tier === "light"
    ? [...g(m.lite), ...q(groqList), ...g(m.flash)]
    : [...g(m.flash), ...g(m.lite), ...q(groqList)];
  if (r.url || r.search) order = order.filter((c) => c.provider === "gemini");
  order = order.filter((c) => (c.provider === "gemini" ? GEMINI_KEY : GROQ_KEY) && !ex.has(`${c.provider}:${c.model}`));
  if (!order.length) return json({ error: "quota", detail: "Toutes les IA gratuites ont atteint leur plafond du jour." }, 429);

  const errors: string[] = [];
  const t0 = Date.now();
  for (const c of order) {
    if (Date.now() - t0 > 85000) { errors.push("temps dépassé"); break; }
    try {
      const text = c.provider === "gemini" ? await callGemini(c.model, r) : await callGroq(c.model, r);
      const out: any = { provider: c.provider, model: c.model };
      if (r.mode === "json") out.json = parseJson(text); else out.text = text;
      await bumpUsage(c.provider, c.model, true);
      return json(out);
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      const daily = e instanceof Exhausted && isDaily(msg);
      await bumpUsage(c.provider, c.model, false, daily);
      const why = e instanceof Exhausted ? (daily ? "plafond du jour" : "trop de demandes à la minute") : /TimeoutError|aborted/i.test(msg) ? "trop lent" : msg.slice(0, 160);
      console.log(`[ai] ${c.provider}/${c.model} : ${why} :: ${msg.slice(0, 400)}`);
      errors.push(`${c.provider}/${c.model}: ${why}`);
      if ((r as any).debug) errors.push(`  ↳ ${msg.slice(0, 300)}`);
    }
  }
  const allQuota = errors.every((e) => /plafond|minute/.test(e));
  return json({ error: allQuota ? "quota" : "echec", detail: errors.join(" | ") }, allQuota ? 429 : 502);
});
