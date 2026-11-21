// Tests des règles de l'app : expérience exigée, salaire, annonces closes, preuves des mails.
const { pick, eq, done } = require("./lib.cjs");
const F = pick(["XPN", "xpScan", "salOf", "GONE", "norm", "mlProof", "ML_ACK", "fpHash", "FPSTOP", "fpOf", "fpAll", "fpInside", "fpSim"]);

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
// Même offre sur deux sites : reconnue par le texte ; deux offres différentes : jamais confondues
const A = "Rattaché au responsable achats, vous pilotez un portefeuille de fournisseurs industriels : consultation, négociation des prix et des délais, suivi des commandes et relance des retards. Vous participez à la sélection de nouveaux fournisseurs et mettez à jour les tableaux de bord. Profil : Bac+5 achats, anglais professionnel, SAP.";
const B = "Au sein du service logistique, vous organisez les expéditions internationales : choix des transporteurs, préparation des documents douaniers, suivi des livraisons et gestion des litiges. Vous travaillez avec les commerciaux et le service client. Profil : Bac+3 transport, anglais courant.";
eq("même texte, autre site", F.fpInside(F.fpOf("Offre publiée par une agence pour son client. " + A), F.fpAll(A)) >= 0.6, true);
eq("annonces différentes", F.fpInside(F.fpOf(B), F.fpAll(A)) < 0.2, true);
eq("empreinte identique à la récolte (référence)", JSON.stringify(F.fpOf(require("./fixtures/fp_ref.json").text)), JSON.stringify(require("./fixtures/fp_ref.json").fp));
// Note : un critère que l'annonce ne demande pas sort de la note
const C = pick(["norm", "CRIT_ABS", "LANGW", "critGuard"]);
const crit = (id, pq) => ({ id, note: 1, na: false, pourquoi: pq });
let g = C.critGuard({ criteres: [crit("langues", "Le poste ne requiert pas de langue étrangère, mais tu as un bon niveau d'anglais."), crit("outils", "L'annonce ne cite pas d'outil spécifique, mais tu maîtrises SAP.")] }, "Anglais courant apprécié");
eq("langue non demandée exclue", g.criteres[0].na, true);
eq("outil non cité exclu", g.criteres[1].na, true);
g = C.critGuard({ criteres: [crit("langues", "L'anglais courant est exigé et tu as un niveau C1.")] }, "Anglais courant exigé.");
eq("langue exigée gardée", g.criteres[0].na, false);
g = C.critGuard({ criteres: [crit("langues", "Tu parles anglais.")] }, "Gestion des commandes fournisseurs, suivi des stocks, relances.");
eq("annonce sans aucune langue : critère exclu", g.criteres[0].na, true);
g = C.critGuard({ criteres: [crit("experience", "L'annonce ne demande pas d'expérience particulière.")] }, "Débutant accepté.");
eq("expérience non demandée : note pleine", [g.criteres[0].na, g.criteres[0].note], [false, 4]);

// Salaire conseillé : prétentions cohérentes avec l'offre
const S = pick(["norm", "esc", "dInfo", "kfmt", "mfmt", "SALF", "MPU", "RHU", "SALR", "SALX", "COL", "COLX", "WISE", "REGCITY", "HOMEKM", "salHome", "salCol", "AFF", "salPerso", "salFam", "salReg", "salParse", "salAI", "salCalc", "salHtml"]);
const pret = (h) => +(/prétentions : <b>([\d,]+) k€/.exec(h) || [0, "0"])[1].replace(",", ".");
const off = (salaire, m, poste, lieu) => ({ id: "x", an: { poste, lieu, contrat: "CDI", salaire, score: 70, salaire_marche: m } });
let h = S.salHtml(off("30 - 35 k€ brut annuel", { bas: 40, haut: 44, explication: "" }, "Chargé de mission logistique", "Paris"));
eq("offre sous le marché : jamais plus que leur maximum", pret(h) <= 35, true);
h = S.salHtml(off("", { bas: 30, haut: 36, explication: "Marché réunionnais" }, "Agent de transit import export", "Le Port, La Réunion"));
eq("outre-mer : estimation affichée", /30 k€ à 36 k€/.test(h), true);
h = S.salHtml(off("38 - 42 k€", { bas: 34, haut: 40, explication: "" }, "Approvisionneur", "Brest"));
eq("offre dans le marché : prétentions dans leur fourchette", pret(h) >= 38 && pret(h) <= 42, true);
// Offre ancienne : mention à partir de 3 semaines en ligne, rien avant ni sans date
const AG = pick(["ageLine"]);
global.pubOf = (x) => x.pub;
eq("offre de 40 jours : mention", /En ligne depuis 40 jours/.test(AG.ageLine({ pub: Date.now() - 40 * 864e5 })), true);
eq("offre de 3 mois : plus de 2 mois", /plus de 2 mois/.test(AG.ageLine({ pub: Date.now() - 95 * 864e5 })), true);
eq("offre récente : rien", AG.ageLine({ pub: Date.now() - 5 * 864e5 }), "");
eq("date inconnue : rien", AG.ageLine({}), "");
done("Règles de l'app");
