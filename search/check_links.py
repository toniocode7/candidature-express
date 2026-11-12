"""Vérifie que le lien de chaque offre suggérée mène bien à cette offre.
Compare l'intitulé et l'entreprise enregistrés avec ceux de la page publique de l'annonce."""
import os
import re
import sys
import time
import unicodedata

import requests

sys.path.insert(0, os.path.dirname(__file__))
from harvest import UA, clean, get_doc, norm, user_id  # noqa: E402


def words(s):
    return {w for w in norm(s).split() if len(w) > 2}


def page_title(url):
    m = re.search(r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d{6,})", url)
    if m:
        r = requests.get(f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}", headers={"User-Agent": UA}, timeout=20)
        t = re.search(r'<h2[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)</h2>', r.text)
        c = re.search(r'<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)</a>', r.text)
        return r.status_code, clean(t.group(1)) if t else "", clean(c.group(1)) if c else ""
    r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR"}, timeout=20, allow_redirects=True)
    t = re.search(r"<title[^>]*>([\s\S]*?)</title>", r.text)
    return r.status_code, clean(t.group(1)) if t else "", ""


def main():
    uid = user_id()
    sg = get_doc(uid, "app", "sugg") or {}
    items = sg.get("items") or []
    print(f"{len(items)} offres suggérées à vérifier")
    bad = ok = unk = 0
    for x in items:
        url = x.get("url") or ""
        try:
            st, t, c = page_title(url)
        except Exception as e:
            print(f"  ? {x.get('titre')} : page illisible ({str(e)[:60]})"); unk += 1; continue
        if not t or "authenticat" in t.lower():
            unk += 1
            print(f"  ? {x.get('titre')} | {x.get('site')} : titre de page introuvable (HTTP {st})")
            continue
        common = words(x.get("titre", "")) & words(t)
        good = len(common) >= max(1, min(2, len(words(x.get("titre", ""))) // 2))
        if good:
            ok += 1
        else:
            bad += 1
            print(f"  ✗ ENREGISTRÉ : {x.get('titre')} — {x.get('entreprise')} ({x.get('lieu')}) via {x.get('site')}")
            print(f"    PAGE       : {t} — {c}   [{url}]")
        time.sleep(1)
    print(f"\nRésultat : {ok} liens corrects, {bad} liens vers une autre offre, {unk} non vérifiables")


if __name__ == "__main__":
    main()
