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
  function jsStr(s) { return JSON.stringify(String(s == null ? "" : s)).slice(1, -1); }
  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }

  /* ---------- Écran d'accueil (connexion, import) ---------- */
  var gate = null;
  function showGate(html) {
    if (!gate) { gate = el("div", { class: "ce-gate", role: "dialog", "aria-modal": "true" }); document.body.appendChild(gate); }
    gate.innerHTML = '<div class="ce-card"><div class="ce-logo" aria-hidden="true"><svg viewBox="0 0 52 52"><rect width="52" height="52" rx="15" fill="var(--brand)"/><path d="M33.5 17.2A12 12 0 1 0 33.5 34.8" fill="none" stroke="var(--onbrand)" stroke-width="4.4" stroke-linecap="round"/><path d="M24 26h13.5M32.5 20.8L37.8 26l-5.3 5.2" fill="none" stroke="var(--onbrand)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' + html + "</div>";
    document.documentElement.classList.add("ce-gated");
    return gate;
  }
  function hideGate() { if (gate) { gate.remove(); gate = null; } document.documentElement.classList.remove("ce-gated"); }

  function loginScreen(msg) {
    return new Promise(function (resolve) {
      var g = showGate('<h1>Candidature <em>Express</em></h1><p class="ce-lead">Connexion privée. Une seule fois par appareil.</p>' +
        '<form class="ce-form"><label for="ce-mail">Adresse e-mail</label><input id="ce-mail" type="email" autocomplete="username" required>' +
        '<label for="ce-pw">Mot de passe</label><input id="ce-pw" type="password" autocomplete="current-password" required>' +
        '<button type="submit" class="main">Se connecter</button><p class="ce-msg" role="status">' + esc(msg || "") + "</p></form>");
      var f = g.querySelector("form"), m = g.querySelector(".ce-msg");
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
          if (d.perso && typeof d.perso === "object") { PERSO = d.perso; await savePerso(PERSO); }
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
  function collection(path) {
    var col = String(path).replace(/^data\/users\/[^/]+$/, "app");
    return {
      get: async function () {
        var rows = await store().list(col);
        return { docs: rows.map(function (r) { return { id: r.id, data: function () { return r.data; } }; }) };
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
    var src = await (await fetch("app.js", { cache: "no-cache" })).text();
    src = src.replace(/\{\{PRENOM\}\}/g, jsStr(p.prenom || "toi"))
      .replace(/\{\{NOM\}\}/g, jsStr(p.nom || ""))
      .replace(/\{\{AFF\}\}/g, JSON.stringify(p.aff || {}));
    hideGate();
    var s = document.createElement("script");
    s.textContent = src + "\n//# sourceURL=app.js";
    document.body.appendChild(s);
    realtime();
    setTimeout(function () { try { window.CE_srcUI && window.CE_srcUI(); } catch (e) {} }, 1500);
    setTimeout(function () { try { window.CE_handleShare && window.CE_handleShare(); } catch (e) {} }, 2500);
  }

  async function main() {
    if (DEMO) { USER = { id: "demo" }; PERSO = await loadPerso(); }
    else {
      if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) { showGate('<h1>Configuration en cours</h1><p class="ce-lead">La connexion à ta base privée n\'est pas encore réglée.</p>'); return; }
      sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ce.auth" } });
      var s = await sb.auth.getSession();
      USER = s.data && s.data.session ? s.data.session.user : null;
      if (!USER) USER = await loginScreen();
      PERSO = await loadPerso();
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
  }
  main().catch(function (e) { showGate('<h1>Oups</h1><p class="ce-lead">Le démarrage a échoué : ' + esc(e && e.message || e) + '</p><button class="main" onclick="location.reload()">Réessayer</button>'); });
})();
