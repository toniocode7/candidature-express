"""Rappels d'entretien (la veille et le jour) et objectif de la semaine.
Lancé à chaque passage de la recherche automatique (toutes les heures de 6 h à 22 h).
Chaque rappel n'est envoyé qu'une fois (journal notif_log côté serveur)."""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

SB_URL = f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co"
SB_KEY = os.environ["SUPABASE_SECRET_KEY"]
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}
PARIS = ZoneInfo("Europe/Paris")
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def push(kind, title, body, once, url="./?v=list"):
    r = requests.post(f"{SB_URL}/functions/v1/push", headers={"x-ce-key": SB_KEY, "Content-Type": "application/json"},
                      json={"action": "send", "kind": kind, "title": title, "body": body, "url": url, "once": once}, timeout=60)
    print(f"« {title} » :", r.json())


def docs(q):
    r = requests.get(f"{SB_URL}/rest/v1/docs?{q}", headers=H, timeout=60)
    r.raise_for_status()
    return [x["data"] for x in r.json()]


def label(o):
    a, m, g = o.get("an") or {}, o.get("meta") or {}, o.get("sug") or {}
    poste = a.get("poste") or m.get("poste") or g.get("titre") or "un poste"
    ent = a.get("entreprise") or m.get("entreprise") or g.get("entreprise") or ""
    return poste + (f" chez {ent}" if ent else "")


def main():
    now = datetime.now(PARIS)
    offers = docs("select=data&col=eq.app&id=like.o_*")
    # Rappels d'entretien
    for o in offers:
        iv = o.get("iv") or {}
        if not iv.get("at") or o.get("ir"):
            continue
        at = datetime.fromtimestamp(iv["at"] / 1000, PARIS)
        if at < now:
            continue
        heure = "" if iv.get("noh") else f" à {at.hour} h {at.minute:02d}"
        fmt = f" ({iv['kind']})" if iv.get("kind") else ""
        lieu = f" · {iv['loc']}" if iv.get("loc") else ""
        if at.date() == (now + timedelta(days=1)).date() and now.hour >= 18:
            push("entretien", "Entretien demain", f"Demain{heure} : {label(o)}{fmt}{lieu}. Pense à relire ta préparation.", f"iv-veille:{o['id']}:{iv['at']}")
        if at.date() == now.date() and now.hour >= 7:
            push("entretien", "Entretien aujourd'hui", f"Aujourd'hui{heure} : {label(o)}{fmt}{lieu}. Bonne chance !", f"iv-jour:{o['id']}:{iv['at']}")
    # Objectif de la semaine : vendredi et dimanche à partir de 17 h
    if now.weekday() in (4, 6) and now.hour >= 17:
        prof = (docs("select=data&col=eq.app&id=eq.profil") or [{}])[0]
        goal = int(((prof.get("p") or {}).get("set") or {}).get("goal") or 0)
        if goal:
            monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            sent = sum(1 for o in offers if (o.get("st") or 0) >= 1 and o.get("st") != 0 and (o.get("sentAt") or 0) >= monday.timestamp() * 1000)
            if sent < goal:
                reste = goal - sent
                quand = "d'ici dimanche soir" if now.weekday() == 4 else "ce soir"
                push("objectif", f"Objectif de la semaine : {sent}/{goal}",
                     f"Encore {reste} candidature{'s' if reste > 1 else ''} {quand} pour l'atteindre. Les offres suggérées t'attendent.",
                     f"goal:{monday.date()}:{JOURS[now.weekday()]}", "./?v=sugg")
            else:
                print(f"Objectif atteint : {sent}/{goal}")


if __name__ == "__main__":
    main()
