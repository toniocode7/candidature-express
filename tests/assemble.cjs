// Le code de l'app est rangé par thème dans web/app/*.js (lus dans l'ordre des numéros) ;
// web/app.js est leur assemblage, c'est lui que l'app charge. Après une modification d'un fichier de web/app :
//   node tests/assemble.cjs          (réécrit web/app.js)
//   node tests/assemble.cjs --check  (vérifie que web/app.js est à jour, lancé avec les tests)
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "../web/app"), OUT = path.join(__dirname, "../web/app.js");
const files = fs.readdirSync(DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const code = files.map(f => fs.readFileSync(path.join(DIR, f), "utf8")).join("\n");
if (process.argv.includes("--check")) {
  const ok = fs.readFileSync(OUT, "utf8") === code;
  console.log(ok ? `Assemblage : web/app.js à jour (${files.length} fichiers)` : "Assemblage : web/app.js n'est pas à jour, lancer node tests/assemble.cjs");
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(OUT, code);
console.log(`web/app.js assemblé depuis ${files.length} fichiers (${Math.round(code.length / 1024)} Ko)`);
