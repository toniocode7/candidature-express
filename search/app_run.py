"""Ouvre l'app en arrière-plan (navigateur sans écran) pour trier les offres récoltées.

L'app applique exactement les mêmes règles que lorsque tu appuies sur
« Nouvelle recherche » : critères, métiers exclus, offres écartées, note IA,
doublons, plafond. Le résultat se synchronise ensuite sur l'iPhone et le Mac.
La connexion se fait par un lien de connexion à usage unique créé avec la clé
de service : ton mot de passe n'est stocké nulle part.
"""
import json
import os
import subprocess
import sys
import time

import requests
from playwright.sync_api import sync_playwright

SB_URL = f"https://{os.environ['SUPABASE_PROJECT_REF']}.supabase.co"
SB_KEY = os.environ["SUPABASE_SECRET_KEY"]
PUB = os.environ["SUPABASE_PUBLISHABLE_KEY"]
H = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}", "Content-Type": "application/json"}
MODE = sys.argv[1] if len(sys.argv) > 1 else "search"  # search | open


def session() -> dict:
    users = requests.get(f"{SB_URL}/auth/v1/admin/users", headers=H, timeout=30).json()["users"]
    email = users[0]["email"]
    r = requests.post(f"{SB_URL}/auth/v1/admin/generate_link", headers=H, json={"type": "magiclink", "email": email}, timeout=30)
    r.raise_for_status()
    j = r.json()
    th = j.get("hashed_token") or (j.get("properties") or {}).get("hashed_token")
    v = requests.post(f"{SB_URL}/auth/v1/verify", headers={"apikey": PUB, "Content-Type": "application/json"},
                      json={"type": "magiclink", "token_hash": th}, timeout=30)
    v.raise_for_status()
    s = v.json()
    s.setdefault("expires_at", int(time.time()) + int(s.get("expires_in", 3600)))
    return s


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "-d", "web"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    sess = session()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="fr-FR", timezone_id="Europe/Paris")
            ctx.add_init_script(f"""
              try {{
                localStorage.setItem('ce.auth', {json.dumps(json.dumps(sess))});
                localStorage.setItem('candexp.guide', '1');
                window.CE_BG = true;
              }} catch (e) {{}}
            """)
            page = ctx.new_page()
            logs = []
            page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"[:300]) if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: logs.append(f"[erreur] {e}"[:300]))
            page.goto("http://localhost:8765/?bg=1", wait_until="load")
            # L'app est prête quand elle a récupéré tes données.
            page.wait_for_function("() => !document.querySelector('.ce-gate') && (localStorage.getItem('candexp.off')||'').length > 10", timeout=90000)
            page.wait_for_function("() => /Synchronis/.test((document.getElementById('syn')||{}).textContent||'')", timeout=60000)
            n = page.evaluate("() => JSON.parse(localStorage.getItem('candexp.off')||'[]').length")
            print(f"App ouverte en arrière-plan, {n} candidatures chargées.")
            if MODE == "search":
                page.evaluate("() => { window.CE_LAST_RUN = null; document.getElementById('sggo').click(); }")
                page.wait_for_function("() => window.CE_LAST_RUN && window.CE_LAST_RUN.done", timeout=20 * 60000, polling=2000)
                res = page.evaluate("() => window.CE_LAST_RUN")
                print("Résultat du tri :", res.get("msg"))
                print("Nouvelles offres retenues :", res.get("nouvelles"))
            # Laisser le temps à la synchronisation d'envoyer les changements.
            page.wait_for_timeout(4000)
            page.wait_for_function("() => !window.CE_PENDING_SYNC || window.CE_PENDING_SYNC() === 0", timeout=60000, polling=1000)
            page.wait_for_timeout(2000)
            for l in logs[-15:]:
                print("  ", l)
            b.close()
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
