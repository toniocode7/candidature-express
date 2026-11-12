"""Diagnostic : quelles plateformes de recrutement répondent pour de grandes entreprises françaises (statut et nombre d'offres)."""
import itertools
import requests

UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json", "Content-Type": "application/json"}
COS = {"thales": ["thales"], "airbus": ["ag", "airbus"], "safran": ["safran", "safrangroup"], "navalgroup": ["navalgroup", "naval-group", "naval"],
       "dassault": ["dassaultaviation", "dassault", "dassault-aviation"], "mbda": ["mbda", "mbdasystems"], "lvmh": ["lvmh"], "renault": ["renault", "alliance"],
       "stellantis": ["stellantis"], "michelin": ["michelin"], "decathlon": ["decathlon"], "schneider": ["schneiderelectric", "se"], "sanofi": ["sanofi"]}
SITES = ["Careers", "External", "careers", "jobs", "Jobs", "External_Careers", "Search"]
for co, slugs in COS.items():
    hits = []
    for s in slugs:
        for wd, site in itertools.product(["wd1", "wd3", "wd5", "wd103"], SITES + [s, s.capitalize(), s.upper()]):
            try:
                r = requests.post(f"https://{s}.{wd}.myworkdayjobs.com/wday/cxs/{s}/{site}/jobs", json={"limit": 1, "offset": 0, "searchText": ""}, headers=UA, timeout=8)
                if r.status_code == 200 and "total" in r.text:
                    hits.append(f"workday {s}.{wd}/{site} total={r.json().get('total')}"); break
            except Exception:
                pass
        for name, url in [("smartrecruiters", f"https://api.smartrecruiters.com/v1/companies/{s}/postings?limit=1"),
                          ("lever", f"https://api.lever.co/v0/postings/{s}?mode=json&limit=1"),
                          ("greenhouse", f"https://boards-api.greenhouse.io/v1/boards/{s}/jobs"),
                          ("recruitee", f"https://{s}.recruitee.com/api/offers/")]:
            try:
                r = requests.get(url, headers=UA, timeout=8)
                if r.status_code == 200:
                    j = r.json()
                    n = j.get("totalFound") if isinstance(j, dict) and "totalFound" in j else len(j) if isinstance(j, list) else len(j.get("jobs") or j.get("offers") or [])
                    if n:
                        hits.append(f"{name} {s} n={n}")
            except Exception:
                pass
    print(co, "=>", hits or "rien")
