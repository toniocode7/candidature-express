"""Répare les offres suggérées dont l'intitulé ne correspond plus à leur lien.

Compare chaque suggestion à l'offre brute récoltée pour la même adresse. En cas de
désaccord, la suggestion est retirée et l'offre brute est remise en attente de tri :
elle sera retriée correctement au prochain passage de la recherche automatique."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from harvest import get_doc, norm, oid, rest, set_doc, user_id  # noqa: E402


def sim(a, b):
    A = [w for w in norm(a).split() if len(w) > 2]
    B = " " + norm(b) + " "
    return sum(1 for w in A if f" {w} " in B) / len(A) if A else 0


def main():
    uid = user_id()
    sg = get_doc(uid, "app", "sugg") or {}
    items = sg.get("items") or []
    keep, bad = [], []
    for x in items:
        raw = rest("GET", f"raw_offers?select=id,data&id=eq.{oid(x.get('url', ''))}")
        if raw:
            r = raw[0]["data"]
            ref = f"{r.get('otitre', '')} {r.get('titre', '')} {r.get('extrait', '') if r.get('web') else ''}"
            if max(sim(x.get("titre", ""), ref), sim(r.get("titre", ""), x.get("titre", ""))) < 0.5:
                bad.append((x, raw[0]["id"], r))
                continue
        keep.append(x)
    for x, rid, r in bad:
        print(f"  retirée : « {x.get('titre')} » ({x.get('entreprise')}) — le lien menait à « {r.get('titre')} » ({r.get('entreprise')})")
        rest("PATCH", f"raw_offers?id=eq.{rid}", headers={"Prefer": "return=minimal"}, data=json.dumps({"evaluated_at": None}))
    if bad:
        sg["items"] = keep
        sg["mt"] = int(time.time() * 1000)
        set_doc(uid, "app", "sugg", sg)
    print(f"\n{len(items)} suggestions vérifiées : {len(bad)} retirées et remises en tri, {len(keep)} conservées.")


if __name__ == "__main__":
    main()
