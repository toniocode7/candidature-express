// Outils de test : extrait des fonctions de web/app.js (enveloppé dans une fonction) pour les tester seules.
const fs = require("fs"), path = require("path"), acorn = require("acorn");
const SRC = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8").replace("{{AFF}}", "{}");
const AST = acorn.parse(SRC, { ecmaVersion: 2022, allowReturnOutsideFunction: true });
const TOP = AST.body[0].expression.callee.body.body;
function pick(names) {
  const parts = [];
  for (const st of TOP) {
    if (st.type === "FunctionDeclaration" && names.includes(st.id.name)) parts.push(SRC.slice(st.start, st.end));
    if (st.type === "VariableDeclaration") for (const d of st.declarations) if (d.id.name && names.includes(d.id.name)) parts.push("var " + SRC.slice(d.start, d.end) + ";");
  }
  return new Function(parts.join("\n") + "\nreturn {" + names.join(",") + "};")();
}
let fails = 0, n = 0;
function eq(label, got, want) {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log("ÉCHEC", label, "→ obtenu", JSON.stringify(got), "attendu", JSON.stringify(want)); }
}
function done(name) { console.log(`${name} : ${n - fails}/${n} réussis`); if (fails) process.exitCode = 1; }
module.exports = { pick, eq, done };
