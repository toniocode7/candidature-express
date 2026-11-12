"""Expérience demandée dans une annonce.
Exigée (« exigé », « obligatoire », « minimum », « au moins », « vous justifiez de », « required »...) :
l'offre est écartée si ce nombre d'années atteint la limite choisie dans l'app.
Souhaitée (« idéalement », « de préférence », « un plus »...) ou simplement mentionnée : l'offre reste,
le nombre d'années est seulement affiché. La même règle existe dans web/app.js (xpScan)."""
import re
import unicodedata

NUM = {"un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
       "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
N = r"(\d{1,2}|" + "|".join(NUM) + r")"
YEARS = re.compile(r"\b" + N + r"\s*(?:\+\s*)?(?:(?:a|à|-|–|to|ou|or)\s*" + N + r"\s*)?(?:\+\s*)?(ans?\b|an\(s\)|annees?\b|years?\b|yrs?\b)", re.I)
EXPW = re.compile(r"(experience|exp\.|experiences|anciennete|pratique|dans un poste|dans le poste|sur un poste|similaire|similar|relevant|background|track record)")
HARD = re.compile(r"(exige|obligatoire|requis|required|require|indispensable|imperati|mandatory|minimum|\bmin\b|au moins|at least|justifi|must\b|essential|necessaire|prerequis|pre-requis|incontournable|non negociable)")
SOFT = re.compile(r"(souhait|ideal|prefer|de preference|apprecie|un plus|a plus|\bplus\b.{0,3}$|nice to have|atout|si possible|bonus|advantage|appreciated|desirable|serait|would be|is a plus|idealement|eventuellement|debutant accepte|debutants? acceptes?|junior)")
SPLIT = re.compile(r"(?<=[.!?;•\n|])\s*|\s+-\s+(?=[A-ZÉ])")


def norm(t: str) -> str:
    """Minuscules sans accents, même longueur que le texte d'origine (pour en citer la phrase)."""
    return "".join((unicodedata.normalize("NFD", c)[0] if c not in "’‘" else "'").lower()[:1] or " " for c in str(t or ""))


def scan(text: str) -> dict:
    """{'hard': années exigées (0 si rien), 'soft': années souhaitées ou citées, 'txt': phrase en cause}"""
    raw = re.sub(r"[ \t\r\f\v]+", " ", unicodedata.normalize("NFC", str(text or "")))
    t = norm(raw)
    hard = soft = 0
    why = ""
    sents = re.split(r"(?<=[.!?;•\n|])", t)
    pos = 0
    prev = ""
    for s in sents:
        for m in YEARS.finditer(s):
            a = m.group(1)
            n = NUM.get(a, None) if not a.isdigit() else int(a)
            if not n or n > 20:
                continue
            ctx = (prev[-60:] + " " + s)
            if not EXPW.search(ctx):
                continue
            # « entreprise de 90 ans », « moins de 30 ans » (âge) : on ignore
            before = s[max(0, m.start() - 25):m.start()]
            if re.search(r"(moins de|age|agee?s? de|creee? (il y a|en)|depuis|fondee?)\s*$", before):
                continue
            near = s[max(0, m.start() - 50):m.end() + 30]
            if SOFT.search(near) and not re.search(r"(exige|obligatoire|required|mandatory|indispensable)", near):
                if n > soft:
                    soft = n
                continue
            if HARD.search(ctx):
                if n > hard:
                    hard = n
                    why = raw[pos:pos + len(s)].strip()[:220]
            elif n > soft:
                soft = n
        prev = s
        pos += len(s)
    return {"hard": hard, "soft": soft, "txt": why}


if __name__ == "__main__":
    tests = [
        ("Expérience exigée de 4 ans dans un poste similaire.", 4, 0),
        ("4 ans d'expérience exigés", 4, 0),
        ("Vous justifiez d'au moins 7 ans d'expérience en Supply Chain.", 7, 0),
        ("Idéalement 5 ans d'expérience sur un poste similaire.", 0, 5),
        ("Une expérience de 5 ans serait un plus.", 0, 5),
        ("3 à 8 ans d'expérience en Supply Chain industrielle.", 0, 3),
        ("Minimum 5 years of relevant experience required.", 5, 0),
        ("5+ years of experience in procurement, preferably in aerospace.", 0, 5),
        ("Armor-lux c'est près de 90 ans d'expérience.", 0, 0),
        ("Avoir moins de 30 ans à la date de signature du contrat.", 0, 0),
        ("Expérience : 5 An(s) - Expérience exigée", 5, 0),
        ("Débutant accepté. Une première expérience de 2 ans est appréciée.", 0, 2),
        ("Au moins trois ans d'expérience obligatoire en achats.", 3, 0),
        ("Expérience souhaitée de 4 ans", 0, 4),
        ("Vous justifiez d'au moins 7 ans d'expérience en supply chain, idéalement dans l'aéronautique.", 7, 0),
        ("Profil : 5 ans d'expérience minimum, une expérience dans l'automobile serait un plus.", 5, 0),
        ("Bac+5 avec 2 ans d'expérience minimum.", 2, 0),
    ]
    ok = 0
    for s, h, so in tests:
        r = scan(s)
        good = r["hard"] == h and r["soft"] == so
        ok += good
        print("OK " if good else "KO ", s, "=>", r["hard"], r["soft"])
    print(ok, "/", len(tests))
