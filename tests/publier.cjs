// Prépare la version publiée de l'app dans un dossier à part (le code du dépôt reste lisible) :
// 1. numéro de version posé dans le service worker et le journal des erreurs ;
// 2. code JavaScript et CSS compressés (esbuild) : environ deux fois moins à télécharger ;
// 3. empreinte de chaque fichier écrite dans le service worker : à une mise à jour, l'iPhone ne retélécharge
//    que les fichiers qui ont changé.
// Usage : node publier.cjs <dossier de sortie> <version>
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const esbuild = require("esbuild");

const SRC = path.join(__dirname, "../web");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "../_site"));
const VER = (process.argv[3] || "local").slice(0, 8);

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });

const rd = f => fs.readFileSync(path.join(OUT, f), "utf8");
const wr = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
const swap = (f, a, b) => { const s = rd(f); if (!s.includes(a)) throw new Error(`${f} : « ${a} » introuvable`); wr(f, s.replace(a, b)); };

// Version notée avec les erreurs : l'empreinte d'app.js (et non le numéro de publication), pour que errors.js
// ne change, et ne soit retéléchargé, que lorsque le code de l'app change vraiment.
const APPV = crypto.createHash("sha256").update(rd("app.js")).digest("hex").slice(0, 8);
swap("ce/errors.js", 'var VER = "dev";', `var VER = "${APPV}";`);
swap("sw.js", 'const VERSION = "ce-v1";', `const VERSION = "ce-${VER}";`);

// Compression : les noms du niveau principal (partagés entre les fichiers) sont gardés tels quels par esbuild
// pour un script classique, seul l'intérieur des fonctions est raccourci.
const JS = ["app.js", ...fs.readdirSync(path.join(OUT, "ce")).filter(f => f.endsWith(".js")).map(f => "ce/" + f)];
let before = 0, after = 0;
// {{AFF}} est remplacé au démarrage par un objet : on le protège sous un nom que la compression ne touche pas.
for (const f of JS) {
  const code = rd(f).replace(/\{\{AFF\}\}/g, "__CE_AFF__");
  const r = esbuild.transformSync(code, { loader: "js", minify: true, target: "es2017", charset: "utf8", legalComments: "none" });
  before += Buffer.byteLength(code); after += Buffer.byteLength(r.code);
  wr(f, r.code.replace(/__CE_AFF__/g, "{{AFF}}"));
}
for (const f of ["ce/ce.css"]) {
  const code = rd(f);
  const r = esbuild.transformSync(code, { loader: "css", minify: true, charset: "utf8" });
  before += Buffer.byteLength(code); after += Buffer.byteLength(r.code);
  wr(f, r.code);
}

// Styles écrits dans index.html : compressés de la même façon.
{
  let html = rd("index.html");
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, css, b) => {
    const r = esbuild.transformSync(css, { loader: "css", minify: true, charset: "utf8" });
    before += Buffer.byteLength(css); after += Buffer.byteLength(r.code);
    return a + r.code.trim() + b;
  });
  wr("index.html", html);
}

// Empreintes des fichiers gardés hors ligne (liste CORE du service worker).
const sw = rd("sw.js");
const core = JSON.parse(sw.match(/const CORE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
const hash = {};
for (const f of core) {
  const file = f === "./" ? "index.html" : f;
  hash[f] = crypto.createHash("sha256").update(fs.readFileSync(path.join(OUT, file))).digest("hex").slice(0, 12);
}
swap("sw.js", "const HASH = {};", `const HASH = ${JSON.stringify(hash)};`);
const r = esbuild.transformSync(rd("sw.js"), { loader: "js", minify: true, target: "es2017", charset: "utf8" });
wr("sw.js", r.code);

console.log(`Version ${VER} préparée dans ${path.relative(process.cwd(), OUT) || "."} : code ${Math.round(before / 1024)} Ko → ${Math.round(after / 1024)} Ko, ${core.length} fichiers avec empreinte.`);
