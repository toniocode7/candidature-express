/* Candidature Express : IA (Gemini, Groq en secours), lecture des annonces et « Envoyer à Claude ».
   Tout passe par les fonctions serveur Supabase : aucune clé dans ce fichier public. */
(function () {
  "use strict";
  var CFG = window.CE_CONFIG || {};

  function err(code, detail) { var e = new Error(detail || code); e.code = code; return e; }

  async function call(name, body) {
    if (window.CE_DEMO_CALL) return window.CE_DEMO_CALL(name, body);
    var sb = window.CE && window.CE.supabase;
    if (!sb) throw err("hors connexion");
    var s = await sb.auth.getSession();
    var tok = s.data && s.data.session ? s.data.session.access_token : "";
    var r;
    try {
      r = await fetch(CFG.supabaseUrl + "/functions/v1/" + name, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, apikey: CFG.supabaseKey },
        body: JSON.stringify(body)
      });
    } catch (e) { throw err("réseau indisponible"); }
    var j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 429 || (j && j.error === "quota")) throw err("plafond gratuit du jour atteint, réessaie demain ou utilise « Envoyer à Claude »", j && j.detail);
    if (!r.ok || !j) throw err(j && j.error || "erreur " + r.status, j && j.detail);
    return j;
  }

  // Les tâches qui méritent le meilleur modèle ; le reste passe par le modèle léger (quota plus large).
  var QUALITY = /(Tu analyses une offre|Tu prépares le CV|lettre de motivation pour cette offre|préparer un entretien|assistant de Candidature Express)/;
  function textOf(p) { return typeof p === "string" ? p : (p || []).map(function (m) { return m && m.content || ""; }).join("\n"); }
  function tierOf(p, opts) {
    if (opts && opts.modelTier === "complex") return "quality";
    return QUALITY.test(textOf(p).slice(0, 6000)) ? "quality" : "light";
  }
  function blobToB64(b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(",")[1] || ""); };
      fr.onerror = rej; fr.readAsDataURL(b);
    });
  }
  async function images(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var x = list[i];
      if (x instanceof Blob) out.push({ mime: x.type || "image/jpeg", data: await blobToB64(x) });
      else if (x && x.data) out.push({ mime: x.mime || x.type || "image/jpeg", data: x.data });
    }
    return out;
  }
  function body(p, opts, mode) {
    var b = { mode: mode, tier: tierOf(p, opts) };
    if (typeof p === "string") b.prompt = p; else b.messages = (p || []).map(function (m) { return { role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }; });
    return b;
  }

  function makeSample() {
    var sample = async function (p, opts) {
      var b = body(p, opts, "text");
      if (opts && opts.images) b.images = await images(opts.images);
      var j = await call("ai", b);
      return { text: j.text || "" };
    };
    sample.json = async function (p, opts) {
      var b = body(p, opts, "json");
      if (opts && opts.images) b.images = await images(opts.images);
      var j = await call("ai", b);
      return j.json;
    };
    sample.limits = async function () { return { images: { maxCount: 4 } }; };
    return sample;
  }
  window.CE_AI = { sample: makeSample, call: call };

  /* ---------- Outils de lecture compatibles avec l'ancien artefact ---------- */
  function unavailable() { return err("unavailable"); }
  window.CE_MCP = function () {
    return {
      callTool: async function (server, tool, args) {
        args = args || {};
        if (server === "Firecrawl" && tool === "firecrawl_scrape" && (args.formats || ["markdown"]).indexOf("json") < 0) {
          var j = await call("read", { url: args.url });
          return { payload: { data: { markdown: j.markdown || "", metadata: { title: j.title || "", statusCode: j.statusCode || 200, via: j.via } } } };
        }
        if (server === "Firecrawl" && tool === "firecrawl_search") {
          var w = await call("read", { search: String(args.query || "") });
          return { payload: { data: { web: w.web || [] } } };
        }
        if (server === "Gmail") return gmail(tool, args);
        throw unavailable();
      }
    };
  };

  /* ---------- Gmail : mails transmis par le script Google (toutes les 15 min) ---------- */
  async function gmail(tool, args) {
    var sb = window.CE && window.CE.supabase; if (!sb) throw err("hors connexion");
    if (tool === "search_threads") {
      var m = /after:(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(String(args.query || ""));
      var since = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(Date.now() - 30 * 864e5);
      var r = await sb.from("mails").select("id,thread_id,data").gte("received_at", since.toISOString()).order("received_at", { ascending: false }).limit(300);
      if (r.error) throw err("mails indisponibles");
      var by = {}, order = [];
      (r.data || []).forEach(function (x) {
        if (!by[x.thread_id]) { by[x.thread_id] = { id: x.thread_id, messages: [] }; order.push(x.thread_id); }
        by[x.thread_id].messages.push({ id: x.id, sender: x.data.sender });
      });
      var threads = order.map(function (k) { var t = by[k]; t.messageCount = t.messages.length; return t; });
      if (args.pageToken) threads = [];
      return { payload: { threads: threads } };
    }
    if (tool === "get_thread") {
      var r2 = await sb.from("mails").select("data").eq("thread_id", String(args.threadId || "")).order("received_at");
      if (r2.error) throw err("mails indisponibles");
      var msgs = (r2.data || []).map(function (x) { return x.data; });
      return { payload: { messages: msgs, viewUrl: msgs[0] && msgs[0].viewUrl } };
    }
    if (tool === "create_draft") {
      var r3 = await sb.from("drafts_out").insert({ data: args });
      if (r3.error) throw err("brouillon impossible");
      return { payload: { id: "en-attente", note: "Le brouillon apparaîtra dans Gmail d'ici 15 minutes." } };
    }
    throw unavailable();
  }

  /* ---------- Envoyer à Claude ---------- */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.innerHTML = "<span></span>";
    t.firstChild.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 6000);
  }
  window.CE_sendToClaude = function (prompt) {
    prompt = String(prompt || "").trim();
    var copied = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(prompt).catch(function () {}); copied = true; } } catch (e) {}
    var short = prompt.length <= 6000;
    var url = "https://claude.ai/new" + (short ? "?q=" + encodeURIComponent(prompt) : "");
    window.open(url, "_blank", "noopener");
    toast(short ? "Demande ouverte dans Claude." + (copied ? " Elle est aussi copiée." : "") : copied ? "Demande copiée : colle-la dans Claude (appui long, Coller)." : "Claude est ouvert. La demande est trop longue pour être transmise automatiquement.");
  };
})();

/* ---------- Quotas des services gratuits (Paramètres) ---------- */
(function () {
  var LIM = [
    [/^gemini:.*flash-lite/, "IA Gemini légère (tri, mails)", "plafond gratuit d'environ 500 par jour et par modèle"],
    [/^gemini:/, "IA Gemini (analyses, CV, lettres)", "plafond gratuit d'environ 20 par jour et par modèle"],
    [/^groq:/, "IA de secours Groq", "plafond gratuit de 1 000 par jour environ"],
    [/^lecture:/, "Lecture d'annonces", "sans plafond"],
    [/^recherche-web:/, "Recherche web (infos entreprise)", "sans plafond"],
    [/^francetravail:/, "France Travail", "plafond de quelques appels par seconde"]
  ];
  window.CE_quotaUI = async function () {
    var box = document.getElementById("ceq"); if (!box) return;
    var sb = window.CE && window.CE.supabase; if (!sb) { box.innerHTML = '<p class="note">Indisponible hors connexion.</p>'; return; }
    var day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    var r = await sb.from("usage").select("provider,model,ok,fail,exhausted").eq("day", day);
    if (r.error) { box.innerHTML = '<p class="note">Compteur indisponible pour l\'instant.</p>'; return; }
    var agg = {};
    (r.data || []).forEach(function (x) {
      var k = x.provider + ":" + x.model, lab = null, lim = "";
      for (var i = 0; i < LIM.length; i++) if (LIM[i][0].test(k)) { lab = LIM[i][1]; lim = LIM[i][2]; break; }
      if (!lab) return;
      var a = agg[lab] = agg[lab] || { ok: 0, fail: 0, full: 0, lim: lim };
      a.ok += x.ok; a.fail += x.fail; if (x.exhausted) a.full++;
    });
    var keys = Object.keys(agg);
    box.innerHTML = keys.length ? keys.map(function (k) {
      var a = agg[k];
      return '<div class="ceqr"><b>' + k + '</b><span>' + a.ok + ' réussite' + (a.ok > 1 ? 's' : '') + (a.fail ? ', ' + a.fail + ' refus ou échec' + (a.fail > 1 ? 's' : '') : '') + (a.full ? ' · plafond atteint sur ' + a.full + ' modèle' + (a.full > 1 ? 's' : '') : '') + '</span><small>' + a.lim + '</small></div>';
    }).join("") : '<p class="note">Rien d\'utilisé aujourd\'hui.</p>';
  };
})();
