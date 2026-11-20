/* Candidature Express : offres récoltées en arrière-plan et état des sources.
   La récolte tourne sur GitHub plusieurs fois par jour ; l'app (sur ton téléphone,
   ton Mac ou le robot) trie ensuite ces offres avec tes règles habituelles. */
(function () {
  "use strict";
  var PENDING = [];
  function sb() { return window.CE && window.CE.supabase; }

  // « Nouvelle recherche » touchée par toi : lance aussi tout de suite une récolte complète sur tous les sites.
  // Jamais depuis la recherche automatique elle-même (window.CE_BG), sinon elle se relancerait sans fin.
  async function runNow() {
    window.CE_RUN_MSG = "";
    if (window.CE_BG || !window.CE_AI) return;
    try {
      var j = await window.CE_AI.call("run", {});
      window.CE_RUN_MSG = j.deja ? "Une récolte complète est déjà en cours (lancée il y a " + (j.depuis || 1) + " min) : les nouvelles offres arriveront avec une notification."
        : "Récolte complète lancée sur tous les sites : les nouvelles offres arriveront d'ici 5 à 15 minutes, avec une notification.";
    } catch (e) {
      // Clé GitHub absente : le tri habituel suffit. Clé refusée (expirée, supprimée) : on le dit.
      if (e && e.code === "github") window.CE_RUN_MSG = "La récolte complète n'a pas pu être lancée : la clé GitHub a sans doute expiré. Les offres seront récoltées à la prochaine recherche automatique ; refais la clé quand tu peux (guide, section « Recherche à la demande »).";
    }
  }

  window.CE_RAW = async function () {
    var c = sb(); if (!c) throw Object.assign(new Error("hors connexion"), { code: "hors connexion" });
    await runNow();
    var since = new Date(Date.now() - 45 * 864e5).toISOString();
    var lastAuto = 0, lastAll = 0;
    try { var d = await c.from("docs").select("data").eq("col", "ce").eq("id", "sources").maybeSingle(); lastAuto = d.data && d.data.data && d.data.data._run ? d.data.data._run.at : 0; } catch (e) {}
    try { lastAll = (window.CE_doc && ((await window.CE_doc.get("evalall")) || {}).at) || 0; } catch (e) {}
    window.CE_LAST_AUTO = lastAuto;
    // Critères changés depuis le dernier tri complet : toutes les offres récentes repassent au tri, pas seulement les inédites.
    var crit = 0; try { crit = +(window.CE_crit && window.CE_crit.SG().critAt) || 0; } catch (e) {}
    var all = crit > Math.max(lastAuto, lastAll), win = 14;
    try { win = Math.max(7, +window.CE_crit.SETV().win || 14); } catch (e) {}
    var q = c.from("raw_offers").select("id,data,last_seen");
    q = all ? q.gte("last_seen", new Date(Date.now() - win * 864e5).toISOString()).limit(1000) : q.is("evaluated_at", null).gte("last_seen", since).limit(600);
    var r = await q.order("last_seen", { ascending: false });
    if (r.error) throw Object.assign(new Error(r.error.message), { code: "base" });
    PENDING = (r.data || []).map(function (x) { return x.id; });
    window.CE_RAW_N = PENDING.length;
    window.CE_RAW_ALL = all;
    if (all) { try { await window.CE_doc.set("evalall", { at: Date.now() }); } catch (e) {} }
    return (r.data || []).map(function (x) { return JSON.parse(JSON.stringify(x.data)); });
  };

  // Texte complet d'une annonce, gardé lors de la récolte (utile quand le site bloque la lecture, comme Indeed).
  window.CE_storedAd = async function (url) {
    var c = sb(); if (!c || !url) return "";
    var r = await c.from("raw_offers").select("data,full_text").eq("data->>url", url).not("full_text", "is", null).limit(1);
    var x = r.data && r.data[0]; if (!x || !x.full_text || x.full_text.length < 300) return "";
    var d = x.data || {};
    var head = [d.titre, d.entreprise, d.lieu, d.contrat, d.salaire].filter(Boolean).join(" · ");
    return (head ? head + "\n\n" : "") + x.full_text;
  };

  window.CE_RAW_DONE = async function (ok, msg, nouvelles) {
    var ids = PENDING; PENDING = [];
    if (ok && ids.length && sb()) {
      var at = new Date().toISOString();
      for (var i = 0; i < ids.length; i += 100) {
        try { await sb().from("raw_offers").update({ evaluated_at: at }).in("id", ids.slice(i, i + 100)); } catch (e) {}
      }
    }
    // Annonces déjà affichées dont l'expérience demandée n'a pas encore été lue sur la page complète.
    try { if (window.CE_fpBackfill) await window.CE_fpBackfill(); } catch (e) {}
    try { if (window.CE_xpBackfill) await window.CE_xpBackfill(25); } catch (e) {}
    if (window.CE_RUN_MSG) { var el = document.getElementById("sgn"); if (el) el.textContent = (el.textContent ? el.textContent + " " : "") + window.CE_RUN_MSG; window.CE_RUN_MSG = ""; }
    window.CE_LAST_RUN = { done: true, ok: !!ok, msg: String(msg || ""), nouvelles: +nouvelles || 0, triees: ids.length };
    try { window.CE_srcUI(); } catch (e) {}
  };

  // Message quand la recherche lancée à la main ne trouve rien à trier : la recherche automatique est passée juste avant.
  window.CE_noNewMsg = function () {
    if (!window.CE_RAW || window.CE_RAW_N !== 0) return "";
    var t = window.CE_LAST_AUTO, h = +new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(new Date());
    var ago = t ? Math.max(1, Math.round((Date.now() - t) / 60000)) : 0, next = (Math.floor(h / 6) + 1) * 6 % 24;
    return "Rien de neuf à trier : la recherche automatique" + (ago ? " d'il y a " + (ago < 60 ? ago + " min" : Math.round(ago / 60) + " h") : "") +
      " a déjà récolté et trié toutes les offres disponibles (elle passe à 0 h, 6 h, 12 h et 18 h). Prochain passage à " + next + " h.";
  };

  var LABEL = { francetravail: "France Travail", indeed: "Indeed", linkedin: "LinkedIn", hellowork: "HelloWork", meteojob: "Meteojob", carrieres: "Sites carrières" };
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return "il y a " + Math.max(1, m) + " min";
    var h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h";
    return "il y a " + Math.round(h / 24) + " j";
  }
  window.CE_srcUI = async function () {
    var el = document.getElementById("cesrc"); if (!el || !sb()) return;
    var r = await sb().from("docs").select("data").eq("col", "ce").eq("id", "sources").maybeSingle();
    var st = r.data && r.data.data; if (!st) { el.hidden = true; return; }
    var parts = Object.keys(LABEL).filter(function (k) { return st[k]; }).map(function (k) {
      var s = st[k], okc = s.ok ? "ok" : "ko";
      return '<span class="cesr ' + okc + '" title="' + (s.ok ? (s.n || 0) + " offres, " + ago(s.at) : "En pause : " + String(s.err || "").replace(/"/g, "") + ". Nouvel essai automatique au prochain passage.") + '"><i></i>' + LABEL[k] + "</span>";
    });
    var run = st._run && st._run.at ? "Dernière recherche automatique " + ago(st._run.at) + ". " : "";
    el.innerHTML = run + '<span class="cesrl">' + parts.join("") + "</span>";
    el.hidden = !parts.length;
  };
})();
