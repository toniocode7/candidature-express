/**
 * Candidature Express : sauvegarde automatique dans ton Google Drive.
 *
 * Chaque dimanche matin, une copie complète de tes données (candidatures, analyses, CV, réglages)
 * est déposée dans le dossier « Candidature Express - Sauvegardes » de ton Drive.
 * Les 8 dernières sont gardées (2 mois). Pour restaurer : Paramètres de l'app, « Restaurer une sauvegarde ».
 *
 * Ce fichier s'ajoute à côté de Code.gs (il utilise sa phrase secrète). Installation : enregistre,
 * puis lance « installerSauvegarde » une fois et accepte l'accès à Google Drive.
 */

const DOSSIER_SAUVEGARDES = "Candidature Express - Sauvegardes";
const SAUVEGARDES_GARDEES = 8;

/** Lancé automatiquement chaque dimanche. */
function sauvegarder() {
  const d = appeler_({ action: "backup" });
  if (!d || !d.docs || !d.docs.length) throw new Error("Sauvegarde vide : rien n'a été enregistré.");
  const it = DriveApp.getFoldersByName(DOSSIER_SAUVEGARDES);
  const dossier = it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER_SAUVEGARDES);
  const nom = "Sauvegarde Candidature Express " + Utilities.formatDate(new Date(), "Europe/Paris", "yyyy-MM-dd") + ".json";
  dossier.createFile(nom, JSON.stringify(d), "application/json");
  const fichiers = [];
  const f = dossier.getFiles();
  while (f.hasNext()) fichiers.push(f.next());
  fichiers.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  fichiers.slice(SAUVEGARDES_GARDEES).forEach(function (x) { x.setTrashed(true); });
  console.log("Sauvegarde enregistrée : " + nom + " (" + d.candidatures + " candidatures).");
}

/** À lancer une seule fois : fait une première sauvegarde et programme la suivante chaque dimanche. */
function installerSauvegarde() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sauvegarder") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sauvegarder").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();
  sauvegarder();
  console.log("Installation terminée : une sauvegarde sera faite chaque dimanche matin.");
}
