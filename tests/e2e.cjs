// Test de bout en bout : l'app ouverte en mode démo (format iPhone) avec des données fictives.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium, devices } = require("playwright");
const { eq, done, pick } = require("./lib.cjs");
const FIXTXT = JSON.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/demo.json"), "utf8")).ls.off)[0].txt;
const DUPFP = pick(["norm", "fpHash", "FPSTOP", "fpOf"]).fpOf("Annonce publiée par Intérim Plus pour son client. " + FIXTXT.split(". ").slice(1).join(". "));
const WEB = path.join(__dirname, "../web"), FIX = path.join(__dirname, "fixtures/demo.json");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((q, r) => {
  const f = path.join(WEB, decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise((ok) => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}`;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await b.newContext({ ...devices["iPhone 15"], locale: "fr-FR", serviceWorkers: "block" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/?demo");
  const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#ce-pick")]);
  await fc.setFiles(FIX);
  await p.waitForFunction(() => !document.querySelector(".ce-gate"), null, { timeout: 20000 });
  await p.waitForTimeout(1200);

  // Offres suggérées fictives couvrant chaque critère
  await p.evaluate((dupfp) => {
    const s = JSON.parse(localStorage.getItem("candexp.sugg")), now = Date.now();
    const mk = (t, lieu, x) => Object.assign({ titre: t, entreprise: "Société " + t, lieu, contrat: "CDI", url: "https://exemple.test/s/" + encodeURIComponent(t), site: "Test", src: "test", pertinence: 70, raison: "Test.", fd: now, pub: now }, x || {});
    s.items = [
      mk("Approvisionneur Brest", "Brest (29)", { pertinence: 90 }), mk("Acheteur Paris", "Paris 15e", { pertinence: 60 }),
      mk("Acheteur Lyon", "Lyon"), mk("Coordinator Middlesex", "Middlesex, ENG, UK", { cc: "GB" }),
      mk("Analyst Amsterdam", "Amsterdam, Netherlands"), mk("Stage achats", "Brest", { contrat: "Stage" }),
      mk("Acheteur exigé 5 ans", "Brest", { xpChk: 1, xpmin: 5, xpsoft: 0 }), mk("Appro souhaité 5 ans", "Brest", { xpChk: 1, xpmin: 0, xpsoft: 5 }),
      mk("Appro bas salaire", "Brest", { salaire: "24 - 26 k€" }), mk("Acheteur Alpha", "Toulouse", { entreprise: "Alpha Industrie" }),
      mk("Gestionnaire achats fournisseurs", "29 - Brest", { entreprise: "Intérim Plus", fpFull: dupfp }),
    ];
    s.at = now; s.mt = now + 1e9; localStorage.setItem("candexp.sugg", JSON.stringify(s));
  }, DUPFP);
  await p.goto(base + "/?demo&v=sugg"); await p.waitForTimeout(3000);
  const shown = () => p.$$eval("#sgl .sgc h3", (h) => h.map((x) => x.textContent.replace(/^(Nouvelle|Rattrapée)\s*/, "").trim()).sort());
  eq("lien de notification : onglet Suggérées", await p.$eval(".bnav button[aria-current=page], .bnav button.on", (e) => /Suggérées/.test(e.textContent)).catch(() => false), true);
  eq("critères appliqués", await shown(), ["Acheteur Alpha", "Acheteur Paris", "Analyst Amsterdam", "Appro bas salaire", "Appro souhaité 5 ans", "Approvisionneur Brest"].sort());
  eq("mention d'expérience souhaitée", await p.$$eval("#sgl .sgc .m", (m) => m.some((x) => /Expérience souhaitée : 5 ans, non exigée/.test(x.textContent))), true);
  await p.evaluate(() => { const c = window.CE_crit; c.SG().salmin = 28; c.save(); }); await p.waitForTimeout(400);
  eq("salaire minimum 28 k€", (await shown()).includes("Appro bas salaire"), false);
  await p.evaluate(() => { const c = window.CE_crit; c.SG().xpmax = 6; c.save(); }); await p.waitForTimeout(400);
  eq("limite d'expérience relevée à 6 ans", (await shown()).includes("Acheteur exigé 5 ans"), true);
  await p.selectOption("#cesort", "note"); await p.waitForTimeout(300);
  eq("tri par note", (await p.$eval("#sgl .sgc h3", (h) => h.textContent)).includes("Approvisionneur Brest"), true);
  await p.click("#cesortdir"); await p.waitForTimeout(300);
  eq("tri inversé", (await p.$eval("#sgl .sgc h3", (h) => h.textContent)).includes("Approvisionneur Brest"), false);
  eq("même offre déjà candidatée via un autre site : masquée", (await p.evaluate(() => window.CE_sgAudit()))["déjà candidatée (même offre)"], 1);
  eq("décompte des motifs", (await p.evaluate(() => window.CE_sgAudit())).total, 11);

  // Chaque onglet s'ouvre, sans débordement horizontal
  for (let i = 0; i < 5; i++) {
    await p.click(`.bnav button >> nth=${i}`); await p.waitForTimeout(500);
    eq("onglet " + i + " sans débordement", await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0), true);
  }
  await p.click("#setb, [aria-label*=Param], button[title*=Param]").catch(() => {});
  await p.waitForTimeout(500);
  eq("aucun message de l'ancien artefact (compte Claude, Firecrawl)", await p.evaluate(() => /compte Claude|crédits Firecrawl|connecteurs de Claude/.test(document.body.innerText)), false);
  eq("aucune erreur JavaScript", errs, []);
  await b.close(); server.close();
  done("App en démo (iPhone)");
})().catch((e) => { console.error(e); process.exit(1); });
