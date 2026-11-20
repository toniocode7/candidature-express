"""Diagnostic : page de résultats France Travail (statut, taille, marqueurs connus)."""
import re
import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
for u in ["https://candidat.francetravail.fr/offres/recherche?motsCles=supply+chain&lieux=29019&rayon=30&tri=1&offresPartenaires=true&typeContrat=CDI,CDD,MIS",
          "https://candidat.francetravail.fr/offres/recherche?motsCles=supply+chain&lieux=29019&rayon=30&tri=1"]:
    r = requests.get(u, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9", "Accept": "text/html"}, timeout=30)
    t = r.text
    print("\n", r.status_code, len(t), r.url[:140])
    print("  data-id-offre :", len(re.findall(r'data-id-offre="', t)), "| media-heading :", t.count("media-heading-title"), "| captcha :", bool(re.search(r"captcha|datadome|cf-chl|Access denied", t, re.I)))
    print("  titre :", (re.search(r"<title[^>]*>([\s\S]*?)</title>", t) or [None, ""])[1].strip()[:120])
    for m in list(re.finditer(r"offre|résultat|resultat", t))[:0]:
        pass
    i = t.find("<main"); print("  extrait :", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t[i:i + 3000] if i >= 0 else t[:1500]))[:600])
