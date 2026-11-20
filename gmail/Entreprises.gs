/**
 * Candidature Express : mails des entreprises et agences de tes candidatures.
 *
 * Code.gs ne transmet que les mails qui contiennent certains mots (candidature, entretien...).
 * Ce fichier transmet en plus, toutes les 15 minutes, les mails envoyés par les entreprises et agences
 * auxquelles tu as postulé, même sans ces mots (« Bonjour, pouvez-vous me rappeler ? »).
 * Seuls ces mails-là quittent ta boîte, et uniquement vers ta base privée.
 *
 * Installation : ajoute ce fichier à côté de Code.gs (il utilise sa phrase secrète), enregistre,
 * puis lance « installerEntreprises » une fois.
 */

function synchroniserEntreprises() {
  const rep = appeler_({ action: "senders" });
  const noms = (rep.noms || []).filter(function (n) { return n && n.length >= 3; });
  if (!noms.length) return;
  const prop = PropertiesService.getScriptProperties();
  const dernier = +prop.getProperty("dernierEntreprises") || (Date.now() - 30 * 864e5);
  const depuis = new Date(dernier - 2 * 864e5);
  const apres = "after:" + Utilities.formatDate(depuis, "Europe/Paris", "yyyy/MM/dd") + " ";
  const moi = Session.getActiveUser().getEmail().toLowerCase();
  const vus = {}, envoi = [];
  for (let i = 0; i < noms.length; i += 12) {
    const q = apres + "-in:sent -category:promotions -category:social from:(" +
      noms.slice(i, i + 12).map(function (n) { return '"' + n.replace(/"/g, "") + '"'; }).join(" OR ") + ")";
    GmailApp.search(q, 0, 50).forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (vus[m.getId()] || m.getDate().getTime() < depuis.getTime()) return;
        vus[m.getId()] = 1;
        const x = message_(m, moi);
        if (x.sender !== moi) envoi.push(x);
      });
    });
  }
  for (let i = 0; i < envoi.length; i += 50) appeler_({ action: "mails", mails: envoi.slice(i, i + 50) });
  prop.setProperty("dernierEntreprises", String(Date.now()));
  console.log(noms.length + " entreprises surveillées" + (rep.total > noms.length ? " (sur " + rep.total + ", les plus récentes en priorité)" : "") + ", " + envoi.length + " mail(s) transmis.");
}

/** À lancer une seule fois : première lecture, puis toutes les 15 minutes. */
function installerEntreprises() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "synchroniserEntreprises") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("synchroniserEntreprises").timeBased().everyMinutes(15).create();
  synchroniserEntreprises();
  console.log("Installation terminée : les mails de tes entreprises seront transmis toutes les 15 minutes.");
}
