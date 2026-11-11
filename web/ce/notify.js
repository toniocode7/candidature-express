/* Candidature Express : notifications, calendrier des entretiens, partage depuis Safari. */
(function () {
  "use strict";
  var CFG = window.CE_CONFIG || {};
  var FN = (CFG.supabaseUrl || "") + "/functions/v1/";
  var KINDS = [
    ["offres", "Nouvelle offre au-dessus de ta note minimale"],
    ["recruteur", "Réponse d'un recruteur"],
    ["statut", "Statut changé automatiquement"],
    ["entretien", "Rappel la veille et le jour d'un entretien"],
    ["objectif", "Objectif de la semaine pas atteint"]
  ];
  function sb() { return window.CE && window.CE.supabase; }
  function uid() { return window.CE && window.CE.user && window.CE.user.id; }
  function G(id) { return document.getElementById(id); }

  /* ---------- Événements à notifier (lus par le robot en arrière-plan) ---------- */
  window.CE_EVENTS = [];
  window.CE_EV = function (kind, title, body, url) { window.CE_EVENTS.push({ kind: kind, title: title, body: body, url: url || "./" }); };

  /* ---------- Réglages stockés dans la base ---------- */
  async function getDoc(id) {
    var r = await sb().from("docs").select("data").eq("col", "ce").eq("id", id).maybeSingle();
    return r.data ? r.data.data : null;
  }
  async function setDoc(id, data) {
    return sb().from("docs").upsert({ user_id: uid(), col: "ce", id: id, data: data, updated_at: new Date().toISOString() });
  }

  /* ---------- Abonnement de cet appareil ---------- */
  function b64ToBytes(s) {
    var t = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4), bin = atob(t), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function standalone() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
  async function subscribe() {
    var n = G("censt");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      n.textContent = /iPhone|iPad/.test(navigator.userAgent) && !standalone()
        ? "Sur iPhone, les notifications ne marchent que dans l'app installée sur l'écran d'accueil : ouvre-la depuis son icône."
        : "Ce navigateur ne permet pas les notifications.";
      return;
    }
    n.textContent = "Demande d'autorisation...";
    var perm = await Notification.requestPermission();
    if (perm !== "granted") { n.textContent = "Notifications refusées. Pour les réactiver : Réglages de l'iPhone, Notifications, Candidatures."; return; }
    var key = (await (await fetch(FN + "push", { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey }, body: JSON.stringify({ action: "vapid" }) })).json()).publicKey;
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    var j = sub.toJSON();
    var dev = /iPhone/.test(navigator.userAgent) ? "iPhone" : /Mac/.test(navigator.userAgent) ? "Mac" : "Autre";
    var r = await sb().from("push_subs").upsert({ endpoint: j.endpoint, keys: j.keys, device: dev });
    n.textContent = r.error ? "Enregistrement impossible : " + r.error.message : "Notifications activées sur cet appareil.";
    refresh();
  }
  async function test() {
    var n = G("censt"); n.textContent = "Envoi...";
    var s = await sb().auth.getSession(), tok = s.data.session ? s.data.session.access_token : "";
    var r = await (await fetch(FN + "push", { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "test" }) })).json();
    n.textContent = r.envoye ? "Notification envoyée à " + r.envoye + " appareil" + (r.envoye > 1 ? "s" : "") + "." : "Aucun appareil n'a reçu la notification. Active-les d'abord sur cet appareil.";
  }
  async function refresh() {
    var n = G("censt"); if (!n || !sb()) return;
    var on = false;
    try { var reg = await navigator.serviceWorker.getRegistration(); var s = reg && await reg.pushManager.getSubscription(); on = !!s && Notification.permission === "granted"; } catch (e) {}
    var c = await sb().from("push_subs").select("device");
    var devs = (c.data || []).map(function (x) { return x.device || "appareil"; });
    G("cenon").textContent = on ? "Réactiver sur cet appareil" : "Activer sur cet appareil";
    if (!n.dataset.busy) n.textContent = (on ? "Activées sur cet appareil. " : "Pas encore activées sur cet appareil. ") + (devs.length ? "Appareils abonnés : " + devs.join(", ") + "." : "");
    var p = Object.assign({ offres: true, recruteur: true, statut: true, entretien: true, objectif: true }, (await getDoc("notifs")) || {});
    document.querySelectorAll("[data-nf]").forEach(function (x) { x.checked = p[x.getAttribute("data-nf")] !== false; });
    calUI();
  }
  async function savePrefs() {
    var p = {}; document.querySelectorAll("[data-nf]").forEach(function (x) { p[x.getAttribute("data-nf")] = x.checked; });
    await setDoc("notifs", p);
  }

  /* ---------- Calendrier ---------- */
  async function calToken() {
    var d = await getDoc("cal");
    if (d && d.token) return d.token;
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    var t = Array.from(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    await setDoc("cal", { token: t });
    return t;
  }
  window.CE_ics = async function (id) {
    var w = window.open("about:blank", "_blank");
    try {
      for (var i = 0; i < 20 && window.CE_PENDING_SYNC && window.CE_PENDING_SYNC() > 0; i++) await new Promise(function (r) { setTimeout(r, 300); });
      var url = FN + "ics?k=" + (await calToken()) + "&id=" + encodeURIComponent(id);
      if (w) w.location.href = url; else location.href = url;
    } catch (e) { if (w) w.close(); alert("Impossible de préparer l'événement pour l'instant."); }
  };
  async function calUI() {
    var el = G("cecal"); if (!el) return;
    var t = await calToken();
    var feed = (CFG.supabaseUrl || "").replace(/^https:/, "webcal:") + "/functions/v1/ics?k=" + t;
    el.href = feed;
    G("cecalcp").onclick = function () { try { navigator.clipboard.writeText(feed.replace(/^webcal:/, "https:")); G("cecaln").textContent = "Lien copié."; } catch (e) {} };
  }

  /* ---------- Page « Notifications » des Paramètres ---------- */
  function build() {
    var box = document.querySelector('#pfbox .sp[data-p="notifs"]'); if (!box || box.dataset.ok) return;
    box.dataset.ok = 1;
    box.innerHTML = '<p class="spg">Sur cet appareil</p><div class="spgrp ceng"><div class="cenrow"><button type="button" class="sb pri" id="cenon">Activer sur cet appareil</button><button type="button" class="sb" id="cetest">Notification de test</button></div><p class="note" id="censt">...</p><p class="note">Sur iPhone, ouvre l\'app depuis son icône de l\'écran d\'accueil pour activer les notifications. Fais-le aussi sur le Mac pour les recevoir sur les deux.</p></div>' +
      '<p class="spg">Me prévenir pour</p><div class="spgrp ceng">' + KINDS.map(function (k) {
        return '<label class="prc swl cenk"><span>' + k[1] + '</span><input type="checkbox" class="sw" checked data-nf="' + k[0] + '"><i class="swt" aria-hidden="true"></i></label>';
      }).join("") + '</div>' +
      '<p class="spg">Calendrier</p><div class="spgrp ceng"><p class="note">Chaque entretien a un bouton « Ajouter au Calendrier ». Tu peux aussi abonner ton Calendrier à tous tes entretiens : ils y apparaissent et se mettent à jour tout seuls.</p><div class="cenrow"><a class="sb sec" id="cecal" href="#">S\'abonner au calendrier des entretiens</a><button type="button" class="sb" id="cecalcp">Copier le lien</button></div><p class="note" id="cecaln"></p></div>';
    G("cenon").onclick = function () { subscribe().catch(function (e) { G("censt").textContent = "Activation impossible : " + (e && e.message || e); }); };
    G("cetest").onclick = function () { test().catch(function () { G("censt").textContent = "Envoi impossible pour l'instant."; }); };
    box.querySelectorAll("[data-nf]").forEach(function (x) { x.onchange = savePrefs; });
  }
  window.CE_notifUI = function () { build(); refresh().catch(function () {}); };

  /* ---------- Annonce partagée depuis Safari, LinkedIn, Indeed (Raccourci iOS) ---------- */
  window.CE_handleShare = function () {
    var q = new URLSearchParams(location.search), s = q.get("share") || q.get("url") || q.get("text");
    if (!s) return;
    history.replaceState(null, "", location.pathname);
    var m = /https?:\/\/[^\s<>"']+/i.exec(s);
    var nav = document.querySelectorAll(".bnav button")[1]; if (nav) nav.click();
    setTimeout(function () {
      if (m) { var u = G("url"); if (u) { u.value = m[0]; u.dispatchEvent(new Event("input")); } var gl = G("golink"); if (gl) gl.click(); }
      else { var t = G("txt"); if (t) { t.value = s; t.dispatchEvent(new Event("input")); } var go = G("go"); if (go) go.click(); }
    }, 600);
  };
})();
