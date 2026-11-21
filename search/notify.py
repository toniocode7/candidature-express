"""Rappels d'entretien (la veille et le jour) et objectif de la semaine.
Lancé chaque heure par l'horloge de Supabase (action « Rappels et alertes »).
Chaque rappel n'est envoyé qu'une fois (journal notif_log côté serveur)."""
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from urllib.parse import quote

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


def light_offers():
    """Seulement les champs utiles aux rappels (pas le texte des annonces ni les analyses) : peu de données transférées."""
    f = ("id:data->>id,st:data->st,ir:data->ir,iv:data->iv,sentAt:data->sentAt,hist:data->hist,autoRef:data->autoRef,"
         "ap:data->an->>poste,ae:data->an->>entreprise,mp:data->meta->>poste,me:data->meta->>entreprise,gp:data->sug->>titre,ge:data->sug->>entreprise,gs:data->sug->>src")
    r = requests.get(f"{SB_URL}/rest/v1/docs?select={f}&col=eq.app&id=like.o_*", headers=H, timeout=60)
    r.raise_for_status()
    out = []
    for x in r.json():
        x["an"] = {"poste": x.pop("ap", None), "entreprise": x.pop("ae", None)}
        x["meta"] = {"poste": x.pop("mp", None), "entreprise": x.pop("me", None)}
        x["sug"] = {"titre": x.pop("gp", None), "entreprise": x.pop("ge", None), "src": x.pop("gs", None)}
        out.append(x)
    return out


def label(o):
    a, m, g = o.get("an") or {}, o.get("meta") or {}, o.get("sug") or {}
    poste = a.get("poste") or m.get("poste") or g.get("titre") or "un poste"
    ent = a.get("entreprise") or m.get("entreprise") or g.get("entreprise") or ""
    return poste + (f" chez {ent}" if ent else "")


def main():
    now = datetime.now(PARIS)
    offers = light_offers()
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

    bilan(now, offers)
    sante(now)


def bilan(now, offers):
    """Bilan de la semaine, le dimanche à partir de 18 h."""
    if now.weekday() != 6 or now.hour < 18:
        return
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    t0, nms = monday.timestamp() * 1000, now.timestamp() * 1000
    sent = sum(1 for o in offers if (o.get("st") or 0) >= 1 and (o.get("sentAt") or 0) >= t0)
    rep = itv = ref = 0
    for o in offers:
        h = [e for e in (o.get("hist") or []) if isinstance(e, dict) and (e.get("t") or 0) >= t0]
        if any(e.get("s") == 2 for e in h):
            itv += 1
        elif any(e.get("s") == 4 for e in h):
            rep += 1
        elif any(e.get("s") == 3 for e in h) and not o.get("autoRef"):
            ref += 1
    venir = sum(1 for o in offers if (o.get("iv") or {}).get("at") and nms < o["iv"]["at"] < nms + 7 * 864e5 and not o.get("ir"))
    relance = sum(1 for o in offers if o.get("st") == 1 and nms - 30 * 864e5 < (o.get("sentAt") or 0) < nms - 7 * 864e5)
    sg = (docs("select=data&col=eq.app&id=eq.sugg") or [{}])[0]
    top = sum(1 for x in (sg.get("items") or []) if (x.get("pertinence") or 0) >= 80 and (x.get("fd") or 0) >= t0)
    parts = []
    reponses = itv + rep + ref
    parts.append(f"{reponses} réponse{'s' if reponses > 1 else ''} reçue{'s' if reponses > 1 else ''}"
                 + (f" ({', '.join(x for x in [f'{itv} entretien' + ('s' if itv > 1 else '') if itv else '', f'{rep} premier' + ('s' if rep > 1 else '') + ' contact' + ('s' if rep > 1 else '') if rep else '', f'{ref} refus' if ref else ''] if x)})" if reponses else ""))
    if venir:
        parts.append(f"{venir} entretien{'s' if venir > 1 else ''} dans les 7 jours")
    if relance:
        parts.append(f"{relance} candidature{'s' if relance > 1 else ''} sans réponse depuis plus d'une semaine, à relancer")
    if top:
        parts.append(f"{top} offre{'s' if top > 1 else ''} notée{'s' if top > 1 else ''} 80 ou plus repérée{'s' if top > 1 else ''} cette semaine")
    push("bilan", f"Ta semaine : {sent} candidature{'s' if sent > 1 else ''} envoyée{'s' if sent > 1 else ''}", " · ".join(parts) + ".",
         f"bilan:{monday.date()}", "./?v=stats")
    sources(now, offers, monday)


def found_count(src, since):
    """Nombre d'offres récoltées sur une source depuis une date (compté par la base, rien n'est téléchargé)."""
    r = requests.head(f"{SB_URL}/rest/v1/raw_offers?select=id&source=eq.{src}&first_seen=gte.{since.isoformat()}",
                      headers={**H, "Prefer": "count=exact", "Range": "0-0"}, timeout=60)
    try:
        return int(r.headers.get("content-range", "*/0").split("/")[-1])
    except ValueError:
        return 0


def source_score(offers, since_ms, counts):
    """Par source, sur la période : offres récoltées, candidatures envoyées, réponses (entretien, contact, refus manuel)."""
    out = []
    for k, lab in LABELS.items():
        sent = [o for o in offers if (o.get("sug") or {}).get("src") == k and (o.get("st") or 0) >= 1 and (o.get("sentAt") or 0) >= since_ms]
        rep = sum(1 for o in sent if o.get("st") in (2, 4) or (o.get("st") == 3 and not o.get("autoRef"))
                  or any(isinstance(e, dict) and e.get("s") in (2, 4) for e in (o.get("hist") or [])))
        if counts.get(k) or sent:
            out.append({"k": k, "lab": lab, "found": counts.get(k, 0), "sent": len(sent), "rep": rep})
    out.sort(key=lambda x: (-x["rep"], -x["sent"], -x["found"]))
    return out


def sources(now, offers, monday):
    """Bilan d'efficacité des sources (4 semaines glissantes), envoyé avec le bilan du dimanche. Aucune source n'est coupée :
    c'est une information pour décider, pas une action automatique."""
    since = now - timedelta(days=28)
    sc = source_score(offers, since.timestamp() * 1000, {k: found_count(k, since) for k in LABELS})
    if not sc:
        return
    parts = [f"{x['lab']} : {x['found']} trouvée{'s' if x['found'] > 1 else ''}, {x['sent']} envoyée{'s' if x['sent'] > 1 else ''}"
             + (f", {x['rep']} réponse{'s' if x['rep'] > 1 else ''}" if x["rep"] else "") for x in sc]
    vides = [x["lab"] for x in sc if x["found"] >= 30 and not x["sent"]]
    if vides:
        parts.append(f"Aucune candidature venue de {', '.join(vides)} : {'ces sources ne t’apportent' if len(vides) > 1 else 'cette source ne t’apporte'} rien d'utile pour l'instant")
    push("bilan", "Tes sources sur 4 semaines", " · ".join(parts) + ".", f"sources:{monday.date()}", "./?v=stats")


LABELS = {"francetravail": "France Travail", "indeed": "Indeed", "linkedin": "LinkedIn", "hellowork": "HelloWork",
          "meteojob": "Meteojob", "carrieres": "Sites carrières"}


def rows(q):
    r = requests.get(f"{SB_URL}/rest/v1/{q}", headers=H, timeout=60)
    r.raise_for_status()
    return r.json()


def sante(now):
    """Surveillance : prévient (une fois par jour et par problème) quand une automatisation s'arrête en silence."""
    if now.hour < 9 or now.hour > 21:
        return
    jour, t = now.date().isoformat(), now.timestamp() * 1000
    alertes = []
    st = (docs("select=data&col=eq.ce&id=eq.sources") or [{}])[0]
    for k, lab in LABELS.items():
        x = st.get(k) or {}
        if x and x.get("ok") is False and t - (x.get("lastOk") or 0) > 24 * 3600e3:
            alertes.append((f"src-{k}", f"{lab} ne répond plus depuis plus de 24 h",
                            f"Erreur : {str(x.get('err') or '')[:90]}. Les autres sites continuent ; nouvel essai à chaque recherche."))
    run = (st.get("_run") or {}).get("at") or 0
    if run and t - run > 7 * 3600e3:
        alertes.append(("recherche", "La recherche automatique ne tourne plus",
                        "Aucun passage depuis plus de 7 h (elle tourne à 0 h, 6 h, 12 h et 18 h). Ouvre GitHub, onglet Actions : la recherche a peut-être été désactivée."))
    depuis = (now - timedelta(days=2)).date().isoformat()
    u = rows(f"usage?select=provider,model,ok,fail&day=gte.{depuis}")
    if not any(x["provider"] == "gmail" for x in u):
        alertes.append(("gmail", "Le script Gmail ne transmet plus tes mails",
                        "Rien reçu depuis 2 jours. Ouvre script.google.com, projet Candidature Express Gmail, et relance « installer »."))
    today = [x for x in u if x["provider"] in ("gemini", "groq")]
    ok, ko = sum(x["ok"] for x in today), sum(x["fail"] for x in today)
    if ko >= 15 and ok == 0:
        alertes.append(("ia", "Les IA gratuites échouent en ce moment",
                        "Aucune réponse réussie depuis 2 jours. Les analyses et le tri reprendront dès leur retour ; « Envoyer à Claude » marche toujours."))
    backup = rows("usage?select=day&provider=eq.sauvegarde&order=day.desc&limit=1")
    if backup and (now.date() - datetime.fromisoformat(backup[0]["day"]).date()).days > 8:
        alertes.append(("sauvegarde", "La sauvegarde du dimanche n'a pas eu lieu",
                        "Ouvre script.google.com, fichier Sauvegarde, et relance « installerSauvegarde »."))
    try:
        size = requests.post(f"{SB_URL}/rest/v1/rpc/ce_db_size", headers={**H, "Content-Type": "application/json"}, data="{}", timeout=30).json()
        mo = round((size.get("total") or 0) / 1e6)
        if mo > 400:
            alertes.append(("espace", f"La base approche de sa limite gratuite ({mo} Mo sur 500)",
                            "Transmets cette alerte à Claude : il faudra alléger les données gardées."))
    except Exception:
        pass
    alertes += erreurs(now)
    alertes += lenteur(now)
    for key, titre, corps in alertes:
        push("alerte", titre, corps, f"alerte:{key}:{jour}", "./?v=accueil")
    if not alertes:
        print("Surveillance : tout fonctionne.")


def lenteur(now):
    """App nettement plus lente à s'ouvrir ces 3 derniers jours que les 2 semaines d'avant (par appareil),
    ou plus de 4 s en moyenne : alerte, à transmettre à Claude (alléger les listes, etc.)."""
    try:
        r = rows(f"app_perf?select=day,dev,n,open_sum,exec_sum,cands&day=gte.{(now - timedelta(days=17)).date().isoformat()}")
    except Exception as x:
        print("Mesures de vitesse illisibles :", str(x)[:80])
        return []
    out = []
    lim = (now - timedelta(days=3)).date().isoformat()
    for dev in sorted({x["dev"] for x in r}):
        rec = [x for x in r if x["dev"] == dev and x["day"] >= lim]
        old = [x for x in r if x["dev"] == dev and x["day"] < lim]
        rn, on = sum(x["n"] for x in rec), sum(x["n"] for x in old)
        if rn < 3:
            continue
        ra = sum(x["open_sum"] for x in rec) / rn
        oa = sum(x["open_sum"] for x in old) / on if on >= 5 else None
        ex = sum(x["exec_sum"] for x in rec) / rn
        cands = max(x["cands"] for x in rec)
        s = lambda ms: f"{ms / 1000:.1f}".replace(".", ",") + " s"  # noqa: E731
        print(f"Vitesse {dev} : {s(ra)} en moyenne sur 3 jours" + (f" (avant : {s(oa)})" if oa else "") + f", dont affichage {s(ex)}")
        if ra > 4000 or (oa and ra > 2500 and ra > 1.5 * oa):
            out.append((f"lenteur-{dev}", f"L'app ralentit sur ton {dev}",
                        f"Ouverture en {s(ra)} en moyenne ces 3 derniers jours" + (f", contre {s(oa)} avant" if oa else "")
                        + f" ({cands} candidatures). Transmets cette alerte à Claude : il allégera l'affichage."))
    return out


def erreurs(now):
    """Erreurs de l'app des dernières 24 h (table app_errors) : alerte dès qu'une erreur se répète (3 fois ou plus),
    ou que plusieurs erreurs différentes apparaissent. Le détail n'est jamais écrit dans le journal public de GitHub."""
    since = (now - timedelta(hours=24)).isoformat()
    try:
        e = rows(f"app_errors?select=msg,src,n&last=gte.{quote(since)}&order=n.desc&limit=20")
    except Exception as x:
        print("Journal des erreurs illisible :", str(x)[:80])
        return []
    total = sum(x["n"] for x in e)
    print(f"Erreurs de l'app sur 24 h : {len(e)} différente(s), {total} au total.")
    if not e or (e[0]["n"] < 3 and len(e) < 2):
        return []
    top = e[0]
    autres = f" (et {len(e) - 1} autre{'s' if len(e) > 2 else ''})" if len(e) > 1 else ""
    return [("erreurs", "L'app a rencontré une erreur",
             f"« {top['msg'][:110]} », {top['n']} fois en 24 h{autres}. Le détail est dans Réglages > Aide > Erreurs techniques : "
             "fais-en une capture à Claude pour qu'il corrige.")]


if __name__ == "__main__":
    main()
