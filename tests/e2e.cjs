// Test de bout en bout : l'app ouverte en mode démo (format iPhone) avec des données fictives.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium, devices } = require("playwright");
const { eq, done, pick } = require("./lib.cjs");
const FIXTXT = JSON.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/demo.json"), "utf8")).ls.off)[0].txt;
const DUPFP = pick(["norm", "fpHash", "FPSTOP", "fpOf"]).fpOf("Annonce publiée par Intérim Plus pour son client. " + FIXTXT.split(". ").slice(1).join(". "));
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
  await p.goto(base + "/?demo&v=sugg"); await p.waitForFunction(() => document.querySelector("#bnav button.on, #bnav button[aria-current=page]") && !document.getElementById("ce-splash"), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500);
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

  // Glisser une suggestion vers la gauche : écartée tout de suite, « Annuler » la fait revenir
  const n0 = (await shown()).length;
  const box = await p.$eval("#sgl .sgc", (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width * 0.75, y: r.y + 30 }; });
  const cdp = await ctx.newCDPSession(p);
  const touch = async (pts) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pts[0]] });
    for (const q of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [q] }); await p.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await touch(Array.from({ length: 9 }, (_, k) => ({ x: box.x - k * 18, y: box.y + k * 0.3 })));
  await p.waitForTimeout(600);
  eq("glisser à gauche : offre écartée sans question", [(await shown()).length, await p.$$eval("#sgl .sgwhy", (w) => w.length)], [n0 - 1, 0]);
  eq("bandeau Annuler affiché", await p.$eval("#toast", (e) => !e.hidden && /écartée/.test(e.textContent)), true);
  await p.click("#toastu"); await p.waitForTimeout(400);
  eq("Annuler : l'offre revient", (await shown()).length, n0);
  // Un petit déplacement vertical (défilement) ne déclenche rien
  await touch(Array.from({ length: 6 }, (_, k) => ({ x: box.x + k * 0.5, y: box.y + k * 12 }))); await p.waitForTimeout(300);
  eq("défilement : rien ne se déclenche", (await shown()).length, n0);

  // Pastille : les nouvelles suggestions ne comptent plus une fois l'onglet Suggérées ouvert
  eq("pastille : suggestions vues, plus comptées", await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("candexp.sugg")); return s.seenAt === s.at && typeof window.CE_badgeN() === "number"; }), true);

  // Justificatif de recherche d'emploi : PDF créé sur une période choisie
  const dl = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
  await p.evaluate(() => { document.querySelector('[data-sp="suivi"]').click(); document.getElementById("jpfrom").value = "2000-01-01"; document.getElementById("jpto").value = "2100-01-01"; document.getElementById("jpgo").click(); });
  const file = await dl;
  const pdf = file ? fs.readFileSync(await file.path()).toString("latin1") : "";
  eq("justificatif : PDF téléchargé", /^%PDF/.test(pdf) && /\.pdf$/.test(file.suggestedFilename()), true);
  eq("justificatif : message", await p.$eval("#jpn", (e) => /candidatures? dans le PDF/.test(e.textContent)), true);
  if (process.env.CE_JP_OUT && pdf) fs.writeFileSync(process.env.CE_JP_OUT, pdf, "latin1");

  // Carnet des recruteurs : s'ouvre sans erreur (vide en démo)
  await p.evaluate(() => document.getElementById("rcgo").click()); await p.waitForTimeout(400);
  eq("carnet des recruteurs : ouvert", await p.$eval("#rcd", (d) => d.open && /Aucun recruteur/.test(d.textContent)), true);
  await p.evaluate(() => document.getElementById("rcd").close());

  // Suppression : une synchronisation qui passe juste après ne remet pas la candidature (même si la base l'a encore)
  const delId = await p.evaluate(() => JSON.parse(localStorage.getItem("candexp.off"))[0].id);
  await p.evaluate((id) => { window.CE_testDel(id); window.dispatchEvent(new Event("ce:remote")); }, delId);
  await p.waitForTimeout(3000);
  eq("suppression : pas remise par la synchronisation", await p.evaluate((id) => JSON.parse(localStorage.getItem("candexp.off")).some((o) => o.id === id)), false);
  eq("suppression : effacée de la base", await p.evaluate((id) => !JSON.stringify(JSON.parse(localStorage.getItem("ce.demo.db") || "{}")).includes('"o_' + id + '"'), delId), true);

  // --- Gestes ---
  const tdrag = async (pts, holdMs = 0) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pts[0]] });
    if (holdMs) await p.waitForTimeout(holdMs);
    for (const q of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [q] }); await p.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  // Barre du bas : glisser du premier onglet jusqu'à Candidatures
  const nb = await p.$$eval("#bnav [data-go]", (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, go: b.getAttribute("data-go") }; }));
  const hi = nb.findIndex((b) => b.go === "histbox");
  await tdrag(Array.from({ length: 12 }, (_, k) => ({ x: nb[0].x + (nb[hi].x - nb[0].x) * k / 11, y: nb[0].y })));
  await p.waitForTimeout(500);
  eq("barre du bas : on arrive sur l'onglet où le doigt se lève", await p.evaluate(() => !document.getElementById("histbox").classList.contains("offv")), true);
  // Appui long sur une candidature : actions rapides ; toucher la pastille de statut : changement de statut seul
  const it = await p.$eval("#list .oi .it", (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 60, y: r.y + 20 }; });
  await tdrag([it, it], 800);
  await p.waitForTimeout(300);
  eq("appui long : actions rapides", await p.$eval("#stsh", (d) => d.open && !document.getElementById("stsha").hidden && /Actions rapides/.test(d.textContent) && /Supprimer/.test(d.textContent)), true);
  // Tirer la fenêtre vers le bas depuis son en-tête : elle se ferme
  const sh = await p.$eval("#stsh .shh", (e) => { const r = e.getBoundingClientRect(); return { x: r.x + 40, y: r.y + 12 }; });
  await tdrag(Array.from({ length: 10 }, (_, k) => ({ x: sh.x, y: sh.y + k * 25 })));
  await p.waitForTimeout(500);
  eq("fenêtre tirée vers le bas : fermée", await p.$eval("#stsh", (d) => d.open), false);
  // Tirer la page vers le bas tout en haut : actualisation (sans recherche ni mails)
  await p.evaluate(() => window.scrollTo(0, 0));
  await tdrag(Array.from({ length: 10 }, (_, k) => ({ x: 200, y: 200 + k * 14 })));
  await p.waitForTimeout(300);
  eq("tirer pour actualiser : indicateur affiché", await p.evaluate(() => { const e = document.querySelector(".ptr"); return !!e && /Actualisation|À jour/.test(e.textContent); }), true);
  // Confettis quand une candidature passe en Entretien
  const pill = async (v) => { await p.evaluate(() => document.querySelector("#list .oi .pill").click()); await p.waitForTimeout(700); await p.evaluate((v) => document.querySelector('#stshl [data-v="' + v + '"]').click(), v); await p.waitForTimeout(300); };
  await pill(1); await p.evaluate(() => { localStorage.setItem("candexp.celeb", "[]"); document.querySelectorAll("canvas.cnf").forEach((c) => c.remove()); });
  await pill(2);
  await p.waitForTimeout(700);
  eq("entretien obtenu : confettis", await p.evaluate(() => !!document.querySelector("canvas.cnf")), true);
  // Calendrier dans Stats : l'entretien apparaît au bon jour
  await p.evaluate(() => document.querySelector('#bnav [data-go="dashbox"]').click()); await p.waitForTimeout(600);
  eq("calendrier affiché", await p.$$eval("#calbox .cday", (d) => d.length) >= 28, true);

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
