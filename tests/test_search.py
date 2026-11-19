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
print(f"Recherche automatique : {14 - fails}/14 réussis")
sys.exit(1 if fails else 0)
