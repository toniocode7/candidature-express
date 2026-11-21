/* Journal des erreurs : un plantage de l'app est noté discrètement dans ta base privée (table app_errors),
   pour être repéré et corrigé sans que tu aies à le décrire. Rien n'est envoyé ailleurs.
   Chargé en premier : les erreurs du démarrage sont gardées en attente, puis envoyées une fois connecté. */
(function () {
  "use strict";
  var VER = "dev"; // remplacé par le numéro de version à la publication
  var DEMO = /[?&]demo\b/.test(location.search);
  var Q = {}, SEEN = 0, MAX = 30, timer = null;
  // Bruits sans rapport avec le code : coupure réseau, extensions, erreurs de scripts d'autres sites.
  var NOISE = /^Script error\.?$|ResizeObserver loop|Load failed|Failed to fetch|NetworkError|network error|The network connection was lost|AbortError|The operation was aborted|cancelled|annulé|Importing a module script failed|The Internet connection appears to be offline/i;

  function where(file, line, col) {
    var f = String(file || "").split("?")[0].split("/").pop();
    return f ? f + (line ? ":" + line + (col ? ":" + col : "") : "") : "";
  }
  function stackTop(st) {
    // Les 4 premières lignes utiles de la pile, sans les adresses complètes.
    return String(st || "").split("\n").map(function (l) { return l.replace(/https?:\/\/[^\s)]*\//g, "").trim(); })
      .filter(Boolean).slice(0, 5).join("\n");
  }
  function view() {
    try { return (document.querySelector(".tab.on, [aria-selected=true]") || {}).textContent || ""; } catch (e) { return ""; }
  }
  function add(msg, src, stack) {
    msg = String(msg || "").replace(/\s+/g, " ").trim();
    if (!msg || NOISE.test(msg) || SEEN >= MAX) return;
    if (window.CE_BG) src = "auto · " + src;
    var k = msg + "|" + src;
    if (Q[k]) { Q[k].n++; } else { SEEN++; Q[k] = { msg: msg, src: src, n: 1, ctx: [stackTop(stack), view().trim().slice(0, 40), navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 120)].filter(Boolean).join("\n") }; }
    schedule(4000);
  }
  function schedule(ms) { if (!timer) timer = setTimeout(flush, ms); }
  function flush() {
    timer = null;
    var ce = window.CE, sb = ce && ce.supabase;
    if (DEMO || !Object.keys(Q).length) return;
    if (!sb || !ce.user || navigator.onLine === false) { schedule(15000); return; }
    var items = Object.keys(Q).map(function (k) { var x = Q[k]; delete Q[k]; return x; });
    items.forEach(function (x) {
      sb.rpc("ce_log_error", { p_msg: x.msg, p_src: x.src, p_ver: VER, p_ctx: x.ctx, p_n: x.n }).then(function (r) {
        if (r && r.error) console.warn("Journal des erreurs :", r.error.message);
      }, function () {});
    });
  }

  window.addEventListener("error", function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) return; // image ou feuille non chargée : pas un bug
    add(e.message || (e.error && e.error.message), where(e.filename, e.lineno, e.colno), e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    add(r && (r.message || r.error_description) || String(r), "promesse", r && r.stack);
  });
  window.addEventListener("pagehide", flush);
  // Pour signaler une erreur attrapée volontairement dans le code : CE_err(e, "analyse")
  window.CE_err = function (e, src) { add(e && e.message || String(e), src || "", e && e.stack); };
  window.CE_ERR_VER = VER;
})();

/* Liste des erreurs dans Réglages > Aide. */
window.CE_errUI = function () {
  var box = document.getElementById("errl"), ce = window.CE, sb = ce && ce.supabase;
  if (!box) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  if (!sb) { box.innerHTML = '<p class="note">Disponible une fois connecté.</p>'; return; }
  box.innerHTML = '<p class="note">Chargement...</p>';
  var since = new Date(Date.now() - 7 * 864e5).toISOString();
  sb.from("app_errors").select("id,msg,src,ver,n,first,last").gte("last", since).order("last", { ascending: false }).limit(20).then(function (r) {
    if (r.error) { box.innerHTML = '<p class="note">Journal indisponible pour l\'instant.</p>'; return; }
    var rows = r.data || [];
    if (!rows.length) { box.innerHTML = '<p class="note">Aucune erreur ces 7 derniers jours.</p>'; return; }
    box.innerHTML = rows.map(function (x) {
      var d = new Date(x.last);
      return '<div class="eri"><b>' + esc(x.msg) + '</b><small>' + esc(x.src || "") + ' · ' + x.n + ' fois · dernière le ' +
        d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ' à ' + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
        (x.ver ? ' · version ' + esc(x.ver) : '') + '</small></div>';
    }).join("") + '<div class="row"><button type="button" class="sb sec" id="errclr">Effacer la liste (une fois corrigé)</button></div>';
    document.getElementById("errclr").onclick = function () {
      sb.from("app_errors").delete().gt("id", 0).then(function () { window.CE_errUI(); });
    };
  });
};
