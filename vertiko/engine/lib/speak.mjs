// Prépare un texte pour la voix : les chiffres sont écrits en toutes lettres (la voix les lit mal),
// les unités sont développées. Le texte affiché à l'écran, lui, garde les chiffres.

const U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const T = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

function below100(n) {
  if (n <= 16) return U[n];
  if (n < 20) return "dix-" + U[n - 10];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7) return n === 71 ? "soixante et onze" : "soixante-" + below100(10 + u);
  if (d === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + U[u];
  if (d === 9) return "quatre-vingt-" + below100(10 + u);
  if (u === 0) return T[d];
  if (u === 1) return T[d] + " et un";
  return T[d] + "-" + U[u];
}

function below1000(n) {
  const c = Math.floor(n / 100), r = n % 100;
  let s = "";
  if (c === 1) s = "cent";
  else if (c > 1) s = U[c] + (r === 0 ? " cents" : " cent");
  if (r) s += (s ? " " : "") + below100(r);
  return s || "zéro";
}

export function numberToFrench(n) {
  if (n === 0) return "zéro";
  if (n < 0) return "moins " + numberToFrench(-n);
  const parts = [];
  const units = [[1e9, "milliard"], [1e6, "million"], [1e3, "mille"]];
  for (const [v, name] of units) {
    const q = Math.floor(n / v);
    if (q) {
      if (name === "mille") parts.push(q === 1 ? "mille" : below1000(q).replace(/cents$/, "cent") + " mille");
      else parts.push(below1000(q) + " " + name + (q > 1 ? "s" : ""));
      n %= v;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

export function speakable(text) {
  let s = text
    .replace(/(\d)\s+(?=\d{3}\b)/g, "$1")            // 36 000 → 36000
    .replace(/(\d)\s?%/g, "$1 pour cent")
    .replace(/(\d)\s?°C/g, "$1 degrés")
    .replace(/(\d)\s?€/g, "$1 euros")
    .replace(/(\d)\s?km\/h/g, "$1 kilomètres heure")
    .replace(/(\d)\s?km\b/g, "$1 kilomètres")
    .replace(/(\d)\s?kg\b/g, "$1 kilos")
    .replace(/(\d)\s?M\b/g, "$1 millions")
    .replace(/\bvs\b/gi, "contre");
  s = s.replace(/(\d+),(\d+)/g, (_, a, b) => `${numberToFrench(+a)} virgule ${numberToFrench(+b)}`);
  s = s.replace(/\d+/g, (m) => numberToFrench(+m));
  return s.replace(/\bun euros\b/g, "un euro");
}
