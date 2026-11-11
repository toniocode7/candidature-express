// Point d'entrée du script Google (Gmail) : reçoit les mails de recruteurs,
// remet les brouillons de réponse à créer. Protégé par une phrase secrète (CE_MAIL_KEY).
import { bumpUsage, CORS, json, SERVICE_KEY, SUPABASE_URL } from "../_shared/common.ts";

const MAIL_KEY = (Deno.env.get("CE_MAIL_KEY") ?? "").trim();
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!MAIL_KEY || (req.headers.get("x-ce-mail-key") ?? "").trim() !== MAIL_KEY) return json({ error: "non autorisé" }, 401);
  let b: any;
  try { b = await req.json(); } catch (_) { return json({ error: "requête illisible" }, 400); }

  if (b.action === "mails") {
    const rows = (b.mails ?? []).slice(0, 200).map((m: any) => ({
      id: String(m.id), thread_id: String(m.threadId), data: m, received_at: new Date(+m.internalDate || Date.now()).toISOString(),
    }));
    if (rows.length) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/mails?on_conflict=id`, {
        method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows),
      });
      if (!r.ok) return json({ error: "base", detail: (await r.text()).slice(0, 200) }, 500);
      const added = (await r.json()).length;
      await bumpUsage("gmail", "mails", true);
      return json({ ok: true, recus: rows.length, nouveaux: added });
    }
    await bumpUsage("gmail", "vide", true);
    return json({ ok: true, recus: 0, nouveaux: 0 });
  }

  if (b.action === "drafts") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/drafts_out?select=id,data&done_at=is.null&order=created_at`, { headers: H });
    return json({ drafts: r.ok ? await r.json() : [] });
  }

  if (b.action === "draft_done") {
    const ids = (b.ids ?? []).map(String).filter((x: string) => /^[0-9a-f-]{36}$/.test(x));
    if (ids.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/drafts_out?id=in.(${ids.join(",")})`, {
        method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ done_at: new Date().toISOString() }),
      });
    }
    return json({ ok: true });
  }
  return json({ error: "action inconnue" }, 400);
});
