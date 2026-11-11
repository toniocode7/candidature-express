// Notifications sur l'iPhone et le Mac (Web Push), réglables une par une dans les Paramètres.
import { authorize, CORS, json, SERVICE_KEY, SUPABASE_URL } from "../_shared/common.ts";
import { newVapid, sendPush, type Vapid } from "../_shared/webpush.ts";

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
const SUBJECT = "https://toniocode7.github.io/candidature-express/";
const KINDS = ["offres", "recruteur", "statut", "entretien", "objectif", "test"];

async function rest(path: string, init: RequestInit = {}) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
}

async function vapid(): Promise<Vapid> {
  const r = await rest("ce_secrets?select=value&name=eq.vapid");
  const rows = r.ok ? await r.json() : [];
  if (rows.length) return rows[0].value;
  const v = await newVapid();
  await rest("ce_secrets", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ name: "vapid", value: v }) });
  const again = await (await rest("ce_secrets?select=value&name=eq.vapid")).json();
  return again[0]?.value ?? v;
}

async function prefs(): Promise<Record<string, boolean>> {
  const r = await rest("docs?select=data&col=eq.ce&id=eq.notifs");
  const rows = r.ok ? await r.json() : [];
  return { offres: true, recruteur: true, statut: true, entretien: true, objectif: true, ...(rows[0]?.data ?? {}), test: true };
}

async function broadcast(kind: string, title: string, body: string, url: string, tag?: string) {
  const p = await prefs();
  if (!p[kind]) return { envoye: 0, raison: "désactivée dans les réglages" };
  const v = await vapid();
  const subs = await (await rest("push_subs?select=endpoint,keys")).json();
  let ok = 0;
  const dead: string[] = [];
  for (const s of subs) {
    try {
      const st = await sendPush({ endpoint: s.endpoint, keys: s.keys }, { title, body, url: url || "./", tag: tag || kind }, v, SUBJECT);
      if (st === 404 || st === 410) dead.push(s.endpoint); else if (st < 300) ok++;
      console.log(`[push] ${kind} -> ${new URL(s.endpoint).host} : ${st}`);
    } catch (e) { console.log("[push] échec", String(e).slice(0, 200)); }
  }
  for (const e of dead) await rest(`push_subs?endpoint=eq.${encodeURIComponent(e)}`, { method: "DELETE" });
  return { envoye: ok, appareils: subs.length, expires: dead.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any = {};
  try { b = await req.json(); } catch (_) { /* vide */ }
  if (b.action === "vapid") return json({ publicKey: (await vapid()).publicKey });
  if (!(await authorize(req))) return json({ error: "non autorisé" }, 401);
  if (b.action === "send" || b.action === "test") {
    const kind = b.action === "test" ? "test" : String(b.kind || "");
    if (!KINDS.includes(kind)) return json({ error: "type inconnu" }, 400);
    if (b.once) {
      // Clé d'unicité : un rappel n'est jamais envoyé deux fois.
      const r = await rest("notif_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ key: String(b.once) }) });
      const ins = r.ok ? await r.json() : [];
      if (!ins.length) return json({ envoye: 0, raison: "déjà envoyée" });
    }
    const title = b.action === "test" ? "Candidature Express" : String(b.title || "Candidature Express").slice(0, 120);
    const body = b.action === "test" ? "Les notifications fonctionnent sur cet appareil." : String(b.body || "").slice(0, 400);
    return json(await broadcast(kind, title, body, String(b.url || "./"), b.tag));
  }
  return json({ error: "action inconnue" }, 400);
});
