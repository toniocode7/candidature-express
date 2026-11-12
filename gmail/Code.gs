/**
 * Candidature Express : lien entre ton Gmail et l'app.
 *
 * Toutes les 15 minutes, ce script :
 *  1. cherche dans ton Gmail les mails qui parlent de candidature, d'entretien ou de recrutement
 *     (les promotions, réseaux sociaux et alertes d'offres sont ignorés) ;
 *  2. les envoie à ta base privée, où l'app les relie à tes candidatures et met à jour les statuts ;
 *  3. crée dans Gmail les brouillons de réponse que tu as demandés depuis l'app.
 *
 * Seuls ces mails-là quittent ta boîte, et uniquement vers ta base privée.
 * Installation : colle ta phrase secrète ci-dessous, enregistre, puis lance « installer » une fois.
 */

const PHRASE_SECRETE = "COLLE-ICI-TA-PHRASE-SECRETE";
const ADRESSE = "https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/mailin";

const RECHERCHE = '-in:sent -category:promotions -category:social '
  + '-from:jobs-noreply@linkedin.com -from:jobalerts-noreply@linkedin.com -from:alert@indeed.com '
  + '-from:notification@emails.hellowork.com -from:emploi@emails.hellowork.com '
  + '(candidature OR application OR postuler OR poste OR position OR recrutement OR recruitment OR entretien '
  + 'OR interview OR profil OR profile OR "suite à" OR malheureusement OR unfortunately OR regret OR retenue '
  + 'OR "move forward" OR échange OR rencontre)';
const RECHERCHE_HELLOWORK = 'from:emails.hellowork.com subject:(réponse OR candidature OR recruteur)';

function appeler_(corps) {
  const r = UrlFetchApp.fetch(ADRESSE, {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { "x-ce-mail-key": PHRASE_SECRETE }, payload: JSON.stringify(corps)
  });
  if (r.getResponseCode() !== 200) throw new Error("Réponse " + r.getResponseCode() + " : " + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}

function message_(m, moi) {
  const de = m.getFrom();
  const email = ((de.match(/<([^>]+)>/) || [])[1] || de).trim().toLowerCase();
  const nom = de.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
  const texte = m.getPlainBody() || "";
  return {
    id: m.getId(), threadId: m.getThread().getId(), sender: email,
    addressDisplayNames: [{ emailAddress: email, displayName: nom }],
    subject: m.getSubject(), internalDate: String(m.getDate().getTime()), date: m.getDate().toISOString(),
    viewUrl: "https://mail.google.com/mail/u/0/#all/" + m.getThread().getId(),
    labelIds: email === moi ? ["SENT"] : [], plaintextBody: texte.slice(0, 8000), snippet: texte.slice(0, 200)
  };
}

/** Lancé automatiquement toutes les 15 minutes. */
function synchroniser() {
  const moi = Session.getActiveUser().getEmail().toLowerCase();
  const prop = PropertiesService.getScriptProperties();
  const dernier = +prop.getProperty("dernier") || (Date.now() - 60 * 864e5);
  const depuis = new Date(dernier - 2 * 864e5);
  const apres = "after:" + Utilities.formatDate(depuis, "Europe/Paris", "yyyy/MM/dd") + " ";
  const vus = {}, envoi = [];
  [RECHERCHE, RECHERCHE_HELLOWORK].forEach(function (q) {
    GmailApp.search(apres + q, 0, 100).forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (vus[m.getId()] || m.getDate().getTime() < depuis.getTime()) return;
        vus[m.getId()] = 1;
        const x = message_(m, moi);
        if (x.sender !== moi) envoi.push(x);
      });
    });
  });
  for (let i = 0; i < envoi.length; i += 50) appeler_({ action: "mails", mails: envoi.slice(i, i + 50) });
  prop.setProperty("dernier", String(Date.now()));

  // Brouillons demandés depuis l'app.
  const d = appeler_({ action: "drafts" }).drafts || [];
  const faits = [];
  d.forEach(function (b) {
    try {
      const x = b.data || {};
      const a = (x.to || [])[0] || "";
      if (x.replyToMessageId) {
        const m = GmailApp.getMessageById(x.replyToMessageId);
        if (m) { m.createDraftReply(x.body || ""); faits.push(b.id); return; }
      }
      GmailApp.createDraft(a, x.subject || "", x.body || "");
      faits.push(b.id);
    } catch (e) { console.log("Brouillon impossible : " + e); }
  });
  if (faits.length) appeler_({ action: "draft_done", ids: faits });
  console.log(envoi.length + " mail(s) transmis, " + faits.length + " brouillon(s) créé(s).");
}

/** À lancer une seule fois : vérifie la connexion et programme le passage toutes les 15 minutes. */
function installer() {
  if (PHRASE_SECRETE.indexOf("COLLE-ICI") === 0) throw new Error("Colle d'abord ta phrase secrète en haut du script, puis enregistre.");
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "synchroniser") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("synchroniser").timeBased().everyMinutes(15).create();
  synchroniser();
  console.log("Installation terminée : le script tournera toutes les 15 minutes.");
}
