// Tests des règles de l'app : expérience exigée, salaire, annonces closes, preuves des mails.
const { pick, eq, done } = require("./lib.cjs");
const F = pick(["XPN", "xpScan", "salOf", "GONE", "norm", "mlProof", "ML_ACK"]);

// Expérience : exigée écarte, souhaitée non
for (const [t, h, s] of [
  ["Expérience exigée de 4 ans dans un poste similaire.", 4, 0],
  ["Vous justifiez d'au moins 7 ans d'expérience en Supply Chain.", 7, 0],
  ["Idéalement 5 ans d'expérience sur un poste similaire.", 0, 5],
  ["3 à 8 ans d'expérience en Supply Chain industrielle.", 0, 3],
  ["Minimum 5 years of relevant experience required.", 5, 0],
  ["Armor-lux c'est près de 90 ans d'expérience.", 0, 0],
  ["Avoir moins de 30 ans à la date de signature du contrat.", 0, 0],
  ["Expérience : 5 An(s) - Expérience exigée", 5, 0],
  ["Vous justifiez d'au moins 7 ans d'expérience en supply chain, idéalement dans l'aéronautique.", 7, 0],
]) { const r = F.xpScan(t); eq("expérience : " + t, [r.hard, r.soft], [h, s]); }

// Salaire en k€ brut annuel
for (const [t, w] of [
  ["32 - 48 k€ brut annuel", [32, 48]], ["2 500 € / mois", [30, 30]], ["De 2 000 € à 2 400 € par mois", [24, 28.8]],
  ["Annuel de 32000,00 Euros à 38000,00 Euros", [32, 38]], ["£30,000 - £35,000", null], ["Selon profil", null], ["13ème mois, 35h", null],
]) { const r = F.salOf(t); eq("salaire : " + t, r && [Math.round(r.lo * 10) / 10, Math.round(r.hi * 10) / 10], w); }

// Annonces closes : seules les vraies négations
for (const [t, w] of [
  ["Cette offre est disponible en CDI à Brest", false], ["Réf. 2404 - Acheteur", false], ["Cette offre n'est plus disponible", true],
  ["Date de clôture des candidatures : 30/11", false], ["Les candidatures sont clôturées", true], ["No longer accepting applications", true],
]) eq("annonce close : " + t, F.GONE.test(t), w);

// Mails : un accusé de réception n'est jamais un refus
const ack = { subj: "Votre candidature", body: "Nous avons bien reçu votre candidature. Sans réponse de notre part sous 4 semaines, considérez que votre candidature n'a pas été retenue." };
const ref = { subj: "Suite à votre candidature", body: "Après étude, nous sommes au regret de vous informer que votre candidature n'a pas été retenue pour ce poste." };
eq("preuve conditionnelle refusée", F.mlProof(ack, "Sans réponse de notre part sous 4 semaines, considérez que votre candidature n'a pas été retenue", "refus").ok, false);
eq("vraie preuve acceptée", F.mlProof(ref, "nous sommes au regret de vous informer que votre candidature n'a pas été retenue pour ce poste", "refus").ok, true);
eq("preuve inventée refusée", F.mlProof(ref, "Votre profil ne correspond pas à nos attentes", "refus").ok, false);
eq("accusé de réception reconnu", F.ML_ACK.test(F.norm(ack.subj + " " + ack.body)), true);
eq("vrai refus non pris pour un accusé", F.ML_ACK.test(F.norm(ref.subj + " " + ref.body)), false);
for (const t of ["Confirmation de votre candidature - Acheteur", "Your application was sent to Alpha", "Merci pour votre candidature"])
  eq("accusé de réception : " + t, F.ML_ACK.test(F.norm(t)), true);
done("Règles de l'app");
