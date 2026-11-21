// Simulation d'entretien à la voix, de bout en bout en démo : faux micro (Chromium), IA et transcription simulées.
// Vérifie le parcours complet : accueil, questions lues, enregistrement, retour par réponse, bilan enregistré.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium, devices } = require("playwright");
const { eq, done } = require("./lib.cjs");
const WEB = process.env.CE_WEB ? path.resolve(process.env.CE_WEB) : path.join(__dirname, "../web"), FIX = path.join(__dirname, "fixtures/demo.json");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((q, r) => {
  const f = path.join(WEB, decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise((ok) => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}`;
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ ...devices["iPhone 15"], locale: "fr-FR", serviceWorkers: "block", permissions: ["microphone"] });
  await ctx.addInitScript(() => {
    window.CE_SIMLOG = { said: [], calls: [] };
    // Voix de l'appareil : on note ce qui est lu, et la lecture se termine tout de suite.
    const Real = window.SpeechSynthesisUtterance;
    window.speechSynthesis.speak = (u) => { window.CE_SIMLOG.said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); };
    window.speechSynthesis.cancel = () => {};
    void Real;
    // IA simulée : questions, puis transcription et retour.
    window.CE_DEMO_CALL = async (name, body) => {
      window.CE_SIMLOG.calls.push(body.transcribe ? "transcription" : (body.prompt || "").slice(0, 40));
      if (body.transcribe) return { text: "Je suis assistant logistique depuis deux ans, je gère les commandes fournisseurs dans SAP et le suivi des stocks." };
      if (/Tu joues le recruteur/.test(body.prompt || "")) return { json: { accueil: "Bonjour, merci d'être venu.", questions: ["Présentez-vous.", "Pourquoi ce poste ?"], fin: "Merci, à bientôt." } };
      if (/coach d'entretien/.test(body.prompt || "")) return { json: { note: 4, bien: "Réponse claire et concrète.", manque: "Un chiffre sur tes résultats.", conseil: "Termine par ce que tu apportes au poste.", exemple: "Je gère les commandes dans SAP..." } };
      return { json: {}, text: "" };
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/?demo");
  const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#ce-pick")]);
  await fc.setFiles(FIX);
  await p.waitForFunction(() => !document.querySelector(".ce-gate"), null, { timeout: 20000 });
  await p.waitForTimeout(1200);

  // Ouvre la fiche entretien d'une candidature puis la simulation
  const ok = await p.evaluate(() => { const o = JSON.parse(localStorage.getItem("candexp.off"))[0]; return !!o; });
  eq("données de démo chargées", ok, true);
  await p.evaluate(() => window.CE_testPrep && window.CE_testPrep());
  eq("carte simulation dans la fiche entretien", await p.$eval("#prepd", (d) => d.open && !!d.querySelector("#simgo")), true);
  await p.click("#simgo"); await p.waitForTimeout(300);
  eq("écran d'accueil de la simulation", await p.$eval("#simd", (d) => d.open && /6 questions/.test(d.textContent)), true);
  await p.click("#sims");
  await p.waitForSelector("#simr", { timeout: 10000 });
  eq("accueil puis première question lues à voix haute", await p.evaluate(() => window.CE_SIMLOG.said.filter((s) => s.trim())), ["Bonjour, merci d'être venu.", "Présentez-vous."]);
  // Réponse : enregistrement 1,5 s avec le faux micro
  await p.click("#simr"); await p.waitForTimeout(1500);
  eq("enregistrement en cours", await p.$eval("#simr", (e) => e.classList.contains("on")), true);
  await p.click("#simr");
  await p.waitForSelector("#simnx", { timeout: 10000 });
  eq("réponse transcrite et commentée", await p.$eval("#simb", (e) => /SAP/.test(e.textContent) && /Termine par ce que tu apportes/.test(e.textContent) && /★★★★/.test(e.textContent)), true);
  eq("transcription demandée avec un vrai enregistrement", await p.evaluate(() => window.CE_SIMLOG.calls.includes("transcription")), true);
  await p.click("#simnx"); await p.waitForSelector("#simskip");
  await p.click("#simskip");
  await p.waitForSelector("#simre", { timeout: 10000 });
  eq("bilan affiché", await p.$eval("#simb", (e) => /Bilan : 4 \/ 5/.test(e.textContent)), true);
  eq("bilan enregistré sur la candidature", await p.evaluate(() => { const o = JSON.parse(localStorage.getItem("candexp.off")).find((x) => x.sim); return o && o.sim[0].n; }), 4);
  await p.evaluate(() => document.getElementById("simd").close()); await p.waitForTimeout(300);
  eq("micro coupé à la fermeture", await p.evaluate(() => !window.CE_simActive || !window.CE_simActive()), true);
  eq("aucune erreur JavaScript", errs, []);
  await b.close(); server.close();
  done("Simulation d'entretien");
})().catch((e) => { console.error(e); process.exit(1); });
