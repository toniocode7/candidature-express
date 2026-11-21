// Heure de Paris (0 à 23) sous forme de nombre. Attention : en français, Intl écrit « 06 h », qui n'est pas un nombre ;
// on lit donc la partie « heure » d'un format sans texte autour. Testé dans tests/unit.cjs.
export function heureParis(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
  return Number((p.find((x) => x.type === "hour") || { value: "NaN" }).value);
}
