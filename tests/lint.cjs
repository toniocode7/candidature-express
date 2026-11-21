// Vérificateur automatique du code de l'app : repère les fautes qui ne plantent qu'au moment où le code s'exécute
// (variable mal écrite ou jamais définie, clé en double, code jamais atteint...). Lancé avec les tests.
const fs = require("fs"), path = require("path");
const { Linter } = require("eslint");
const globals = require("globals");

const WEB = path.join(__dirname, "../web");
const FILES = ["app.js", "sw.js", "config.js", ...fs.readdirSync(path.join(WEB, "ce")).filter(f => f.endsWith(".js")).map(f => "ce/" + f)];
const src = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(WEB, f), "utf8").replace("{{AFF}}", "{}")]));

// Noms partagés entre les fichiers : fonctions et variables du niveau principal d'app.js (script classique),
// et tout ce qui est posé sur window (window.CE_xxx = ...).
const shared = {};
const acorn = require("acorn");
const top = acorn.parse(src["app.js"], { ecmaVersion: "latest" });
for (const n of top.body) {
  if (n.type === "FunctionDeclaration") shared[n.id.name] = "writable";
  if (n.type === "VariableDeclaration") n.declarations.forEach(d => { if (d.id.type === "Identifier") shared[d.id.name] = "writable"; });
}
for (const f of FILES) for (const m of src[f].matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) shared[m[1]] = "writable";

// (Pas de règle contre la réaffectation de fonction : l'app enveloppe volontairement certaines fonctions, ex. renderList = function () {...}.)
const RULES = {
  "no-undef": "error", "no-dupe-keys": "error", "no-dupe-args": "error", "no-unreachable": "error", 
  "no-const-assign": "error", "no-unsafe-finally": "error", "no-self-assign": "error", "valid-typeof": "error", "use-isnan": "error",
  "no-obj-calls": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error", "getter-return": "error", "no-unsafe-negation": "error",
  "no-sparse-arrays": "error", "no-import-assign": "error", "no-delete-var": "error", "no-shadow-restricted-names": "error"
};
const linter = new Linter({ configType: "flat" });
let n = 0;
for (const f of FILES) {
  const sw = f === "sw.js";
  const msgs = linter.verify(src[f], [{
    languageOptions: { ecmaVersion: "latest", sourceType: "script",
      globals: { ...(sw ? globals.serviceworker : globals.browser), ...(sw ? {} : shared), supabase: "readonly", pdfjsLib: "readonly", jspdf: "readonly" } },
    rules: RULES
  }], { filename: f });
  for (const m of msgs) {
    n++;
    console.log(`web/${f}:${m.line}:${m.column}  ${m.message}  (${m.ruleId || "syntaxe"})`);
  }
}
// Styles essentiels présents (un fichier de styles vidé par erreur casse l'app sans planter : on le détecte ici).
const CSS = fs.readFileSync(path.join(WEB, "ce/ce.css"), "utf8"), HTML = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
[[CSS, ".ce-gate{", "écran de connexion"], [CSS, "display-mode:standalone", "barre du bas sur iOS installé"], [CSS, ".cesr{", "liste des sources"],
 [CSS, "dialog.drawer{padding-top", "fenêtres sous la barre d'état"], [HTML, ".bnav{position:fixed", "barre du bas"], [HTML, "#ce-splash{", "écran d'ouverture"]]
  .forEach(([txt, needle, what]) => { if (!txt.includes(needle)) { n++; console.log(`Styles manquants : ${what} (« ${needle} » introuvable)`); } });
console.log(n ? `Vérificateur : ${n} problème(s) dans le code de l'app` : `Vérificateur : aucun problème dans ${FILES.length} fichiers`);
process.exit(n ? 1 : 0);
