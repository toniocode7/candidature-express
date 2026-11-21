// Mise à jour par fichier : après une nouvelle publication où seul app.js change, l'appareil ne doit
// retélécharger que sw.js et app.js ; les autres fichiers sont recopiés depuis la version déjà installée.
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ce-sw-"));
const A = path.join(tmp, "a"), B = path.join(tmp, "b");
const build = (dir, ver) => execFileSync(process.execPath, [path.join(__dirname, "publier.cjs"), dir, ver], { stdio: "pipe" });
build(A, "aaaa1111");
build(B, "bbbb2222");
// Version B : app.js modifié (comme après une correction), le reste identique ; empreinte recalculée.
{
  const crypto = require("crypto");
  const f = path.join(B, "app.js");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8") + ";window.__ceV2=1;");
  const h = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
  const sw = path.join(B, "sw.js");
  fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace(/"app\.js":"[0-9a-f]{12}"/, `"app.js":"${h}"`));
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let root = A, log = [];
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = path.join(root, u === "/" ? "index.html" : u);
  log.push(u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(f).pipe(r);
});

let fails = 0, n = 0;
const eq = (label, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log("ÉCHEC", label, "→", got, "attendu", want); } };

(async () => {
  await new Promise(ok => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}`;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await b.newContext();
  await ctx.route(/supabase\.co|fonts\.g/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto(base + "/");
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  const keysA = await p.evaluate(async () => { const c = await caches.open((await caches.keys()).find(k => k.startsWith("ce-") && k !== "ce-geo-v1")); return (await c.keys()).length; });
  eq("première installation : tous les fichiers gardés hors ligne", keysA, 15);

  root = B; log = [];
  // Nouvelle version publiée : l'app la cherche, l'installe, puis se recharge d'elle-même (rien n'est ouvert).
  let logAtReload = null;
  p.on("framenavigated", () => { if (!logAtReload) logAtReload = log.slice(); });
  const reloaded = p.waitForEvent("load", { timeout: 20000 }).then(() => true).catch(() => false);
  await p.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
  eq("rechargement automatique sur la nouvelle version", await reloaded, true);
  await p.waitForTimeout(500);
  const done = await p.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open("ce-bbbb2222"); const k = await c.keys(); return { keys, n: k.filter(r => /[?&]h=/.test(r.url)).length }; });
  const got = [...new Set(logAtReload || log)].filter(u => u !== "/favicon.ico").sort();
  const after = log.slice((logAtReload || log).length).filter(u => u !== "/favicon.ico");
  eq("après le rechargement : rien n'est retéléchargé", after.filter(u => u !== "/" && u !== "/index.html"), []);
  eq("mise à jour : seuls sw.js et app.js téléchargés", got, ["/app.js", "/sw.js"]);
  eq("nouvelle version complète hors ligne", done.n, 15);
  eq("ancienne version supprimée", done.keys.includes("ce-aaaa1111"), false);
  const v2 = await p.evaluate(async () => { const r = await (await caches.open("ce-bbbb2222")).match("app.js", { ignoreSearch: true }); return (await r.text()).includes("__ceV2"); });
  eq("app.js à jour dans le cache", v2, true);

  await b.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Mise à jour par fichier : ${n - fails}/${n} réussis`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
