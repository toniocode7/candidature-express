// Calendrier des entretiens au format .ics (Calendrier de l'iPhone et du Mac).
//  ?k=<jeton>&id=<offre> : un entretien, à ajouter d'un toucher
//  ?k=<jeton>            : tous les entretiens, pour un calendrier abonné (mis à jour tout seul)
import { SERVICE_KEY, SUPABASE_URL } from "../_shared/common.ts";

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

function esc(s: string): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (s.length > 70) { out.push(s.slice(0, 70)); s = " " + s.slice(70); }
  out.push(s);
  return out.join("\r\n");
}
function utc(t: number): string {
  return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function day(t: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(t)).replace(/-/g, "");
}

function event(o: any): string | null {
  const iv = o.iv || {};
  if (!iv.at) return null;
  const a = o.an || {}, m = o.meta || {}, g = o.sug || {};
  const poste = a.poste || m.poste || g.titre || "Entretien";
  const ent = a.entreprise || m.entreprise || g.entreprise || "";
  const kind = iv.kind ? ` (${iv.kind})` : "";
  const lines = [
    "BEGIN:VEVENT", `UID:entretien-${o.id}@candidature-express`, `DTSTAMP:${utc(Date.now())}`,
  ];
  if (iv.noh) {
    lines.push(`DTSTART;VALUE=DATE:${day(iv.at)}`, `DTEND;VALUE=DATE:${day(iv.at + 864e5)}`);
  } else {
    lines.push(`DTSTART:${utc(iv.at)}`, `DTEND:${utc(iv.at + (+iv.dur || 60) * 60000)}`);
  }
  lines.push(
    `SUMMARY:${esc(`Entretien ${ent ? ent + " - " : ""}${poste}${kind}`)}`,
    `LOCATION:${esc(iv.loc || "")}`,
    `DESCRIPTION:${esc([`Poste : ${poste}`, ent && `Entreprise : ${ent}`, o.url && `Annonce : ${o.url}`, "Préparation : ouvre Candidature Express."].filter(Boolean).join("\n"))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Entretien demain", "TRIGGER:-P1D", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Entretien dans 2 heures", "TRIGGER:-PT2H", "END:VALARM",
    "END:VEVENT",
  );
  return lines.map(fold).join("\r\n");
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const k = u.searchParams.get("k") ?? "";
  const id = u.searchParams.get("id") ?? "";
  const tok = await (await fetch(`${SUPABASE_URL}/rest/v1/docs?select=data&col=eq.ce&id=eq.cal`, { headers: H })).json();
  if (!k || !tok.length || tok[0].data?.token !== k) return new Response("Lien de calendrier invalide.", { status: 401 });
  const path = id ? `docs?select=data&col=eq.app&id=eq.${encodeURIComponent("o_" + id)}` : "docs?select=data&col=eq.app&id=like.o_*&data->iv->>at=not.is.null";
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })).json();
  const evs = (Array.isArray(rows) ? rows : []).map((r: any) => event(r.data)).filter(Boolean);
  const cal = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Candidature Express//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Entretiens", "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", ...evs, "END:VCALENDAR"].join("\r\n") + "\r\n";
  return new Response(cal, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${id ? "entretien" : "entretiens"}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
