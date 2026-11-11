// Outils communs aux fonctions serveur de Candidature Express.

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("CE_PUBLISHABLE_KEY") ?? "";
export const SERVICE_KEY = Deno.env.get("CE_SERVICE_KEY") ?? "";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-ce-key, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}

/** Autorise soit l'utilisateur connecté à l'app, soit les automatisations (clé de service). */
export async function authorize(req: Request): Promise<boolean> {
  const k = req.headers.get("x-ce-key");
  if (k && SERVICE_KEY && k === SERVICE_KEY) return true;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token === ANON) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON } });
  return r.ok;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export async function bumpUsage(provider: string, model: string, ok: boolean, exhausted = false): Promise<void> {
  if (!SERVICE_KEY) return;
  try {
    await rest("rpc/bump_usage", { method: "POST", body: JSON.stringify({ p_provider: provider, p_model: model, p_ok: ok, p_exhausted: exhausted }) });
  } catch (_) { /* le compteur ne doit jamais bloquer */ }
}

export function parisDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

/** Modèles déjà épuisés aujourd'hui (pour ne pas les réessayer inutilement). */
export async function exhaustedToday(): Promise<Set<string>> {
  const out = new Set<string>();
  if (!SERVICE_KEY) return out;
  try {
    const r = await rest(`usage?select=provider,model&exhausted=eq.true&day=eq.${parisDay()}`);
    if (r.ok) for (const x of await r.json()) out.add(`${x.provider}:${x.model}`);
  } catch (_) { /* ignore */ }
  return out;
}
