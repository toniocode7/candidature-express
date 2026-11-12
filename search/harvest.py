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
          extrait="", cc="FR", web=False) -> dict | None:
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
    return o


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


def jobspy_rows(site: str, term: str, location: str, country: str, hours: int, n: int):
    from jobspy import scrape_jobs
    df = scrape_jobs(site_name=[site], search_term=term, location=location, country_indeed=country,
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
                 str(r.get("description") or "")[:600] if str(r.get("description") or "") != "nan" else "", cc)


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
            rows = jobspy_rows(site, term, loc, country, hours, 25 if site == "indeed" else 15)
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
            url = f"https://candidat.francetravail.fr/offres/recherche?motsCles={quote_plus(kw)}&lieux={code}&rayon=30&tri=1&offresPartenaires=true"
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
            url = f"https://www.hellowork.com/fr-fr/emploi/recherche.html?k={quote_plus(kw)}&l={quote_plus(lieu)}&c=CDI&c=CDD&c=Travail_temp&d=w"
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


CONTRATS = {"FULL_TIME": "Temps plein", "PART_TIME": "Temps partiel", "TEMPORARY": "Intérim", "CONTRACTOR": "CDD",
            "CONTRACT": "CDD", "PERMANENT": "CDI", "INTERN": "Stage", "INTERNSHIP": "Stage", "PER_DIEM": "Vacation", "VOLUNTEER": "Bénévolat"}


def contrat_fr(v) -> str:
    vals = v if isinstance(v, list) else [v or ""]
    out = []
    for x in vals:
        t = CONTRATS.get(str(x).upper(), str(x))
        if t and t not in out:
            out.append(t)
    # « Intérim » ou « CDD » priment sur « Temps plein »
    if len(out) > 1 and "Temps plein" in out:
        out.remove("Temps plein")
    return ", ".join(out)


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
                          contrat_fr(jp.get("employmentType")),
                          "", jp.get("datePosted"), clean(jp.get("description") or "")[:600])
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


# ---------------------------------------------------------------- Orchestration
# Welcome to the Jungle et Apec ne sont pas interrogés : le premier charge ses offres d'une façon
# illisible sans navigateur complet, le second bloque les robots (DataDome). On respecte ces blocages.
SOURCES = ["francetravail", "indeed", "linkedin", "hellowork", "meteojob"]
LABEL = {"francetravail": "France Travail", "indeed": "Indeed", "linkedin": "LinkedIn", "hellowork": "HelloWork",
         "wttj": "Welcome to the Jungle", "apec": "Apec", "meteojob": "Meteojob"}
EVERY_H = {"francetravail": 3, "indeed": 3, "linkedin": 4, "hellowork": 3, "wttj": 6, "apec": 6, "meteojob": 6}


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
    todo = []
    for s in SOURCES:
        if ONLY and s not in ONLY:
            continue
        st = state.get(s) or {}
        last_ok = st.get("lastOk") or 0
        failed = st.get("ok") is False
        due = (time.time() * 1000 - last_ok) > EVERY_H[s] * 3600e3 * 0.9
        if FORCE or due or failed:
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
            else:
                raise RuntimeError("source inconnue")
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
