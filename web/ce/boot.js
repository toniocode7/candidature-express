/* Candidature Express : couche d'application.
   Elle remplace le « runtime » de l'artefact Claude :
   - connexion privée et données (Supabase, synchro instantanée) ;
   - IA (Gemini via une fonction serveur, la clé ne quitte jamais Supabase) ;
   - téléchargements (feuille de partage sur iPhone, téléchargement sur Mac).
   Aucune donnée personnelle n'est écrite dans ce fichier public. */
(function () {
  "use strict";
  var CFG = window.CE_CONFIG || {};
  var LS = "candexp.";

  // Pas de zoom au pincement (Safari ignore « user-scalable=no ») ; la carte utilise ses propres gestes et n'est pas concernée.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener("touchmove", function (e) { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
  var DEMO = /[?&]demo\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var sb = null, USER = null, PERSO = null;

  /* ---------- Petits outils ---------- */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Texte inséré dans une chaîne du code de l'app : valable entre "", '' ou `` (le code publié est compressé
  // et peut changer de guillemets).
  function jsStr(s) { return JSON.stringify(String(s == null ? "" : s)).slice(1, -1).replace(/'/g, "\\'").replace(/`/g, "\\`").replace(/\$/g, "\\$"); }
  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }

  /* ---------- Écran d'accueil (connexion, import) ---------- */
  var gate = null;
  function showGate(html) {
    if (!gate) { gate = el("div", { class: "ce-gate", role: "dialog", "aria-modal": "true" }); document.body.appendChild(gate); }
    gate.innerHTML = '<div class="ce-card"><div class="ce-logo" aria-hidden="true"><svg viewBox="0 0 52 52"><rect width="52" height="52" rx="15" fill="#4338CA"/><path d="M33.5 17.2A12 12 0 1 0 33.5 34.8" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/><path d="M24 26h13.5M32.5 20.8L37.8 26l-5.3 5.2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' + html + "</div>";
    document.documentElement.classList.add("ce-gated");
    return gate;
  }
  function hideGate() { if (gate) { gate.remove(); gate = null; } document.documentElement.classList.remove("ce-gated"); }

  function loginScreen(msg) {
    return new Promise(function (resolve) {
      var g = showGate('<h1>Candidature <em>Express</em></h1><p class="ce-lead">Connexion privée. Une seule fois par appareil.</p>' +
        '<form class="ce-form"><label for="ce-mail">Adresse e-mail</label><input id="ce-mail" type="email" autocomplete="username" required>' +
        '<label for="ce-pw">Mot de passe</label><input id="ce-pw" type="password" autocomplete="current-password" required>' +
        '<button type="submit" class="main">Se connecter</button><button type="button" class="ce-link" id="ce-forgot">Mot de passe oublié ?</button><p class="ce-msg" role="status">' + esc(msg || "") + "</p></form>");
      var f = g.querySelector("form"), m = g.querySelector(".ce-msg");
      g.querySelector("#ce-forgot").onclick = async function () {
        var mail = g.querySelector("#ce-mail").value.trim();
        if (!/@/.test(mail)) { m.textContent = "Écris d'abord ton adresse e-mail ci-dessus."; g.querySelector("#ce-mail").focus(); return; }
        this.disabled = true; m.textContent = "Envoi...";
        var r = await sb.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname });
        this.disabled = false;
        m.textContent = r.error ? (/rate|seconds/i.test(r.error.message) ? "Trop de demandes, réessaie dans quelques minutes." : "Envoi impossible : " + r.error.message)
          : "Mail envoyé. Ouvre le lien qu'il contient sur cet appareil pour choisir un nouveau mot de passe.";
      };
      f.onsubmit = async function (ev) {
        ev.preventDefault();
        var b = f.querySelector("button"); b.disabled = true; m.textContent = "Connexion...";
        try {
          var r = await sb.auth.signInWithPassword({ email: g.querySelector("#ce-mail").value.trim(), password: g.querySelector("#ce-pw").value });
          if (r.error) throw r.error;
          resolve(r.data.user);
        } catch (e) {
          m.textContent = /invalid/i.test(e && e.message || "") ? "Adresse ou mot de passe incorrect." : "Connexion impossible : " + (e && e.message || "erreur");
          b.disabled = false;
        }
      };
    });
  }

  function newPasswordScreen() {
    return new Promise(function (resolve) {
      var g = showGate('<h1>Nouveau mot de passe</h1><p class="ce-lead">Choisis ton nouveau mot de passe (au moins 8 caractères).</p>' +
        '<form class="ce-form"><label for="ce-np1">Nouveau mot de passe</label><input id="ce-np1" type="password" autocomplete="new-password" minlength="8" required>' +
        '<label for="ce-np2">Le même, une deuxième fois</label><input id="ce-np2" type="password" autocomplete="new-password" minlength="8" required>' +
        '<button type="submit" class="main">Enregistrer</button><p class="ce-msg" role="status"></p></form>');
      var f = g.querySelector("form"), m = g.querySelector(".ce-msg");
      f.onsubmit = async function (ev) {
        ev.preventDefault();
        var a = g.querySelector("#ce-np1").value, b = g.querySelector("#ce-np2").value;
        if (a !== b) { m.textContent = "Les deux ne sont pas identiques."; return; }
        var btn = f.querySelector("button"); btn.disabled = true; m.textContent = "Enregistrement...";
        var r = await sb.auth.updateUser({ password: a });
        if (r.error) { btn.disabled = false; m.textContent = "Impossible : " + r.error.message; return; }
        resolve();
      };
    });
  }

  function importScreen() {
    return new Promise(function (resolve) {
      var g = showGate('<h1>Bienvenue</h1><p class="ce-lead">Ton espace est vide. Importe ta sauvegarde Candidature Express (fichier .json) : candidatures, historiques, CV, profil, parcours, réglages et offres écartées.</p>' +
        '<div class="ce-form"><input id="ce-file" type="file" accept=".json,application/json" hidden>' +
        '<button type="button" class="main" id="ce-pick">Choisir ma sauvegarde</button>' +
        '<button type="button" class="ghost" id="ce-skip">Commencer sans sauvegarde</button><p class="ce-msg" role="status"></p></div>');
      var inp = g.querySelector("#ce-file"), m = g.querySelector(".ce-msg");
      g.querySelector("#ce-pick").onclick = function () { inp.value = ""; inp.click(); };
      g.querySelector("#ce-skip").onclick = function () { resolve(false); };
      inp.onchange = async function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        m.textContent = "Lecture du fichier...";
        try {
          var d = JSON.parse(await f.text());
          if (!d || !d.ls || typeof d.ls !== "object") throw err("format", "Ce fichier n'est pas une sauvegarde de Candidature Express.");
          var n = 0; try { n = JSON.parse(d.ls.off || "[]").length; } catch (e) {}
          Object.keys(d.ls).forEach(function (k) { if (typeof d.ls[k] === "string") localStorage.setItem(LS + k, d.ls[k]); });
          if (d.perso && typeof d.perso === "object") { PERSO = d.perso; await savePerso(PERSO); try { localStorage.setItem("ce.perso", JSON.stringify(PERSO)); } catch (e) {} }
          m.textContent = n + " candidatures importées. Envoi vers ton compte...";
          resolve(true);
        } catch (e) { m.textContent = e && e.message || "Import impossible."; }
      };
    });
  }

  /* ---------- Base de données (même interface que l'artefact) ---------- */
  var demoStore = null;
  function demoDb() {
    if (!demoStore) { try { demoStore = JSON.parse(localStorage.getItem("ce.demo.db") || "{}"); } catch (e) { demoStore = {}; } }
    return {
      list: async function (col) { var c = demoStore[col] || {}; return Object.keys(c).map(function (id) { return { id: id, data: c[id] }; }); },
      set: async function (col, id, v) { (demoStore[col] = demoStore[col] || {})[id] = v; localStorage.setItem("ce.demo.db", JSON.stringify(demoStore)); },
      del: async function (col, id) { if (demoStore[col]) delete demoStore[col][id]; localStorage.setItem("ce.demo.db", JSON.stringify(demoStore)); }
    };
  }
  var remoteDb = {
    list: async function (col) {
      var out = [], from = 0, step = 500;
      for (;;) {
        var r = await sb.from("docs").select("id,data").eq("col", col).order("id").range(from, from + step - 1);
        if (r.error) throw err("db", r.error.message);
        out = out.concat(r.data || []);
        if (!r.data || r.data.length < step) break;
        from += step;
      }
      return out;
    },
    set: async function (col, id, v) {
      var r = await sb.from("docs").upsert({ user_id: USER.id, col: col, id: id, data: v, updated_at: new Date().toISOString() });
      if (r.error) throw err("db", r.error.message);
    },
    del: async function (col, id) {
      var r = await sb.from("docs").delete().eq("col", col).eq("id", id);
      if (r.error) throw err("db", r.error.message);
    }
  };
  function store() { return DEMO ? demoDb() : remoteDb; }

  /* Synchronisation économe : la liste des identifiants (quelques Ko), puis le contenu des seuls éléments modifiés
     depuis la dernière fois. Les éléments inchangés sont signalés « same » à l'app, qui garde sa copie locale.
     Un téléchargement complet est refait une fois par jour, par prudence. */
  async function syncGet(col) {
    var key = LS + "syncw." + col, w = {};
    try { w = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
    var full = !w.at || !w.full || Date.now() - w.full > 864e5 || !localStorage.getItem(LS + "off");
    var docs = [], maxAt = w.at || "";
    function keep(r) { if (r.updated_at && r.updated_at > maxAt) maxAt = r.updated_at; }
    if (full) {
      for (var from = 0; ; from += 500) {
        var r = await sb.from("docs").select("id,data,updated_at").eq("col", col).order("id").range(from, from + 499);
        if (r.error) throw err("db", r.error.message);
        (r.data || []).forEach(function (x) { keep(x); docs.push({ id: x.id, data: function () { return x.data; } }); });
        if (!r.data || r.data.length < 500) break;
      }
      w.full = Date.now();
    } else {
      // Deux minutes de recouvrement : rien n'est manqué si deux appareils écrivent presque en même temps.
      var t0 = new Date(String(w.at).replace(/(\.\d{3})\d+/, "$1")).getTime(), since = new Date((isFinite(t0) ? t0 : 0) - 120000).toISOString(), ids = [];
      for (var f2 = 0; ; f2 += 1000) {
        var r1 = await sb.from("docs").select("id").eq("col", col).order("id").range(f2, f2 + 999);
        if (r1.error) throw err("db", r1.error.message);
        ids = ids.concat((r1.data || []).map(function (x) { return x.id; }));
        if (!r1.data || r1.data.length < 1000) break;
      }
      var r2 = await sb.from("docs").select("id,data,updated_at").eq("col", col).gt("updated_at", since);
      if (r2.error) throw err("db", r2.error.message);
      var changed = {};
      (r2.data || []).forEach(function (x) { keep(x); changed[x.id] = x; });
      ids.forEach(function (id) {
        var x = changed[id];
        docs.push(x ? { id: id, data: function () { return x.data; } } : { id: id, same: true, data: function () { return null; } });
      });
    }
    w.at = maxAt;
    try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {}
    return { docs: docs };
  }
  function collection(path) {
    var col = String(path).replace(/^data\/users\/[^/]+$/, "app");
    return {
      get: async function () {
        if (DEMO) {
          var rows = await store().list(col);
          return { docs: rows.map(function (r) { return { id: r.id, data: function () { return r.data; } }; }) };
        }
        return syncGet(col);
      },
      doc: function (id) {
        return {
          set: function (v) { return store().set(col, String(id), JSON.parse(JSON.stringify(v))); },
          delete: function () { return store().del(col, String(id)); },
          get: async function () { var rows = await store().list(col); var r = rows.find(function (x) { return x.id === String(id); }); return { exists: !!r, data: function () { return r ? r.data : undefined; } }; }
        };
      }
    };
  }
  async function loadPerso() {
    try { var rows = await store().list("ce"); var r = rows.find(function (x) { return x.id === "perso"; }); return r ? r.data : null; } catch (e) { return null; }
  }
  function savePerso(p) { return store().set("ce", "perso", p); }

  /* ---------- Téléchargements ---------- */
  var downloads = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
      var name = o.filename || "fichier";
      var touch = matchMedia("(pointer:coarse)").matches;
      if (touch && navigator.canShare) {
        var file = new File([blob], name, { type: blob.type || "application/octet-stream" });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); return; }
          catch (e) { if (e && e.name === "AbortError") throw err("cancelled"); }
        }
      }
      var url = URL.createObjectURL(blob), a = el("a", { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    },
    saveAll: async function (list) {
      var touch = matchMedia("(pointer:coarse)").matches;
      var files = list.map(function (o) { var b = o.data instanceof Blob ? o.data : new Blob([o.data]); return new File([b], o.filename, { type: b.type || "application/pdf" }); });
      if (touch && navigator.canShare && navigator.canShare({ files: files })) {
        try { await navigator.share({ files: files }); return; }
        catch (e) { if (e && e.name === "AbortError") throw err("cancelled"); }
      }
      for (var i = 0; i < list.length; i++) { await downloads.save(list[i]); await new Promise(function (r) { setTimeout(r, 400); }); }
    }
  };

  /* ---------- Runtime compatible avec l'artefact ---------- */
  var caps = {
    user: function () { return { id: async function () { return USER ? USER.id : "demo"; } }; },
    db: function () { return { collection: collection }; },
    downloads: function () { return downloads; },
    sample: function () { return window.CE_AI ? window.CE_AI.sample() : null; },
    mcp: function () { return window.CE_MCP ? window.CE_MCP() : null; }
  };
  window.claude = { use: async function (name) { var f = caps[name]; return f ? f() : null; } };
  window.CE = { config: CFG, get supabase() { return sb; }, get user() { return USER; }, get perso() { return PERSO; }, collection: collection };

  /* ---------- Synchro instantanée ---------- */
  function realtime() {
    if (DEMO || !sb) return;
    var t = null;
    sb.channel("docs-" + USER.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "user_id=eq." + USER.id }, function (p) {
        var row = p.new && p.new.col ? p.new : p.old;
        if (row && row.col && row.col !== "app") return;
        clearTimeout(t); t = setTimeout(function () { window.dispatchEvent(new Event("ce:remote")); }, 700);
      })
      .subscribe();
  }

  /* ---------- Lancement de l'app ---------- */
  async function startApp() {
    var p = PERSO || {};
    // Données de la carte (villes et pays) dans un fichier à part : il ne change jamais, il reste en cache.
    var geo = fetch("geo.json").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; });
    var src = await (await fetch("app.js", { cache: "no-cache" })).text();
    window.CE_GEODATA = await geo;
    src = src.replace(/\{\{PRENOM\}\}/g, jsStr(p.prenom || "toi"))
      .replace(/\{\{NOM\}\}/g, jsStr(p.nom || ""))
      .replace(/\{\{AFF\}\}/g, JSON.stringify(p.aff || {}));
    // Laisse l'écran d'ouverture tracer son cercle avant de démarrer l'app (le démarrage occupe le processeur).
    var waited = 0;
    // Ouverture mise en pause par l'iPhone (app quittée aussitôt, lancée en arrière-plan) : la pause compterait
    // comme du temps de chargement. Cette ouverture-là n'est pas mesurée.
    if (window.CE_splashGate) { var w0 = performance.now(); try { await window.CE_splashGate(); } catch (e) {} waited = performance.now() - w0; }
    hideGate();
    var s = document.createElement("script");
    s.textContent = src + "\n//# sourceURL=app.js";
    var t0 = performance.now();
    document.body.appendChild(s);
    var exec = performance.now() - t0;
    try { window.CE_handleView && window.CE_handleView(); } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      document.documentElement.classList.remove("ce-boot");
      // Vitesse : temps écoulé depuis le lancement jusqu'à l'app affichée et utilisable (noté une fois par ouverture).
      try { if (!window.CE_PAUSED && document.visibilityState === "visible" && window.CE_perf) window.CE_perf(performance.now() - waited, exec); } catch (e) {}
    }); });
    realtime();
    setTimeout(function () { try { window.CE_srcUI && window.CE_srcUI(); } catch (e) {} }, 1500);
    setTimeout(function () { try { window.CE_handleShare && window.CE_handleShare(); } catch (e) {} }, 2500);
    setTimeout(function () { try { window.CE_critInit && window.CE_critInit(); } catch (e) {} }, 300);
  }

  async function main() {
    if (DEMO) { USER = { id: "demo" }; PERSO = await loadPerso(); }
    else {
      if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) { showGate('<h1>Configuration en cours</h1><p class="ce-lead">La connexion à ta base privée n\'est pas encore réglée.</p>'); return; }
      var recovery = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ce.auth" } });
      var s = await sb.auth.getSession();
      USER = s.data && s.data.session ? s.data.session.user : null;
      if (USER && recovery) { await newPasswordScreen(); try { history.replaceState(null, "", location.pathname); } catch (e) {} }
      if (!USER) USER = await loginScreen(recovery ? "Le lien a expiré ou a déjà servi. Redemande un mail avec « Mot de passe oublié ? »." : "");
      try { PERSO = JSON.parse(localStorage.getItem("ce.perso") || "null"); } catch (e) { PERSO = null; }
      var fresh = loadPerso().then(function (p) { if (p) { try { localStorage.setItem("ce.perso", JSON.stringify(p)); } catch (e) {} } return p; });
      if (!PERSO) PERSO = await fresh;
    }
    var hasLocal = !!localStorage.getItem(LS + "off");
    if (!hasLocal) {
      var remote = [];
      try { remote = await store().list("app"); } catch (e) {}
      if (!remote.length) await importScreen();
    }
    await startApp();
  }

  if ("serviceWorker" in navigator && !DEMO) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    // Mise à jour : l'iPhone garde souvent l'app ouverte en arrière-plan. À chaque retour dans l'app (au plus une fois
    // toutes les 10 min), on vérifie s'il existe une nouvelle version ; une fois installée, l'app se recharge d'elle-même
    // si tu n'es pas en train de faire quelque chose (aucune fenêtre ouverte, aucun champ en cours de saisie).
    var hadCtrl = !!navigator.serviceWorker.controller, pending = false, lastChk = Date.now();
    function idle() { return !document.querySelector("dialog[open]") && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) && !(window.CE_simActive && window.CE_simActive()); }
    function reloadIfIdle() { if (pending && !document.getElementById("ce-splash") && (document.hidden || idle())) { pending = false; location.reload(); } }
    // Nouvelle version prête (téléchargée pendant que l'app est ouverte) : on lui passe la main ; l'app se
    // recharge ensuite au premier moment calme (jamais pendant l'animation d'ouverture).
    function skipWhenReady(r) {
      function go(w) { if (!w) return; var f = function () { if (w.state === "installed" && navigator.serviceWorker.controller) w.postMessage("ce-skip"); }; w.addEventListener("statechange", f); f(); }
      go(r.waiting); go(r.installing); r.addEventListener("updatefound", function () { go(r.installing); });
    }
    navigator.serviceWorker.ready.then(function (r) { if (r) skipWhenReady(r); }).catch(function () {});
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadCtrl) { hadCtrl = true; return; } // première installation : rien à recharger
      pending = true; reloadIfIdle();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { reloadIfIdle(); return; }
      reloadIfIdle();
      if (Date.now() - lastChk > 10 * 60000) {
        lastChk = Date.now();
        navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {});
      }
    });
    setInterval(reloadIfIdle, 15000);
  }
  main().catch(function (e) { document.documentElement.classList.remove("ce-boot"); showGate('<h1>Oups</h1><p class="ce-lead">Le démarrage a échoué : ' + esc(e && e.message || e) + '</p><button class="main" onclick="location.reload()">Réessayer</button>'); });
})();
