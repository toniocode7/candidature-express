// Lecture d'une page d'annonce, sans service payant.
// 1. Lecture directe de la page (données structurées JobPosting si présentes, sinon le texte).
// 2. Cas particulier LinkedIn : page publique de l'offre.
// 3. Secours : Gemini lit la page lui-même (outil « URL context »), sur le quota gratuit.
import { authorize, bumpUsage, CORS, json, SUPABASE_URL } from "../_shared/common.ts";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

function decode(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlToText(h: string): string {
  return decode(h
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n").replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

function jobPosting(html: string): Record<string, any> | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const x = stack.shift();
        if (!x || typeof x !== "object") continue;
        const t = x["@type"];
        if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return x;
        if (Array.isArray(x["@graph"])) stack.push(...x["@graph"]);
      }
    } catch (_) { /* bloc suivant */ }
  }
  return null;
}

function postingToText(j: Record<string, any>): string {
  const org = typeof j.hiringOrganization === "object" ? j.hiringOrganization?.name : j.hiringOrganization;
  const locs = ([] as any[]).concat(j.jobLocation ?? []).map((l) => {
    const a = l?.address ?? {};
    return [a.addressLocality, a.postalCode, a.addressRegion, a.addressCountry?.name ?? a.addressCountry].filter(Boolean).join(", ");
  }).filter(Boolean);
  const sal = j.baseSalary?.value ? (() => {
    const v = j.baseSalary.value;
    const amount = v.minValue && v.maxValue ? `${v.minValue} - ${v.maxValue}` : v.value ?? v.minValue ?? "";
    return `${amount} ${j.baseSalary.currency ?? ""} ${v.unitText ? "par " + v.unitText : ""}`.trim();
  })() : "";
  const lines = [
    `Intitulé : ${decode(String(j.title ?? ""))}`,
    org ? `Entreprise : ${decode(String(org))}` : "",
    locs.length ? `Lieu : ${locs.join(" ; ")}` : "",
    j.employmentType ? `Contrat : ${[].concat(j.employmentType).join(", ")}` : "",
    sal ? `Salaire : ${sal}` : "",
    j.datePosted ? `Publiée le : ${String(j.datePosted).slice(0, 10)}` : "",
    j.validThrough ? `Valable jusqu'au : ${String(j.validThrough).slice(0, 10)}` : "",
    j.experienceRequirements ? `Expérience : ${typeof j.experienceRequirements === "object" ? JSON.stringify(j.experienceRequirements) : j.experienceRequirements}` : "",
    "",
    htmlToText(String(j.description ?? "")),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function fetchPage(url: string): Promise<{ status: number; html: string; finalUrl: string }> {
  const r = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(20000),
  });
  const html = r.headers.get("content-type")?.includes("html") || r.headers.get("content-type")?.includes("text") ? await r.text() : "";
  return { status: r.status, html, finalUrl: r.url };
}

function linkedinId(url: string): string | null {
  const m = /linkedin\.com\/.*?(?:jobs\/view\/(?:[^/?#]*-)?|currentJobId=)(\d{6,})/i.exec(url);
  return m ? m[1] : null;
}

const GONE = /(offre (n'est plus|a été|est) (disponible|pourvue|expirée|clôturée)|annonce (a expiré|n'est plus en ligne|n'existe plus)|no longer (available|accepting)|job (has )?expired|this job is closed|n'accepte plus de candidatures)/i;
const BLOCKED = /(captcha|cloudflare|access denied|are you a robot|vérification de sécurité|enable javascript|unusual traffic|just a moment)/i;

async function viaGemini(req: Request, url: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: req.headers.get("authorization") ?? "", "x-ce-key": req.headers.get("x-ce-key") ?? "", apikey: req.headers.get("apikey") ?? "" },
    body: JSON.stringify({
      mode: "text", tier: "light", url,
      prompt: `Lis cette page : ${url}\nSi c'est une offre d'emploi, recopie fidèlement et en entier, dans la langue d'origine, le texte de l'annonce : intitulé, entreprise, lieu, contrat, salaire, date de publication, missions, profil recherché, avantages. N'invente rien et ne résume pas. Si la page est inaccessible, ne contient pas d'offre, ou indique que l'offre n'est plus disponible, réponds seulement : INDISPONIBLE`,
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  const t = String(j.text ?? "").trim();
  return /^INDISPONIBLE\b/.test(t) ? "" : t;
}

// Recherche web gratuite et sans clé : DuckDuckGo (version HTML), Wikipédia en secours.
async function webSearch(q: string): Promise<{ title: string; url: string; description: string }[]> {
  const out: { title: string; url: string; description: string }[] = [];
  try {
    const r = await fetch("https://html.duckduckgo.com/html/?kl=fr-fr&q=" + encodeURIComponent(q), {
      headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(12000),
    });
    const h = await r.text();
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(h)) && out.length < 8) {
      let u = decode(m[1]);
      const ud = /[?&]uddg=([^&]+)/.exec(u);
      if (ud) u = decodeURIComponent(ud[1]);
      if (/duckduckgo\.com\/y\.js|ad_domain/.test(u)) continue;
      out.push({ title: htmlToText(m[2]), url: u.startsWith("//") ? "https:" + u : u, description: htmlToText(m[3]) });
    }
  } catch (_) { /* secours */ }
  if (!out.length) {
    try {
      const r = await fetch("https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=" + encodeURIComponent(q), { signal: AbortSignal.timeout(10000) });
      for (const x of (await r.json()).query?.search ?? []) {
        out.push({ title: x.title, url: "https://fr.wikipedia.org/wiki/" + encodeURIComponent(String(x.title).replace(/ /g, "_")), description: htmlToText(String(x.snippet)) });
      }
    } catch (_) { /* rien */ }
  }
  await bumpUsage("recherche-web", out.length ? "ok" : "vide", out.length > 0);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await authorize(req))) return json({ error: "non autorisé" }, 401);
  let body: { url?: string; check?: boolean; noAi?: boolean; search?: string };
  try { body = await req.json(); } catch (_) { return json({ error: "requête illisible" }, 400); }
  if (body.search) return json({ web: await webSearch(String(body.search).slice(0, 200)) });
  let url = String(body.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return json({ error: "adresse invalide" }, 400);

  // France Travail : la page d'une annonce affiche son détail avec du JavaScript ; on lit ce détail à la source.
  const ft = /candidat\.francetravail\.fr\/offres\/recherche\/detail\/([A-Za-z0-9]+)/.exec(url);
  if (ft) {
    try {
      const r = await fetch(`https://candidat.francetravail.fr/api-descriptifoffre/offre/${ft[1]}`, {
        headers: { "User-Agent": UA, Accept: "application/json", Referer: url }, signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404 || r.status === 410) return json({ statusCode: 410, gone: true, title: "", markdown: "", via: "francetravail" });
      if (r.ok) {
        const j: any = await r.json();
        const ep = j.experienceProfil ?? {};
        const parts = [
          j.intituleOffre, j.etablissement?.nom ?? j.etablissement?.raisonSociale, j.libelleCodeLieuTravail ?? j.lieuTravail?.libelle,
          j.syntheseContrat, j.syntheseHoraire, j.salaire?.libelle ?? (typeof j.salaire === "string" ? j.salaire : ""),
          j.descriptif,
          ep.experience ? `Expérience : ${ep.experience}${ep.estUneExperienceIndispensable ? " - Expérience exigée (indispensable)" : " - Expérience souhaitée"}` : "",
          ...(j.listeFormation ?? []).map((f: any) => "Formation : " + (f.libelle ?? f.niveauLibelle ?? JSON.stringify(f))),
          ...(j.listeCompetence ?? []).map((c: any) => "Compétence : " + (c.libelle ?? JSON.stringify(c))),
          ...(j.listeLangue ?? []).map((c: any) => "Langue : " + (c.libelle ?? JSON.stringify(c))),
          j.descriptionEntreprise,
        ].filter((x) => x && String(x).trim()).map((x) => String(x).replace(/\\n/g, "\n"));
        const text = parts.join("\n\n");
        await bumpUsage("lecture", "francetravail", text.length >= 200);
        if (body.check) return json({ statusCode: 200, gone: false, blocked: false, via: "francetravail" });
        return json({ statusCode: 200, title: String(j.intituleOffre ?? ""), markdown: text.slice(0, 30000), via: "francetravail", blocked: false });
      }
    } catch (_) { /* lecture classique plus bas */ }
  }

  const li = linkedinId(url);
  if (li) url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${li}`;

  let status = 0, title = "", text = "", via = "direct", blocked = false;
  try {
    const p = await fetchPage(url);
    status = p.status;
    title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(p.html)?.[1] ?? "").trim());
    const jp = jobPosting(p.html);
    if (jp) { text = postingToText(jp); via = "jobposting"; }
    else text = htmlToText(p.html);
    blocked = status === 403 || status === 429 || (text.length < 1500 && BLOCKED.test(text));
  } catch (e) {
    blocked = true;
    text = "";
    title = String((e as Error).message ?? e).slice(0, 100);
  }
  await bumpUsage("lecture", via, !blocked && text.length >= 400);

  const gone = status === 404 || status === 410 || (!blocked && GONE.test(text.slice(0, 5000)));
  if (body.check) return json({ statusCode: gone ? 410 : status, gone, blocked, via });

  if (!gone && (blocked || text.replace(/\s+/g, " ").length < 400) && !body.noAi) {
    const t = await viaGemini(req, String(body.url));
    if (t.length >= 300) { text = t; via = "gemini"; blocked = false; }
  }
  return json({ statusCode: gone ? 410 : (blocked ? 403 : status), title, markdown: text.slice(0, 30000), via, blocked });
});
