// Lance une action GitHub : la recherche d'offres (récolte puis tri) ou la lecture des mails.
// Appelée par l'app (« Nouvelle recherche ») et par l'horloge de Supabase (pg_cron), plus fiable que celle de GitHub.
// Utilise une clé GitHub limitée à ce dépôt (droit « Actions » seulement), rangée dans les secrets Supabase.
import { authorize, CORS, json, SERVICE_KEY, SUPABASE_URL } from "../_shared/common.ts";

const TOKEN = (Deno.env.get("GH_DISPATCH_TOKEN") ?? "").trim();
const REPO = (Deno.env.get("GH_REPO") ?? "").trim();
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const db = (path: string) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H }).then((r) => r.json()).catch(() => []);

async function fromCron(req: Request): Promise<boolean> {
  const k = req.headers.get("x-ce-cron");
  if (!k) return false;
  const rows = await db("ce_secrets?select=value&name=eq.cron");
  return !!rows?.[0]?.value && rows[0].value === k;
}

async function dispatch(workflow: string, inputs: Record<string, string>): Promise<Response | null> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "candidature-express" },
    body: JSON.stringify({ ref: "main", inputs }),
  });
  return r.status === 204 ? null : json({ error: "github", detail: `HTTP ${r.status} ${(await r.text()).slice(0, 160)}` }, 502);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const cron = await fromCron(req);
  if (!cron && !(await authorize(req))) return json({ error: "non autorisé" }, 401);
  if (!TOKEN || !REPO) return json({ error: "non configuré" }, 501);
  let b: { wf?: string } = {};
  try { b = await req.json(); } catch (_) { /* corps vide : recherche */ }

  if (b.wf === "mails") {
    // Seulement s'il y a de nouveaux mails transmis par le script Gmail (sinon rien à faire).
    const since = new Date(Date.now() - 20 * 60e3).toISOString();
    const rows = await db(`mails?select=id&created_at=gte.${encodeURIComponent(since)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return json({ ok: true, rien: true });
    return (await dispatch("mails.yml", { auto: "true" })) ?? json({ ok: true });
  }

  // Recherche : pas plus d'une toutes les 10 minutes (une récolte complète dure de 5 à 15 minutes).
  const st = await db("docs?select=data&col=eq.ce&id=eq.sources");
  const s = st?.[0]?.data ?? {};
  const last = Math.max(s._run?.at ?? 0, s._asked ?? 0);
  if (Date.now() - last < (cron ? 25 : 10) * 60e3) return json({ ok: true, deja: true, depuis: Math.round((Date.now() - last) / 60e3) });
  const err = await dispatch("recherche.yml", { force: cron ? "false" : "true", only: "" });
  if (err) return err;
  if (st?.[0]) {
    await fetch(`${SUPABASE_URL}/rest/v1/docs?col=eq.ce&id=eq.sources`, {
      method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...s, _asked: Date.now() } }),
    });
  }
  return json({ ok: true });
});
