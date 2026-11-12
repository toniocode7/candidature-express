"""Diagnostic : comment chaque site écrit l'expérience demandée sur la page d'une annonce."""
import re
import html as H
import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})


def txt(h):
    h = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", h)
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " | ", h)))


def snip(name, url, h):
    t = txt(h)
    print(f"\n### {name} {url} ({len(h)} car.)")
    for m in list(re.finditer(r"exp[ée]rience|experience|exig|ann[ée]es? d|\bans? d", t, re.I))[:8]:
        print("  …", t[max(0, m.start() - 140):m.end() + 140].strip(), "…")
    for m in re.finditer(r'<[^>]*(experience|exp[ée]rience)[^>]*>[\s\S]{0,300}', h, re.I):
        print("  [balise]", re.sub(r"\s+", " ", m.group(0))[:300]); break


r = S.get("https://candidat.francetravail.fr/offres/recherche?motsCles=supply+chain&lieux=29019&rayon=30&tri=1", timeout=30)
for i in re.findall(r'data-id-offre="([^"]+)"', r.text)[:3]:
    u = f"https://candidat.francetravail.fr/offres/recherche/detail/{i}"
    h = S.get(u, timeout=30).text
    print("\n### FT", u, len(h))
    for k in ("itemprop", "skill", "Exp", "exp&", "experience", "description"):
        for m in list(re.finditer(k, h))[:3]:
            print(f"  [{k}]", re.sub(r"\s+", " ", h[max(0, m.start() - 120):m.start() + 250]))
    t = txt(h)
    j = t.find("Profil")
    print("  TEXTE:", t[:200], "...", t[j:j + 900] if j >= 0 else "")
