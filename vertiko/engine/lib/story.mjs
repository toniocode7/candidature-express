// Format d'un scénario Vertiko (écrit par l'IA, relu par l'utilisateur).
export const STYLES = ["3d", "toon", "schema"];
export const KINDS = ["title", "emoji", "counter", "bars", "compare", "steps", "fact", "question"];

export function validateStory(s) {
  const errs = [];
  if (!s || typeof s !== "object") throw new Error("Scénario vide");
  if (!/^[a-z0-9-]+$/.test(s.id || "")) errs.push("id : lettres minuscules, chiffres et tirets");
  if (!s.title) errs.push("title manquant");
  if (!STYLES.includes(s.style)) errs.push(`style : ${STYLES.join(", ")}`);
  if (!Array.isArray(s.scenes) || s.scenes.length < 2) errs.push("au moins 2 scènes");
  (s.scenes || []).forEach((sc, i) => {
    if (!sc.say || sc.say.length < 3) errs.push(`scène ${i + 1} : texte « say » manquant`);
    const k = sc.visual?.kind;
    if (k && !KINDS.includes(k)) errs.push(`scène ${i + 1} : type « ${k} » inconnu (${KINDS.join(", ")})`);
    if (k === "bars" && !(sc.visual.items?.length >= 2)) errs.push(`scène ${i + 1} : « bars » demande au moins 2 éléments`);
    if (k === "counter" && typeof sc.visual.to !== "number") errs.push(`scène ${i + 1} : « counter » demande un nombre « to »`);
    if (k === "compare" && !(sc.visual.left && sc.visual.right)) errs.push(`scène ${i + 1} : « compare » demande left et right`);
  });
  const words = (s.scenes || []).reduce((n, sc) => n + (sc.say || "").split(/\s+/).length, 0);
  if (words > 190) errs.push(`texte trop long (${words} mots, 190 max pour rester sous ~60 s)`);
  if (errs.length) throw new Error("Scénario invalide :\n - " + errs.join("\n - "));
  return true;
}
