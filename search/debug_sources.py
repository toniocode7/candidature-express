"""Diagnostic d'une source qui ne remonte plus d'offres : montre la structure de la page reçue.
Usage : python search/debug_sources.py francetravail|wttj|meteojob|apec
"""
import asyncio
import re
import sys

import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
URLS = {
    "francetravail": "https://candidat.francetravail.fr/offres/recherche?motsCles=supply+chain&lieux=29019&rayon=30&tri=1",
    "wttj": "https://www.welcometothejungle.com/fr/jobs?query=supply%20chain&aroundQuery=Brest",
    "meteojob": "https://www.meteojob.com/jobsearch/offers?what=supply%20chain&where=Brest",
    "apec": "https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=supply%20chain&lieux=Brest",
}


def show(name, html):
    print(f"--- {name} : {len(html)} caractères")
    hrefs = re.findall(r'href="([^"]+)"', html)
    print("liens :", len(hrefs))
    pats = {}
    for h in hrefs:
        k = re.sub(r"\d+", "9", re.sub(r"[?#].*", "", h))[:70]
        pats[k] = pats.get(k, 0) + 1
    for k, v in sorted(pats.items(), key=lambda x: -x[1])[:25]:
        print(f"  {v:4}  {k}")
    for kw in ("detail", "offre", "/jobs/", "data-id", "__NEXT_DATA__", "application/ld+json", "JobPosting", "algolia"):
        i = html.find(kw)
        print(f"« {kw} » : {html.count(kw)} fois" + (f" ; contexte : {html[max(0,i-150):i+250]!r}" if i >= 0 and kw in ('detail', 'data-id', '/jobs/') else ""))


async def rendered(url, wait):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    async with AsyncWebCrawler(config=BrowserConfig(headless=True, user_agent=UA, verbose=False)) as c:
        r = await c.arun(url=url, config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=40000, wait_until=wait, delay_before_return_html=4.0, scan_full_page=True))
        return r.html or ""


for name in sys.argv[1:]:
    url = URLS[name]
    try:
        r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"}, timeout=30)
        print(f"\n===== {name} (lecture directe) HTTP {r.status_code}")
        show(name, r.text)
    except Exception as e:
        print(name, "lecture directe impossible", e)
    try:
        h = asyncio.run(rendered(url, "domcontentloaded"))
        print(f"\n===== {name} (navigateur)")
        show(name, h)
    except Exception as e:
        print(name, "rendu impossible", str(e)[:300])
