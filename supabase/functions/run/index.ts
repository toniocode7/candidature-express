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

  if (b.wf === "rappels") {
    return (await dispatch("rappels.yml", {})) ?? json({ ok: true });
  }

  if (b.wf === "mails") {
    // Seulement s'il y a de nouveaux mails transmis par le script Gmail (sinon rien à faire).
    const since = new Date(Date.now() - 20 * 60e3).toISOString();
    const rows = await db(`mails?select=id&created_at=gte.${encodeURIComponent(since)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) return json({ ok: true, rien: true });
    return (await dispatch("mails.yml", { auto: "true" })) ?? json({ ok: true });
  }

  // Recherche automatique : à 0 h, 6 h, 12 h et 18 h (heure de Paris), sauf si tu en as lancé une toi-même il y a moins d'une heure.
  // Recherche manuelle : toujours, sauf si une autre vient d'être lancée il y a moins de 10 minutes (double toucher).
  const st = await db("docs?select=data&col=eq.ce&id=eq.sources");
  const s = st?.[0]?.data ?? {};
  const now = Date.now();
  if (cron) {
    const heure = +new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(new Date());
    if (heure % 6 !== 0) return json({ ok: true, horsCreneau: heure });
    if (now - (s._manual ?? 0) < 60 * 60e3) return json({ ok: true, deja: true, manuelle: Math.round((now - s._manual) / 60e3) });
  } else if (now - (s._asked ?? 0) < 10 * 60e3) {
    return json({ ok: true, deja: true, depuis: Math.round((now - s._asked) / 60e3) });
  }
  const err = await dispatch("recherche.yml", { force: cron ? "false" : "true", only: "" });
  if (err) return err;
  if (st?.[0]) {
    await fetch(`${SUPABASE_URL}/rest/v1/docs?col=eq.ce&id=eq.sources`, {
      method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...s, _asked: now, ...(cron ? {} : { _manual: now }) } }),
    });
  }
  return json({ ok: true });
});
