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
for i in re.findall(r'data-id-offre="([^"]+)"', r.text)[:4]:
    u = f"https://candidat.francetravail.fr/offres/recherche/detail/{i}"
    snip("FT", u, S.get(u, timeout=30).text)
r = S.get("https://www.hellowork.com/fr-fr/emploi/recherche.html?k=acheteur&l=Brest", timeout=30)
for i in list(dict.fromkeys(re.findall(r'/fr-fr/emplois/(\d+)\.html', r.text)))[:4]:
    u = f"https://www.hellowork.com/fr-fr/emplois/{i}.html"
    snip("HW", u, S.get(u, timeout=30).text)
r = S.get("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=supply%20chain&location=Bretagne&start=0", timeout=30)
for i in list(dict.fromkeys(re.findall(r'jobs/view/[^"?]*?-(\d{8,})', r.text)))[:4]:
    u = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{i}"
    rr = S.get(u, timeout=30)
    print("LI statut", rr.status_code)
    snip("LI", u, rr.text)
