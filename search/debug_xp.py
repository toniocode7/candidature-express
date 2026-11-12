"""Diagnostic : d'où vient le détail d'une annonce France Travail (composant chargé en JavaScript)."""
import re
import requests
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
r = requests.get("https://candidat.francetravail.fr/offres/recherche?motsCles=acheteur&lieux=29019&rayon=30&tri=1", headers={"User-Agent": UA}, timeout=30)
ids = re.findall(r'data-id-offre="([^"]+)"', r.text)[:3]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(user_agent=UA, locale="fr-FR")
    calls = []
    pg.on("response", lambda resp: calls.append((resp.status, resp.request.resource_type, resp.url, resp.headers.get("content-type", ""))) if resp.request.resource_type in ("xhr", "fetch") else None)
    for i in ids:
        calls.clear()
        pg.goto(f"https://candidat.francetravail.fr/offres/recherche/detail/{i}", wait_until="networkidle", timeout=60000)
        t = pg.inner_text("body")
        print("\n### FT", i, len(t))
        for c in calls:
            print("  XHR", c)
        for m in list(re.finditer(r"xp[ée]rience", t, re.I))[:5]:
            print("   …", re.sub(r"\s+", " ", t[max(0, m.start() - 150):m.end() + 150]))
    b.close()
