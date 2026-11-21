"""Tests de la recherche automatique : expérience, lieux, métiers, détail France Travail. Sans réseau."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "search"))
os.environ.setdefault("SUPABASE_PROJECT_REF", "test")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test")
import harvest as h  # noqa: E402
from xp import scan  # noqa: E402

fails = 0


def eq(label, got, want):
    global fails
    if got != want:
        fails += 1
        print("ÉCHEC", label, "→ obtenu", got, "attendu", want)


eq("exigée", scan("Vous justifiez d'au moins 7 ans d'expérience.")["hard"], 7)
eq("souhaitée", scan("Idéalement 5 ans d'expérience.")["hard"], 0)
eq("âge ignoré", scan("Avoir moins de 30 ans à la signature du contrat.")["hard"], 0)
C = {"kws": ["supply chain", "achats", "approvisionnement"], "kwen": ["procurement"], "etr": ["Canada"], "ze": True, "win": 10}
eq("France sans pays", h.place_ok("Brest", "", C), True)
eq("États-Unis écartés", h.place_ok("Houston, TX", "US", C), False)
eq("adresse américaine écartée", h.place_ok("12810 State Ave Marysville, WA 98271", "", C), False)
eq("pays choisi gardé", h.place_ok("Montreal, Canada", "", C), True)
eq("métier recherché", h.want("Acheteur projets H/F", C), True)
eq("métier hors sujet", h.want("Senior Software Engineer", C), False)
o = {}
h.ft_xp(o, {"descriptif": "", "experienceProfil": {"experience": "5 An(s)", "estUneExperienceIndispensable": True}, "salaire": {"libelle": "32 - 48 k€ brut annuel"}})
eq("France Travail : expérience indispensable", o.get("xpmin"), 5)
eq("France Travail : salaire repris", o.get("salaire"), "32 - 48 k€ brut annuel")
eq("entreprise connue (Workday)", (h.known_ats("Thales") or {}).get("ats"), "workday")
import json  # noqa: E402
ref = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "fp_ref.json")))
eq("empreinte identique à l'app", h.fp_of(ref["text"]), ref["fp"])
# Récolte en parallèle : chaque source tourne dans son fil, garde son journal, une panne n'arrête pas les autres.
import logging  # noqa: E402
import time  # noqa: E402
h.save = lambda found: len(found)
h.bump = lambda *a: None
h.enrich = lambda found: None
def lent(nom, d, err=None):
    def f(*a):
        h.log("  page lue :", nom)
        time.sleep(d)
        if err:
            raise RuntimeError(err)
        return [{}] * 3
    return f
h.src_hellowork, h.src_meteojob, h.src_francetravail = lent("hw", 0.4), lent("mj", 0.4, "site en panne"), lent("ft", 0.4)
t0 = time.time()
with h.ThreadPoolExecutor(3) as pool:
    res = list(pool.map(lambda s: h.run_source(s, {}, "u"), ["hellowork", "meteojob", "francetravail"]))
eq("sources en même temps", time.time() - t0 < 1.0, True)
eq("journal gardé par source", res[0][1][:2], ["\n== HelloWork", "  page lue : hw"])
eq("source en panne signalée seule", [r[0]["ok"] for r in res], [True, False, True])
h.BLOCKED.hits.clear()
logging.getLogger("jobspy.linkedin").error("429 Too Many Requests")
eq("blocage compté pour le bon site", (h.BLOCKED.hits.get("linkedin"), h.BLOCKED.hits.get("indeed")), (1, None))
# Bilan des sources du dimanche
import notify  # noqa: E402
sc = notify.source_score([{"sug": {"src": "hellowork"}, "st": 2, "sentAt": 2e12}, {"sug": {"src": "indeed"}, "st": 3, "autoRef": 1, "sentAt": 2e12},
                          {"sug": {"src": "indeed"}, "st": 1, "sentAt": 1}], 1e12, {"hellowork": 300, "meteojob": 80})
eq("sources : réponses comptées, refus automatique exclu", [(x["k"], x["sent"], x["rep"]) for x in sc], [("hellowork", 1, 1), ("indeed", 1, 0), ("meteojob", 0, 0)])
print(f"Recherche automatique : {19 - fails}/19 réussis")
sys.exit(1 if fails else 0)
