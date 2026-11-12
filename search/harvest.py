"""Récolte d'offres d'emploi, sans service payant.

Lancé par GitHub Actions plusieurs fois par jour. Lit les critères de recherche
dans la base Supabase (onglet Suggérées de l'app), interroge chaque source,
puis enregistre les offres brutes dans la table raw_offers. Le tri (note IA,
métiers exclus, doublons, offres écartées) est fait ensuite par l'app elle-même.

Aucune donnée personnelle n'est écrite dans ce fichier : tout est lu dans la base.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import os
import random
import re
import sys
import time
import traceback
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, quote_plus, urljoin, urlparse, parse_qs, urlencode

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xp import scan as xp_scan  # noqa: E402

SB_URL = f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co"
SB_KEY = os.environ["SUPABASE_SECRET_KEY"]
FORCE = "--force" in sys.argv
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--only=")), None)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
NOW = datetime.now(timezone.utc)
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- Supabase
def rest(method: str, path: str, **kw):
    r = requests.request(method, f"{SB_URL}/rest/v1/{path}", headers={**H, **kw.pop("headers", {})}, timeout=60, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase {method} {path.split('?')[0]} : {r.status_code} {r.text[:200]}")
    return r.json() if r.text else None


def user_id() -> str:
    r = requests.get(f"{SB_URL}/auth/v1/admin/users", headers=H, timeout=30)
    r.raise_for_status()
    users = r.json().get("users", [])
    if not users:
        raise RuntimeError("Aucun compte utilisateur")
    return users[0]["id"]


def get_doc(uid: str, col: str, did: str):
    rows = rest("GET", f"docs?select=data&user_id=eq.{uid}&col=eq.{col}&id=eq.{quote(did)}")
    return rows[0]["data"] if rows else None


def set_doc(uid: str, col: str, did: str, data):
    rest("POST", "docs?on_conflict=user_id,col,id", headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
         data=json.dumps({"user_id": uid, "col": col, "id": did, "data": data, "updated_at": NOW.isoformat()}))


def bump(provider: str, model: str, ok: bool):
    try:
        rest("POST", "rpc/bump_usage", data=json.dumps({"p_provider": provider, "p_model": model, "p_ok": ok, "p_exhausted": False}))
    except Exception:
        pass


# ---------------------------------------------------------------- Outils
def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def split_list(s) -> list[str]:
    return [x.strip() for x in re.split(r"[,;\n]", str(s or "")) if x.strip()]


def clean(s) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))
    return re.sub(r"\s+", " ", s).strip()


def norm_url(u: str) -> str:
    try:
        p = urlparse(u)
        host = p.netloc.lower().removeprefix("www.")
        if "indeed." in host:
            jk = (parse_qs(p.query).get("jk") or parse_qs(p.query).get("vjk") or [""])[0]
            if jk:
                return f"indeed:{jk}"
        m = re.search(r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d{6,})", u)
        if m:
            return f"linkedin:{m.group(1)}"
        q = {k: v for k, v in parse_qs(p.query).items() if not re.match(r"(utm_|ref|src|from|trk|tracking|origin|position|page|xtor)", k, re.I)}
        return f"{host}{p.path.rstrip('/')}" + (f"?{urlencode(q, doseq=True)}" if q else "")
    except Exception:
        return u


def oid(u: str) -> str:
    return hashlib.sha1(norm_url(u).encode()).hexdigest()[:24]


def ms(d) -> int | None:
    if not d:
        return None
    try:
        if isinstance(d, (int, float)):
            return int(d)
        if hasattr(d, "timestamp"):
            return int(d.timestamp() * 1000)
        return int(datetime.fromisoformat(str(d)[:10]).replace(tzinfo=timezone.utc).timestamp() * 1000)
    except Exception:
        return None


def offer(src: str, site: str, url: str, titre: str, entreprise="", lieu="", contrat="", salaire="", pub=None,
          extrait="", cc="FR", web=False, full="") -> dict | None:
    titre = clean(titre)
    if not url or not titre or len(titre) < 4:
        return None
    o = {"titre": re.sub(r"\s*[\(\[]?\b[HFhf]\s*/\s*[HFhf]\b[\)\]]?", "", titre).strip(), "otitre": titre,
         "entreprise": clean(entreprise), "lieu": clean(lieu), "contrat": clean(contrat), "salaire": clean(salaire),
         "url": url, "site": site, "src": src, "cc": cc}
    p = ms(pub)
    if p:
        o["pub"] = p
        o["date"] = "publiée le " + datetime.fromtimestamp(p / 1000, timezone.utc).strftime("%d/%m")
    if extrait:
        o["extrait"] = clean(extrait)[:600]
    if web:
        o["web"] = 1
    if full and len(str(full)) > 150:
        xp_set(o, str(full))
    return o


def xp_set(o: dict, text: str):
    """Expérience demandée, lue sur le texte complet de l'annonce (voir xp.py)."""
    r = xp_scan(text)
    o["xpChk"] = 1
    o["xpmin"] = r["hard"]
    o["xpsoft"] = r["soft"]
    if r["txt"]:
        o["xpTxt"] = r["txt"]


def get(url: str, **kw) -> requests.Response:
    return requests.get(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                                      "Accept": "text/html,application/xhtml+xml,application/json"}, timeout=30, **kw)


# ---------------------------------------------------------------- Sources
COUNTRIES = {  # ville ou pays -> (pays Indeed pour JobSpy, lieu)
    "etats unis": ("usa", "United States"), "usa": ("usa", "United States"), "canada": ("canada", "Canada"),
    "suisse": ("switzerland", "Switzerland"), "londres": ("uk", "London"), "royaume uni": ("uk", "United Kingdom"),
    "amsterdam": ("netherlands", "Amsterdam"), "barcelone": ("spain", "Barcelona"), "madrid": ("spain", "Madrid"),
    "budapest": ("hungary", "Budapest"), "bruxelles": ("belgium", "Brussels"), "prague": ("czech republic", "Prague"),
    "stockholm": ("sweden", "Stockholm"), "copenhague": ("denmark", "Copenhagen"), "dublin": ("ireland", "Dublin"),
    "berlin": ("germany", "Berlin"), "luxembourg": ("luxembourg", "Luxembourg"), "lisbonne": ("portugal", "Lisbon"),
    "montreal": ("canada", "Montreal"), "quebec": ("canada", "Quebec"),
}
CC = {"usa": "US", "canada": "CA", "switzerland": "CH", "uk": "GB", "netherlands": "NL", "spain": "ES", "hungary": "HU",
      "belgium": "BE", "czech republic": "CZ", "sweden": "SE", "denmark": "DK", "ireland": "IE", "germany": "DE",
      "luxembourg": "LU", "portugal": "PT"}


def jobspy_rows(site: str, term: str, location: str, country: str, hours: int, n: int, km: int = 30):
    from jobspy import scrape_jobs
    df = scrape_jobs(site_name=[site], search_term=term, location=location, country_indeed=country, distance=max(5, round(km / 1.609)),
                     results_wanted=n, hours_old=hours, linkedin_fetch_description=False, verbose=0)
    return [] if df is None else df.to_dict("records")


def from_jobspy(r: dict, site: str, cc: str) -> dict | None:
    loc = r.get("location") or ""
    if not loc:
        loc = ", ".join(str(x) for x in [r.get("city"), r.get("state")] if x and str(x) != "nan")
    sal = ""
    if r.get("min_amount") and str(r.get("min_amount")) != "nan":
        sal = f"{int(r['min_amount'])}-{int(r.get('max_amount') or r['min_amount'])} {r.get('currency') or ''} / {r.get('interval') or ''}".strip()
    jt = str(r.get("job_type") or "")
    contrat = {"fulltime": "", "parttime": "Temps partiel", "contract": "CDD", "temporary": "Intérim", "internship": "Stage"}.get(jt.split(",")[0].strip(), "")
    return offer(site, "Indeed" if site == "indeed" else "LinkedIn", r.get("job_url") or "", r.get("title") or "",
                 r.get("company") or "", loc, contrat, sal, r.get("date_posted"),
                 str(r.get("description") or "")[:600] if str(r.get("description") or "") != "nan" else "", cc,
                 full=str(r.get("description") or "") if str(r.get("description") or "") != "nan" else "")


def src_jobspy(site: str, C: dict) -> list[dict]:
    out, errs, done = [], [], 0
    hours = C["win"] * 24
    queries = []
    if C["zf"]:
        for lieu in C["lieux"]:
            for kw in C["kws"]:
                queries.append((kw, lieu, "france", "FR"))
    if C["zd"]:
        for d in C["drom"]:
            queries.append((C["kws"][C["rot"] % len(C["kws"])], d, "france", "FR"))
    if C["ze"]:
        etr = C["etr"]
        k = C["rot"] % max(1, len(etr))
        for place in (etr[k:] + etr[:k])[:4]:  # 4 destinations par passage, à tour de rôle
            m = COUNTRIES.get(norm(place))
            if m:
                queries.append((" OR ".join(C["kwen"][:3]), m[1], m[0], CC.get(m[0], "")))
    if C["zc"]:
        for ent in C["ent"]:
            queries.append((f"{C['kws'][0]} {ent}", "France", "france", "FR"))
    random.shuffle(queries)
    budget = 26 if site == "indeed" else 16
    for term, loc, country, cc in queries[:budget]:
        try:
            rows = jobspy_rows(site, term, loc, country, hours, 25 if site == "indeed" else 15, C["rayon"])
            done += 1
            for r in rows:
                o = from_jobspy(r, site, cc)
                if o:
                    out.append(o)
        except Exception as e:
            errs.append(f"{term} / {loc} : {str(e)[:120]}")
            if "429" in str(e) or "blocked" in str(e).lower():
                break
        time.sleep(random.uniform(2, 5) if site == "linkedin" else random.uniform(1, 2))
    if not out and errs:
        raise RuntimeError(errs[0])
    log(f"  {done} recherches, {len(errs)} échecs")
    return out


def commune(nom: str) -> str | None:
    try:
        r = requests.get("https://geo.api.gouv.fr/communes", params={"nom": nom, "fields": "code", "boost": "population", "limit": 1}, timeout=15)
        js = r.json()
        return js[0]["code"] if js else None
    except Exception:
        return None


DROM_DEP = {"la reunion": "974", "reunion": "974", "martinique": "972", "guadeloupe": "971", "guyane": "973", "mayotte": "976"}


def src_francetravail(C: dict) -> list[dict]:
    """Site public candidat.francetravail.fr (l'API officielle n'est plus en libre-service)."""
    out, errs = [], []
    places = []
    if C["zf"]:
        for l in C["lieux"]:
            c = commune(l)
            if c:
                places.append((c, l))
    if C["zd"]:
        for d in C["drom"]:
            dep = DROM_DEP.get(norm(d))
            if dep:
                places.append((dep + "D", d))
    for code, label in places:
        for kw in C["kws"]:
            ftc = ",".join(x for x in ({"CDI": "CDI", "CDD": "CDD", "Intérim": "MIS"}.get(c) for c in C["ct"]) if x)
            url = f"https://candidat.francetravail.fr/offres/recherche?motsCles={quote_plus(kw)}&lieux={code}&rayon={min(100, C['rayon'])}&tri=1&offresPartenaires=true" + (f"&typeContrat={ftc}" if ftc else "")
            try:
                r = get(url)
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                items = re.findall(r'<li[^>]*data-id-offre="([^"]+)"[^>]*>([\s\S]*?)</li>', r.text)
                for idd, block in items:
                    t = re.search(r'class="media-heading-title"[^>]*>([\s\S]*?)<', block)
                    sub = re.search(r'class="subtext"[^>]*>([\s\S]*?)</p>', block)
                    ctr = re.search(r'class="contrat[^"]*"[^>]*>([\s\S]*?)</p>', block)
                    dt = re.search(r'class="date"[^>]*>([\s\S]*?)</p>', block)
                    desc = re.search(r'class="description"[^>]*>([\s\S]*?)</p>', block)
                    st = clean(sub.group(1)) if sub else ""
                    ent, _, loc = st.partition(" - ")
                    o = offer("francetravail", "France Travail", f"https://candidat.francetravail.fr/offres/recherche/detail/{idd}",
                              t.group(1) if t else "", ent, loc or label, clean(ctr.group(1)) if ctr else "", "",
                              None, (clean(desc.group(1)) if desc else "") + (" " + clean(dt.group(1)) if dt else ""))
                    if o:
                        out.append(o)
                if not items and "data-id-offre" not in r.text:
                    errs.append(f"page sans offres lisibles ({kw}, {label})")
            except Exception as e:
                errs.append(f"{kw} / {label} : {str(e)[:100]}")
            time.sleep(random.uniform(1, 2))
    if not out and errs:
        raise RuntimeError(errs[0])
    return out


def src_hellowork(C: dict) -> list[dict]:
    out, errs = [], []
    for lieu in (C["lieux"] if C["zf"] else []) + (C["drom"][:3] if C["zd"] else []):
        for kw in C["kws"]:
            hwc = "".join(f"&c={x}" for x in ({"CDI": "CDI", "CDD": "CDD", "Intérim": "Travail_temp"}.get(c) for c in C["ct"]) if x)
            url = f"https://www.hellowork.com/fr-fr/emploi/recherche.html?k={quote_plus(kw)}&l={quote_plus(lieu)}{hwc}&d=w"
            try:
                r = get(url)
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                seen = set()
                for m in re.finditer(r'<a[^>]+href="(/fr-fr/emplois/(\d+)\.html)"[^>]*>([\s\S]{0,1500}?)</a>', r.text):
                    if m.group(2) in seen:
                        continue
                    seen.add(m.group(2))
                    block = m.group(3)
                    aria = re.search(r'aria-label="([^"]+)"', m.group(0))
                    ps = [clean(x) for x in re.findall(r"<p[^>]*>([\s\S]*?)</p>", block)]
                    ps = [p for p in ps if p]
                    title = ps[0] if ps else (aria.group(1) if aria else clean(block))
                    o = offer("hellowork", "HelloWork", urljoin("https://www.hellowork.com", m.group(1)), title,
                              ps[1] if len(ps) > 1 else "", lieu, "", "", None, " ".join(ps[2:5]))
                    if o:
                        out.append(o)
            except Exception as e:
                errs.append(f"{kw} / {lieu} : {str(e)[:100]}")
            time.sleep(random.uniform(1, 2))
    if not out and errs:
        raise RuntimeError(errs[0])
    return out


def ld_posting(html_text: str) -> dict | None:
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', html_text):
        try:
            d = json.loads(m.group(1).strip())
        except Exception:
            continue
        stack = d if isinstance(d, list) else [d]
        while stack:
            x = stack.pop(0)
            if isinstance(x, dict):
                t = x.get("@type")
                if t == "JobPosting" or (isinstance(t, list) and "JobPosting" in t):
                    return x
                stack.extend(x.get("@graph") or [])
    return None


def src_meteojob(C: dict) -> list[dict]:
    """Meteojob : liste des offres sur la page de résultats, puis lecture de chaque annonce
    sur sa propre page (intitulé, entreprise et lieu exacts, données structurées)."""
    out, errs, ids = [], [], []
    for lieu in (C["lieux"] if C["zf"] else [])[:3]:
        for kw in C["kws"][:3]:
            url = f"https://www.meteojob.com/jobsearch/offers?what={quote(kw)}&where={quote(lieu)}"
            try:
                r = get(url)
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                for jid in re.findall(r'href="/jobs/(\d{5,})', r.text):
                    if jid not in ids:
                        ids.append(jid)
            except Exception as e:
                errs.append(f"{kw} / {lieu} : {str(e)[:100]}")
            time.sleep(random.uniform(1, 2))
    known = set()
    try:
        rows = rest("GET", "raw_offers?select=data->>url&source=eq.meteojob&last_seen=gte." + quote((NOW - timedelta(days=30)).isoformat()))
        known = {r.get("url") for r in rows}
    except Exception:
        pass
    for jid in ids[:80]:
        u = f"https://www.meteojob.com/jobs/{jid}"
        try:
            r = get(u)
            if r.status_code != 200:
                continue
            jp = ld_posting(r.text)
            if jp:
                org = jp.get("hiringOrganization")
                org = org.get("name") if isinstance(org, dict) else org
                loc = []
                for l in ([] + (jp.get("jobLocation") if isinstance(jp.get("jobLocation"), list) else [jp.get("jobLocation") or {}])):
                    a = (l or {}).get("address") or {}
                    loc.append(", ".join(str(v) for v in [a.get("addressLocality"), a.get("postalCode")] if v))
                o = offer("meteojob", "Meteojob", u, jp.get("title") or "", org or "", "; ".join(x for x in loc if x),
                          ", ".join(jp.get("employmentType") if isinstance(jp.get("employmentType"), list) else [jp.get("employmentType") or ""]),
                          "", jp.get("datePosted"), clean(jp.get("description") or "")[:600],
                          full=clean(jp.get("description") or "") + " " + xp_ld(jp.get("experienceRequirements")))
            else:
                t = re.search(r"<title[^>]*>([\s\S]*?)</title>", r.text)
                tt = clean(t.group(1)) if t else ""
                m = re.match(r"Annonce Emploi (\S+) (.+?) - (.+?) Recrute", tt)
                o = offer("meteojob", "Meteojob", u, m.group(2) if m else tt.split("|")[0], m.group(3) if m else "", "",
                          m.group(1) if m else "", "", None, tt)
            if o:
                out.append(o)
        except Exception as e:
            errs.append(str(e)[:100])
        time.sleep(random.uniform(0.5, 1.2))
    if not out and errs:
        raise RuntimeError(errs[0])
    return out


# ---------------------------------------------------------------- Sites carrières des entreprises surveillées
# Beaucoup de grandes entreprises publient leurs offres via une plateforme de recrutement qui expose
# une liste publique (Workday, SmartRecruiters, Lever, Greenhouse, Recruitee, Teamtailor). On repère
# la plateforme de chaque entreprise une fois (recherche web), puis on lit sa liste à chaque passage.
ATS = [
    ("workday", re.compile(r"https?://([\w-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([\w-]+)")),
    ("smartrecruiters", re.compile(r"https?://(?:jobs|careers)\.smartrecruiters\.com/([\w-]+)")),
    ("lever", re.compile(r"https?://jobs\.(?:eu\.)?lever\.co/([\w-]+)")),
    ("greenhouse", re.compile(r"https?://(?:job-)?boards(?:\.eu)?\.greenhouse\.io/([\w-]+)")),
    ("recruitee", re.compile(r"https?://([\w-]+)\.recruitee\.com")),
    ("teamtailor", re.compile(r"https?://([\w-]+)\.teamtailor\.com")),
]
JOBWORDS = ["supply", "achat", "acheteu", "approvision", "appro ", "logisti", "procurement", "purchas", "buyer", "sourcing",
            "import", "export", "transport", "planif", "planner", "planning", "ordonnanc", " adv ", "administration des ventes",
            "customs", "douane", "flux", "stock", "inventory", "demand", "s op", "material", "commodity"]


def web_search(q: str) -> list[str]:
    urls = []
    try:
        r = requests.post(f"{SB_URL}/functions/v1/read", headers={"x-ce-key": SB_KEY, "Content-Type": "application/json"},
                          data=json.dumps({"search": q}), timeout=40)
        urls = [x.get("url", "") for x in (r.json().get("web") or [])]
    except Exception:
        pass
    return urls


def find_ats(company: str) -> dict | None:
    for q in (f"{company} careers jobs myworkdayjobs OR smartrecruiters OR lever OR greenhouse OR recruitee OR teamtailor",
              f"{company} offres d'emploi carrières recrutement", f"{company} careers"):
        for u in web_search(q):
            for kind, rx in ATS:
                m = rx.search(u)
                if m:
                    g = m.groups()
                    if kind == "workday":
                        return {"ats": kind, "tenant": g[0], "wd": g[1], "site": g[2], "url": f"https://{g[0]}.{g[1]}.myworkdayjobs.com/{g[2]}"}
                    return {"ats": kind, "key": g[0], "url": m.group(0)}
        time.sleep(1)
    return None


def want(title: str, C: dict) -> bool:
    t = " " + norm(title) + " "
    return any(norm(k) in t for k in C["kws"] + C["kwen"]) or any(w in t for w in JOBWORDS)


FOREIGN = ["united states", "usa", "canada", "germany", "deutschland", "united kingdom", "england", "india", "china", "mexico",
           "brazil", "spain", "espana", "italy", "italia", "poland", "netherlands", "belgium", "belgique", "singapore", "japan", "australia",
           "morocco", "maroc", "tunisia", "tunisie", "romania", "czech", "hungary", "portugal", "switzerland", "suisse", "sweden", "denmark",
           "norway", "finland", "austria", "ireland", "turkey", "korea", "vietnam", "malaysia", "thailand", "philippines", "indonesia",
           "south africa", "egypt", "saudi", "emirates", "dubai", "qatar", "israel", "argentina", "chile", "colombia", "peru", "luxembourg"]
FOREIGN_CC = {"us", "uk", "gb", "de", "es", "it", "pl", "nl", "be", "in", "cn", "mx", "br", "ca", "ch", "se", "dk", "no", "fi", "at", "ie", "pt", "ro", "cz", "hu", "sg", "jp", "au", "ma", "tn", "lu"}


def place_ok(loc: str, country: str, C: dict) -> bool:
    """Offres en France (ou sans lieu précis) ; à l'étranger seulement si ce pays ou cette ville est dans tes critères."""
    l = " " + norm(loc + " " + country) + " "
    if re.search(r" (france|fra) ", l):
        return True
    foreign = any(f" {f} " in l for f in FOREIGN) or norm(country) in FOREIGN_CC
    if not foreign:
        return True
    return C["ze"] and any(f" {norm(e)} " in l for e in C["etr"])


def ats_jobs(a: dict, company: str, C: dict) -> list[dict]:
    out, kind = [], a["ats"]
    lim = NOW - timedelta(days=max(C["win"], 14))

    def add(url, title, loc="", country="", pub=None, contrat="", desc=""):
        if not title or not want(title, C) or not place_ok(loc, country, C):
            return
        p = ms(pub)
        if p and p < lim.timestamp() * 1000:
            return
        o = offer("carrieres", f"Site carrières {company}", url, title, company, loc, contrat, "", pub, clean(desc)[:600],
                  "FR" if not country or re.search(r"france|^fr", norm(country)) else "", full=clean(desc))
        if o:
            out.append(o)

    if kind == "workday":
        base = f"https://{a['tenant']}.{a['wd']}.myworkdayjobs.com"
        for kw in (C["kws"][:3] + C["kwen"][:2]):
            r = requests.post(f"{base}/wday/cxs/{a['tenant']}/{a['site']}/jobs", json={"limit": 20, "offset": 0, "searchText": kw, "appliedFacets": {}},
                              headers={"User-Agent": UA, "Accept": "application/json", "Content-Type": "application/json"}, timeout=30)
            if r.status_code != 200:
                raise RuntimeError(f"Workday HTTP {r.status_code}")
            for j in r.json().get("jobPostings") or []:
                add(f"{base}/{a['site']}{j.get('externalPath', '')}", j.get("title"), j.get("locationsText") or "")
            time.sleep(1)
    elif kind == "smartrecruiters":
        r = get(f"https://api.smartrecruiters.com/v1/companies/{a['key']}/postings?limit=100")
        for j in r.json().get("content") or []:
            l = j.get("location") or {}
            add(f"https://jobs.smartrecruiters.com/{a['key']}/{j.get('id')}", j.get("name"), ", ".join(x for x in [l.get("city"), l.get("region")] if x),
                l.get("country") or "", j.get("releasedDate"), (j.get("typeOfEmployment") or {}).get("label") or "")
    elif kind == "lever":
        r = get(f"https://api.lever.co/v0/postings/{a['key']}?mode=json")
        for j in r.json() if r.status_code == 200 else []:
            c = j.get("categories") or {}
            add(j.get("hostedUrl"), j.get("text"), c.get("location") or "", j.get("country") or "",
                datetime.fromtimestamp(j["createdAt"] / 1000, timezone.utc).isoformat() if j.get("createdAt") else None, c.get("commitment") or "", j.get("descriptionPlain") or "")
    elif kind == "greenhouse":
        r = get(f"https://boards-api.greenhouse.io/v1/boards/{a['key']}/jobs")
        for j in r.json().get("jobs") or []:
            add(j.get("absolute_url"), j.get("title"), (j.get("location") or {}).get("name") or "", "", j.get("updated_at"))
    elif kind == "recruitee":
        r = get(f"https://{a['key']}.recruitee.com/api/offers/")
        for j in r.json().get("offers") or []:
            add(j.get("careers_url"), j.get("title"), j.get("location") or j.get("city") or "", j.get("country") or j.get("country_code") or "",
                j.get("published_at"), j.get("employment_type_code") or "", j.get("description") or "")
    elif kind == "teamtailor":
        r = get(f"https://{a['key']}.teamtailor.com/jobs")
        for m in re.finditer(r'href="(https://[\w-]+\.teamtailor\.com/jobs/\d+[^"]*)"[^>]*>([\s\S]{0,400}?)</a>', r.text):
            add(m.group(1), clean(m.group(2)).split("  ")[0][:120])
    return out


def src_careers(C: dict, uid: str) -> list[dict]:
    if not C["zc"] or not C["ent"]:
        return []
    known = get_doc(uid, "ce", "careers") or {}
    out, errs, now = [], [], int(time.time() * 1000)
    for company in C["ent"][:25]:
        k = norm(company)
        a = known.get(k) or {}
        if not a.get("ats") and now - (a.get("tried") or 0) > 7 * 864e5:
            f = find_ats(company)
            a = {**(f or {}), "name": company, "tried": now}
            known[k] = a
        if not a.get("ats"):
            continue
        try:
            jobs = ats_jobs(a, company, C)
            a.update({"n": len(jobs), "at": now, "err": ""})
            out.extend(jobs)
        except Exception as e:
            a.update({"at": now, "err": str(e)[:120]})
            errs.append(f"{company} : {str(e)[:100]}")
        time.sleep(random.uniform(1, 2))
    # Entreprises retirées de la liste : on oublie leur page.
    keep = {norm(c) for c in C["ent"]}
    set_doc(uid, "ce", "careers", {k: v for k, v in known.items() if k in keep})
    if not out and errs and len(errs) == len([1 for c in C["ent"] if (known.get(norm(c)) or {}).get("ats")]):
        raise RuntimeError(errs[0])
    log(f"  {sum(1 for c in C['ent'] if (known.get(norm(c)) or {}).get('ats'))} pages carrières sur {len(C['ent'])} entreprises")
    return out


def xp_ld(e) -> str:
    """experienceRequirements des données structurées : texte, ou nombre de mois (cité, pas exigé)."""
    if isinstance(e, str):
        return clean(e)
    if isinstance(e, dict) and e.get("monthsOfExperience"):
        try:
            return f". Expérience de {round(float(e['monthsOfExperience']) / 12)} ans."
        except Exception:
            return ""
    return ""


def page_text(src: str, h: str) -> str:
    h = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", h)
    if src == "linkedin":
        m = re.search(r'class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)</div>', h)
        if m:
            h = m.group(1)
    elif src == "hellowork":
        a = h.find("Les missions du poste")
        a = a if a >= 0 else h.find("Le profil recherché")
        z = h.find("Recherches similaires")
        if a >= 0:
            h = h[a:z if z > a else None]
    return clean(re.sub(r"</(p|li|div|h\d|br)>|<br\s*/?>", ".\n", h))


def ft_detail(idd: str) -> dict | None:
    """Détail structuré d'une annonce France Travail (celui qu'affiche le site)."""
    r = requests.get(f"https://candidat.francetravail.fr/api-descriptifoffre/offre/{idd}", timeout=30,
                     headers={"User-Agent": UA, "Accept": "application/json", "Referer": f"https://candidat.francetravail.fr/offres/recherche/detail/{idd}"})
    return r.json() if r.status_code == 200 else None


def ft_xp(o: dict, j: dict):
    """France Travail précise lui-même si l'expérience est indispensable : on suit ce champ."""
    xp_set(o, str(j.get("descriptif") or "").replace("\\n", "\n"))
    sal = j.get("salaire")
    sal = (sal.get("libelle") or sal.get("complement1") or "") if isinstance(sal, dict) else (sal or "")
    if sal and not o.get("salaire"):
        o["salaire"] = clean(sal)
    ep = j.get("experienceProfil") or {}
    m = re.search(r"(\d+)\s*(an|mois)", str(ep.get("experience") or ""), re.I)
    if m:
        n = int(m.group(1)) // (12 if m.group(2).lower() == "mois" else 1)
        if ep.get("estUneExperienceIndispensable"):
            o["xpmin"] = n
            o["xpTxt"] = f"France Travail : {ep.get('experience')} d'expérience, indispensable"
        else:
            o["xpmin"] = 0
            o.pop("xpTxt", None)
            o["xpsoft"] = max(n, o.get("xpsoft") or 0)


ENRICH_END = time.time() + 14 * 60  # 14 minutes de lecture au plus par récolte ; le reste attend la suivante


def enrich(found: list[dict]):
    """Lit la page de chaque nouvelle annonce pour connaître l'expérience exigée.
    Les annonces déjà lues lors d'une récolte précédente gardent leur résultat."""
    todo = [o for o in found if not o.get("xpChk")]
    prior = {}
    ids = list({oid(o["url"]) for o in todo})
    for k in range(0, len(ids), 80):
        try:
            rows = rest("GET", "raw_offers?select=id,xpChk:data->xpChk,xpmin:data->xpmin,xpsoft:data->xpsoft,xpTxt:data->>xpTxt&id=in.(" + ",".join(ids[k:k + 80]) + ")")
            prior.update({r["id"]: r for r in rows if r.get("xpChk")})
        except Exception as e:
            log("Lecture des résultats précédents impossible :", e)
    fresh = []
    for o in todo:
        r = prior.get(oid(o["url"]))
        if r:
            o.update({k: r[k] for k in ("xpChk", "xpmin", "xpsoft", "xpTxt") if r.get(k) is not None})
        else:
            fresh.append(o)
    t0, n, hard = time.time(), 0, 0
    for o in [o for o in fresh if o["src"] == "francetravail"][:150]:
        if time.time() > ENRICH_END:
            break
        try:
            j = ft_detail(o["url"].rsplit("/", 1)[-1])
            if j:
                ft_xp(o, j); n += 1; hard += o["xpmin"] > 0
        except Exception:
            pass
        time.sleep(random.uniform(0.3, 0.7))
    for o in [o for o in fresh if o["src"] in ("linkedin", "hellowork")][:150]:
        if time.time() > ENRICH_END:
            break
        u = o["url"]
        if o["src"] == "linkedin":
            m = re.search(r"(\d{8,})", u)
            if not m:
                continue
            u = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}"
        try:
            r = get(u)
            if r.status_code == 200:
                t = page_text(o["src"], r.text)
                if len(t) > 150:
                    xp_set(o, t); n += 1; hard += o["xpmin"] > 0
            elif r.status_code == 429:
                break
        except Exception:
            pass
        time.sleep(random.uniform(0.4, 1.0))
    log(f"Expérience : {len(prior)} annonces déjà lues, {n} nouvelles lues ({hard} avec une expérience exigée), en {time.time() - t0:.0f} s")


# ---------------------------------------------------------------- Orchestration
# Welcome to the Jungle et Apec ne sont pas interrogés : le premier charge ses offres d'une façon
# illisible sans navigateur complet, le second bloque les robots (DataDome). On respecte ces blocages.
SOURCES = ["francetravail", "indeed", "linkedin", "hellowork", "meteojob", "carrieres"]
LABEL = {"francetravail": "France Travail", "indeed": "Indeed", "linkedin": "LinkedIn", "hellowork": "HelloWork",
         "wttj": "Welcome to the Jungle", "apec": "Apec", "meteojob": "Meteojob", "carrieres": "Sites carrières"}
EVERY_H = {"francetravail": 3, "indeed": 3, "linkedin": 4, "hellowork": 3, "wttj": 6, "apec": 6, "meteojob": 6, "carrieres": 6}


def criteria(uid: str) -> dict:
    sg = get_doc(uid, "app", "sugg") or {}
    prof = get_doc(uid, "app", "profil") or {}
    st = ((prof.get("p") or {}).get("set") or {}) if isinstance(prof, dict) else {}
    kws = split_list(sg.get("kw")) or ["supply chain"]
    return {
        "kws": kws, "kwen": split_list(sg.get("kwen")) or kws, "lieux": split_list(sg.get("lieux")),
        "drom": split_list(sg.get("drom")), "etr": split_list(sg.get("etr")), "ent": split_list(sg.get("ent")),
        "zf": sg.get("zf", True), "zd": sg.get("zd", False), "ze": sg.get("ze", False), "zc": sg.get("zc", False),
        "win": int(st.get("win") or 10), "rot": int(time.time() // 3600) % 97,
        "rayon": int(sg.get("rayon") or 30), "ct": sg.get("ct") or ["CDI", "CDD", "Intérim"],
        "critAt": int(sg.get("critAt") or 0),
    }


def save(found: list[dict]) -> int:
    rows, ids = [], set()
    for o in found:
        i = oid(o["url"])
        if i in ids:
            continue
        ids.add(i)
        rows.append({"id": i, "source": o["src"], "data": o, "last_seen": NOW.isoformat()})
    for k in range(0, len(rows), 200):
        rest("POST", "raw_offers?on_conflict=id", headers={"Prefer": "resolution=merge-duplicates,return=minimal"}, data=json.dumps(rows[k:k + 200]))
    return len(rows)


def main():
    uid = user_id()
    C = criteria(uid)
    log(f"Critères : {len(C['kws'])} mots-clés, {len(C['lieux'])} villes, outre-mer={C['zd']}, étranger={C['ze']}, entreprises={C['zc']}, fenêtre {C['win']} j")
    state = get_doc(uid, "ce", "sources") or {}
    for k in [k for k in state if k not in SOURCES and not k.startswith("_")]:
        del state[k]
    last_run = (state.get("_run") or {}).get("at") or 0
    changed = C["critAt"] > last_run
    if changed:
        log("Critères modifiés depuis la dernière recherche : toutes les sources sont interrogées, et les offres récentes seront retriées.")
        try:
            rest("PATCH", "raw_offers?last_seen=gte." + quote((NOW - timedelta(days=C["win"])).isoformat()),
                 headers={"Prefer": "return=minimal"}, data=json.dumps({"evaluated_at": None}))
        except Exception as e:
            log("Remise en tri impossible :", e)
    todo = []
    for s in SOURCES:
        if ONLY and s not in ONLY:
            continue
        st = state.get(s) or {}
        last_ok = st.get("lastOk") or 0
        failed = st.get("ok") is False
        due = (time.time() * 1000 - last_ok) > EVERY_H[s] * 3600e3 * 0.9
        if FORCE or due or failed or changed:
            todo.append(s)
    log("Sources à interroger :", ", ".join(LABEL[s] for s in todo) or "aucune (toutes récentes)")
    total = 0
    for s in todo:
        t0 = time.time()
        log(f"\n== {LABEL[s]}")
        try:
            if s in ("indeed", "linkedin"):
                found = src_jobspy(s, C)
            elif s == "francetravail":
                found = src_francetravail(C)
            elif s == "hellowork":
                found = src_hellowork(C)
            elif s == "meteojob":
                found = src_meteojob(C)
            elif s == "carrieres":
                found = src_careers(C, uid)
            else:
                raise RuntimeError("source inconnue")
            try:
                enrich(found)
            except Exception as e:
                log("  Lecture des annonces incomplète :", str(e)[:150])
            n = save(found)
            total += n
            state[s] = {"ok": True, "n": n, "at": int(time.time() * 1000), "lastOk": int(time.time() * 1000), "err": ""}
            bump("source", s, True)
            log(f"  OK : {n} offres en {time.time() - t0:.0f} s")
        except Exception as e:
            msg = str(e)[:200]
            prev = state.get(s) or {}
            state[s] = {**prev, "ok": False, "at": int(time.time() * 1000), "err": msg}
            bump("source", s, False)
            log(f"  ÉCHEC : {msg}")
            if os.environ.get("DEBUG"):
                traceback.print_exc()
    state["_run"] = {"at": int(time.time() * 1000), "n": total}
    set_doc(uid, "ce", "sources", state)
    # Ménage : offres vues pour la dernière fois il y a plus de 45 jours.
    try:
        rest("DELETE", "raw_offers?last_seen=lt." + quote((NOW - timedelta(days=45)).isoformat()))
    except Exception as e:
        log("Ménage impossible :", e)
    log(f"\nTotal : {total} offres récoltées (avant tri).")


if __name__ == "__main__":
    main()
