"""Diagnostic : lecture des sites carrières de grandes entreprises (Workday, Talentsoft, Gestmax, pages simples)."""
import re
import html as H
import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
S = requests.Session(); S.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})


def show(name, r, pat=None):
    print(f"\n### {name} : HTTP {r.status_code}, {len(r.text)} car., type {r.headers.get('content-type')}")
    if pat:
        found = list(dict.fromkeys(re.findall(pat, r.text)))
        print("   ", len(found), "liens ; exemples :", found[:6])


for t, wd, site in [("thales", "wd3", "Careers"), ("ag", "wd3", "Airbus")]:
    r = S.post(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs", json={"limit": 5, "offset": 0, "searchText": "supply chain", "appliedFacets": {}},
               headers={"Accept": "application/json", "Content-Type": "application/json"}, timeout=30)
    print(f"\n### Workday {t} : HTTP {r.status_code}", r.text[:300] if r.status_code != 200 else f"total={r.json().get('total')} ex={[(j.get('title'), j.get('locationsText'), j.get('postedOn')) for j in r.json().get('jobPostings', [])[:3]]}")
for host in ["dassault-aviation-cand.talent-soft.com", "careers.safran-group.com"]:
    r = S.get(f"https://{host}/handlers/offerRss.ashx?LCID=1036", timeout=30)
    items = re.findall(r"<item>([\s\S]*?)</item>", r.text)
    print(f"\n### Talentsoft {host} : HTTP {r.status_code}, {len(items)} offres")
    for it in items[:2]:
        print("   ", re.sub(r"\s+", " ", H.unescape(it))[:600])
r = S.get("https://mbda.gestmax.fr/", timeout=30); show("Gestmax MBDA accueil", r, r'href="([^"]*(?:search|offre|vacancy|rss|feed)[^"]*)"')
for u in ["https://mbda.gestmax.fr/search", "https://mbda.gestmax.fr/rss", "https://mbda.gestmax.fr/feed/rss"]:
    r = S.get(u, timeout=30); show(u, r, r'href="(https://mbda\.gestmax\.fr/\d+/[^"]+)"')
r = S.get("https://www.naval-group.com/fr/nous-rejoindre", timeout=30); show("Naval Group", r, r'href="(/fr/nous-rejoindre/[^"?#]+)"')
r = S.get("https://www.naval-group.com/fr/nous-rejoindre?search_api_fulltext=achat", timeout=30); show("Naval Group recherche", r, r'href="(/fr/nous-rejoindre/[^"?#]+)"')
r = S.get("https://www.safran-group.com/fr/offres?search=achat", timeout=30); show("Safran site", r, r'href="(/fr/offres/[^"?#]+-\d+)"')
r = S.get("https://www.lvmh.com/en/join-us/our-job-offers", timeout=30); show("LVMH", r, r'href="(/en/join-us/our-job-offers/[A-Z0-9]+)"')
