"""Diagnostic : contenu du détail d'une annonce France Travail (api-descriptifoffre)."""
import json
import re
import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
r = requests.get("https://candidat.francetravail.fr/offres/recherche?motsCles=acheteur&lieux=29019&rayon=30&tri=1", headers={"User-Agent": UA}, timeout=30)
for i in re.findall(r'data-id-offre="([^"]+)"', r.text)[:4]:
    rr = requests.get(f"https://candidat.francetravail.fr/api-descriptifoffre/offre/{i}", headers={"User-Agent": UA, "Accept": "application/json",
                      "Referer": f"https://candidat.francetravail.fr/offres/recherche/detail/{i}"}, timeout=30)
    print("\n###", i, rr.status_code, len(rr.text))
    try:
        j = rr.json()
    except Exception:
        print(rr.text[:300]); continue
    print("clés :", list(j.keys()) if isinstance(j, dict) else type(j))
    s = json.dumps(j, ensure_ascii=False)
    for m in list(re.finditer(r"xp[ée]rience", s, re.I))[:6]:
        print("   …", s[max(0, m.start() - 200):m.end() + 200])
