import { test } from "node:test";
import assert from "node:assert/strict";
import { numberToFrench, speakable } from "../lib/speak.mjs";
import { buildTiming } from "../lib/timing.mjs";
import { validateStory } from "../lib/story.mjs";
import fs from "node:fs";

test("nombres en toutes lettres", () => {
  const cas = { 0: "zéro", 21: "vingt et un", 71: "soixante et onze", 80: "quatre-vingts", 91: "quatre-vingt-onze",
    200: "deux cents", 243: "deux cent quarante-trois", 1000: "mille", 36000: "trente-six mille",
    200000: "deux cent mille", 1000000: "un million", 3333360: "trois millions trois cent trente-trois mille trois cent soixante" };
  for (const [n, s] of Object.entries(cas)) assert.equal(numberToFrench(+n), s);
});

test("texte prêt pour la voix", () => {
  assert.equal(speakable("36 000 €"), "trente-six mille euros");
  assert.equal(speakable("7 % par an"), "sept pour cent par an");
  assert.equal(speakable("465 °C"), "quatre cent soixante-cinq degrés");
  assert.equal(speakable("1 €"), "un euro");
});

test("minutage : scènes bout à bout, mots dans l'ordre, nombres groupés", () => {
  const story = { scenes: [{ say: "Tu as mis 36 000 € de côté." }, { say: "Point final." }] };
  const t = buildTiming(story, [2, 1]);
  assert.equal(t.scenes[0].start, 0);
  assert.equal(t.scenes[1].start, t.scenes[0].end);
  assert.ok(t.total > 3);
  assert.ok(t.words.some((w) => w.text === "36 000 €"));
  for (let i = 1; i < t.words.length; i++) assert.ok(t.words[i].start >= t.words[i - 1].start);
});

test("tous les scénarios fournis sont valides", () => {
  for (const f of fs.readdirSync(new URL("../stories", import.meta.url))) {
    const s = JSON.parse(fs.readFileSync(new URL("../stories/" + f, import.meta.url), "utf8"));
    assert.doesNotThrow(() => validateStory(s), f);
  }
});

test("un scénario invalide est refusé avec un message clair", () => {
  assert.throws(() => validateStory({ id: "X X", title: "", style: "film", scenes: [] }), /id.*\n.*title.*\n.*style/s);
});
