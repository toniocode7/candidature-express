// Lance tout de suite la recherche automatique (récolte sur tous les sites puis tri), à la demande de l'app.
// Utilise une clé GitHub limitée à ce dépôt (droit « Actions » seulement), rangée dans les secrets Supabase.
import { authorize, CORS, json, SERVICE_KEY, SUPABASE_URL } from "../_shared/common.ts";

const TOKEN = (Deno.env.get("GH_DISPATCH_TOKEN") ?? "").trim();
const REPO = (Deno.env.get("GH_REPO") ?? "").trim();
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await authorize(req))) return json({ error: "non autorisé" }, 401);
  if (!TOKEN || !REPO) return json({ error: "non configuré" }, 501);
  // Pas plus d'un lancement toutes les 10 minutes : une récolte complète dure de 5 à 15 minutes.
  const st = await fetch(`${SUPABASE_URL}/rest/v1/docs?select=data&col=eq.ce&id=eq.sources`, { headers: H }).then((r) => r.json()).catch(() => []);
  const s = st?.[0]?.data ?? {};
  const last = Math.max(s._run?.at ?? 0, s._asked ?? 0);
  if (Date.now() - last < 10 * 60e3) return json({ ok: true, deja: true, depuis: Math.round((Date.now() - last) / 60e3) });
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/recherche.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "candidature-express" },
    body: JSON.stringify({ ref: "main", inputs: { force: "true", only: "" } }),
  });
  if (r.status !== 204) return json({ error: "github", detail: `HTTP ${r.status} ${(await r.text()).slice(0, 160)}` }, 502);
  if (st?.[0]) {
    await fetch(`${SUPABASE_URL}/rest/v1/docs?col=eq.ce&id=eq.sources`, {
      method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...s, _asked: Date.now() } }),
    });
  }
  return json({ ok: true });
});
