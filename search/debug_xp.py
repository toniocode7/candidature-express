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
ids = re.findall(r'data-id-offre="([^"]+)"', r.text)[:2]
h = S.get(f"https://candidat.francetravail.fr/offres/recherche/detail/{ids[0]}", timeout=30).text
print("liens detail/ajax :", sorted(set(re.findall(r'["\'](/[^"\']*(?:detail|ajax|offre)[^"\']*)["\']', h)))[:40])
print("modal :", [re.sub(r"\s+", " ", h[m.start():m.start()+300]) for m in re.finditer(r'modal-details|id="detailOffre|offre-detail', h)][:3])
for u in [f"https://candidat.francetravail.fr/offres/emploi/detail/{ids[0]}", f"https://candidat.francetravail.fr/offres/recherche/detail/{ids[0]}?isFromRecherche=false",
          f"https://candidat.francetravail.fr/offres/recherche.detailoffre:afficherdetailoffre/{ids[0]}", f"https://candidat.francetravail.fr/offres/recherche/detail/{ids[0]}?t:ac=1"]:
    rr = S.get(u, timeout=30, headers={"X-Requested-With": "XMLHttpRequest"})
    t = txt(rr.text)
    k = [m.start() for m in re.finditer(r"xp[ée]rience", t)]
    print("\n==", u, rr.status_code, len(rr.text), "| exp:", len(k))
    for a in k[:4]: print("   …", t[max(0,a-150):a+150])
