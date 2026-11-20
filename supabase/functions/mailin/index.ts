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
  // Noms des entreprises et agences de tes candidatures : le script Gmail transmet aussi leurs mails sans mot-clé.
  if (b.action === "senders") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/docs?select=a:data->an->>entreprise,m:data->meta->>entreprise,g:data->sug->>entreprise,st:data->st&col=eq.app&id=like.o_*`, { headers: H });
    const rows: any[] = r.ok ? await r.json() : [];
    const HEAD = /^(groupe?|group|the)$/i; // en début : « Groupe Léon Vincent » → « Léon Vincent »
    const TAIL = /^(sas|sa|sarl|sasu|eurl|ltd|limited|inc|gmbh|france|emploi|interim|intérim|recrutement|services?)$/i; // en fin seulement
    const STOP = /^(de|du|des|d|la|le|les|et|&)$/i;
    const noms = new Set<string>();
    for (const x of rows) {
      if (x.st == null) continue;
      for (const raw of [x.a, x.m, x.g]) {
        for (const part of String(raw ?? "").split(/[()\/–—,;]| - | pour | via /)) {
          // Mots génériques retirés seulement en début ou en fin de nom (« Naval Group » reste entier).
          let words = part.trim().split(/\s+/).filter(Boolean);
          while (words.length && HEAD.test(words[0])) words.shift();
          while (words.length && (TAIL.test(words[words.length - 1]) || STOP.test(words[words.length - 1]))) words.pop();
          words = words.slice(0, 4);
          while (words.length && STOP.test(words[words.length - 1])) words.pop();
          const n = words.join(" ").replace(/["']/g, "").trim();
          if (words.length === 1 && n.length < 4) continue; // sigle trop court seul (ex. « TER ») : trop de faux résultats
          if (n.length >= 3 && !/^(confidentiel|non communiqué|entreprise|client|anonyme)/i.test(n)) noms.add(n);
        }
      }
    }
    return json({ noms: [...noms].slice(0, 120) });
  }

  // Sauvegarde complète (déposée chaque semaine dans ton Google Drive par le script Google).
  if (b.action === "backup") {
    const docs: any[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/docs?select=col,id,data,updated_at&col=in.(app,ce)&id=neq.autoprep&order=col,id`, {
        headers: { ...H, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
      });
      if (!r.ok) return json({ error: "base", detail: (await r.text()).slice(0, 200) }, 500);
      const part = await r.json();
      docs.push(...part);
      if (part.length < 1000) break;
    }
    await bumpUsage("sauvegarde", "drive", true);
    return json({ app: "Candidature Express", v: 2, at: new Date().toISOString(), candidatures: docs.filter((d) => d.col === "app" && /^o_/.test(d.id)).length, docs });
  }
  return json({ error: "action inconnue" }, 400);
});
