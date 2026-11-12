/* Candidature Express : offres récoltées en arrière-plan et état des sources.
   La récolte tourne sur GitHub plusieurs fois par jour ; l'app (sur ton téléphone,
   ton Mac ou le robot) trie ensuite ces offres avec tes règles habituelles. */
(function () {
  "use strict";
  var PENDING = [];
  function sb() { return window.CE && window.CE.supabase; }

  window.CE_RAW = async function () {
    var c = sb(); if (!c) throw Object.assign(new Error("hors connexion"), { code: "hors connexion" });
    var since = new Date(Date.now() - 45 * 864e5).toISOString();
    var r = await c.from("raw_offers").select("id,data,last_seen").is("evaluated_at", null).gte("last_seen", since).order("last_seen", { ascending: false }).limit(600);
    if (r.error) throw Object.assign(new Error(r.error.message), { code: "base" });
    PENDING = (r.data || []).map(function (x) { return x.id; });
    return (r.data || []).map(function (x) { return JSON.parse(JSON.stringify(x.data)); });
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
    try { if (window.CE_xpBackfill) await window.CE_xpBackfill(25); } catch (e) {}
    window.CE_LAST_RUN = { done: true, ok: !!ok, msg: String(msg || ""), nouvelles: +nouvelles || 0, triees: ids.length };
    try { window.CE_srcUI(); } catch (e) {}
  };

  var LABEL = { francetravail: "France Travail", indeed: "Indeed", linkedin: "LinkedIn", hellowork: "HelloWork", wttj: "Welcome to the Jungle", apec: "Apec", meteojob: "Meteojob" };
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
      return '<span class="cesr ' + okc + '" title="' + (s.ok ? (s.n || 0) + " offres, " + ago(s.at) : "En pause : " + String(s.err || "").replace(/"/g, "") + ". Nouvel essai automatique dans l'heure.") + '"><i></i>' + LABEL[k] + "</span>";
    });
    var run = st._run && st._run.at ? "Dernière recherche automatique " + ago(st._run.at) + ". " : "";
    el.innerHTML = run + '<span class="cesrl">' + parts.join("") + "</span>";
    el.hidden = !parts.length;
  };
})();
