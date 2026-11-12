/* Candidature Express : page « Critères de recherche » (onglet Suggérées).
   Chaque critère est appliqué à la liste tout de suite, et à la recherche automatique suivante. */
(function () {
  "use strict";
  var DROM = ["La Réunion", "Martinique", "Guadeloupe", "Guyane", "Mayotte", "Nouvelle-Calédonie", "Polynésie française", "Saint-Pierre-et-Miquelon"];
  var CTS = [["CDI", "CDI"], ["CDD", "CDD"], ["Intérim", "Intérim"]];
  function G(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function list(s) { return String(s || "").split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function C() { return window.CE_crit; }
  function sg() { return C().SG(); }
  function save() { C().save(); summary(); counts(); }

  /* ---------- Résumé dans l'en-tête ---------- */
  function summary() {
    var s = sg(), v = C().SETV(), parts = [];
    var kw = list(s.kw); parts.push(kw.length ? kw.slice(0, 3).join(", ") + (kw.length > 3 ? " +" + (kw.length - 3) : "") : "aucun métier");
    var z = [];
    if (s.zf !== false) z.push("France" + (list(s.lieux).length ? " (" + list(s.lieux).length + " ville" + (list(s.lieux).length > 1 ? "s" : "") + ", " + (+s.rayon || 30) + " km)" : ""));
    if (s.zd !== false && list(s.drom).length) z.push("outre-mer");
    if (s.ze !== false && list(s.etr).length) z.push("étranger");
    parts.push(z.join(", ") || "aucune zone");
    parts.push((s.ct || []).join(", ") || "aucun contrat");
    parts.push("note ≥ " + v.minsc);
    var el = document.querySelector("#sgcrit > summary");
    if (el) el.innerHTML = '<span class="cesum"><b>Critères de recherche</b><small>' + esc(parts.join(" · ")) + "</small></span>";
  }
  function counts() {
    var n = C().hidden(), el = G("cehid");
    if (el) el.textContent = n ? n + " offre" + (n > 1 ? "s" : "") + " déjà trouvée" + (n > 1 ? "s sont masquées" : " est masquée") + " car hors de ces critères." : "";
  }

  /* ---------- Listes modifiables (étiquettes) ---------- */
  function chips(box, key, ph, geo) {
    function draw() {
      var items = list(sg()[key]);
      box.innerHTML = '<div class="cechips">' + items.map(function (t, i) {
        var unk = geo && !C().geo(t);
        return '<span class="cechip' + (unk ? " unk" : "") + '"' + (unk ? ' title="Lieu inconnu de la carte : utilisé pour la recherche, mais pas pour écarter les offres trop loin"' : "") + ">" + esc(t) + (unk ? " ?" : "") + '<button type="button" aria-label="Retirer ' + esc(t) + '" data-i="' + i + '">×</button></span>';
      }).join("") + '</div><div class="ceadd"><input type="text" placeholder="' + esc(ph) + '" autocapitalize="off" enterkeyhint="done"><button type="button" class="sb sec">Ajouter</button></div>';
      box.querySelectorAll("[data-i]").forEach(function (b) {
        b.onclick = function () { var a = list(sg()[key]); a.splice(+b.getAttribute("data-i"), 1); sg()[key] = a.join(", "); save(); draw(); };
      });
      var inp = box.querySelector("input"), add = function () {
        var v = inp.value.trim(); if (!v) return;
        var a = list(sg()[key]); list(v).forEach(function (x) { if (!a.some(function (y) { return y.toLowerCase() === x.toLowerCase(); })) a.push(x); });
        sg()[key] = a.join(", "); save(); draw(); box.querySelector("input").focus();
      };
      box.querySelector(".ceadd button").onclick = add;
      inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } };
    }
    draw();
  }
  function toggle(id, key) {
    var el = G(id); el.checked = sg()[key] !== false;
    el.onchange = function () { sg()[key] = el.checked; save(); var d = el.closest(".cesec"); if (d) d.classList.toggle("off", !el.checked); };
    var d = el.closest(".cesec"); if (d) d.classList.toggle("off", !el.checked);
  }
  function select(id, opts, get, set) {
    var el = G(id);
    el.innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + "</option>"; }).join("");
    el.value = String(get());
    el.onchange = function () { set(el.value); summary(); counts(); };
  }

  function sec(id, title, sub, body, tog) {
    return '<section class="cesec" id="' + id + '"><div class="cesh"><div><h4>' + title + "</h4>" + (sub ? '<p class="note">' + sub + "</p>" : "") + "</div>" +
      (tog ? '<label class="prc swl cetog"><input type="checkbox" class="sw" id="' + tog + '"><i class="swt" aria-hidden="true"></i></label>' : "") + "</div>" + body + "</section>";
  }

  function build() {
    var box = document.querySelector("#sgcrit .altin"); if (!box || !C()) return;
    if (!box.dataset.ce) {
      box.dataset.ce = 1;
      Array.prototype.forEach.call(box.children, function (c) { c.classList.add("ceold"); });
      var w = document.createElement("div"); w.className = "cecrit"; box.prepend(w);
    }
    var w = box.querySelector(".cecrit"), s = sg(), v = C().SETV();
    w.innerHTML =
      '<p class="note cehint">Les changements s\'appliquent tout de suite à la liste, et à la prochaine recherche automatique (dans l\'heure).</p><p class="note" id="cehid"></p>' +
      sec("ce-met", "Métiers recherchés", "Intitulés ou mots-clés en français. Une offre doit correspondre à l'un d'eux.", '<div id="ce-kw"></div><label class="cel">Pour l\'étranger, en anglais</label><div id="ce-kwen"></div>') +
      sec("ce-fr", "France", "Villes autour desquelles chercher. Les offres plus loin que le rayon sont écartées.", '<div id="ce-lieux"></div><div class="cerow"><label class="cel" for="ce-rayon">Rayon autour de chaque ville</label><select id="ce-rayon"></select></div>', "ce-zf") +
      sec("ce-dom", "Outre-mer", "Territoires où chercher.", '<div class="cechks" id="ce-drom"></div>', "ce-zd") +
      sec("ce-etr", "Étranger", "Pays (tout le pays) ou villes (avec le même rayon que pour la France).", '<div id="ce-etrl"></div>', "ce-ze") +
      sec("ce-ct", "Contrats", "Les offres d'un autre type de contrat sont écartées. Stages et alternances sont toujours exclus.", '<div class="cechks" id="ce-cts"></div>') +
      sec("ce-ent", "Entreprises", "", '<div class="cesub"><div class="cesh"><div><label class="cel">Entreprises surveillées</label><p class="note">Leurs offres sont cherchées sur leurs sites et gardées partout, même hors de tes villes.</p></div><label class="prc swl cetog"><input type="checkbox" class="sw" id="ce-zc"><i class="swt" aria-hidden="true"></i></label></div><div id="ce-entl"></div></div><div class="cesub"><label class="cel">Entreprises à ne jamais proposer</label><div id="ce-exent"></div></div>') +
      sec("ce-exc", "À exclure", "", '<label class="cel">Métiers à ne jamais proposer (dans l\'intitulé)</label><div id="ce-excl"></div><div class="cerow"><label class="cel" for="ce-xp">Écarter les offres qui exigent au moins</label><select id="ce-xp"></select></div><p class="note">Langues : seules les offres en français, anglais ou espagnol sont gardées, et celles qui exigent une autre langue sont écartées.</p>') +
      sec("ce-tri", "Tri et affichage", "", '<div class="cerow"><label class="cel" for="ce-min">Note minimale</label><select id="ce-min"></select></div><div class="cerow"><label class="cel" for="ce-cap">Nouvelles offres au maximum par recherche</label><select id="ce-cap"></select></div><div class="cerow"><label class="cel" for="ce-win">Offres publiées depuis</label><select id="ce-win"></select></div><div class="cerow"><label class="cel" for="ce-age">Garder une suggestion pendant</label><select id="ce-age"></select></div>');

    chips(G("ce-kw"), "kw", "Ajouter un métier ou un mot-clé");
    chips(G("ce-kwen"), "kwen", "Add a keyword");
    chips(G("ce-lieux"), "lieux", "Ajouter une ville", true);
    chips(G("ce-etrl"), "etr", "Ajouter un pays ou une ville", true);
    chips(G("ce-entl"), "ent", "Ajouter une entreprise");
    chips(G("ce-exent"), "exent", "Ajouter une entreprise");
    chips(G("ce-excl"), "excl", "Ajouter un métier à exclure");
    toggle("ce-zf", "zf"); toggle("ce-zd", "zd"); toggle("ce-ze", "ze"); toggle("ce-zc", "zc");
    select("ce-rayon", [[10, "10 km"], [20, "20 km"], [30, "30 km"], [50, "50 km"], [80, "80 km"], [100, "100 km"], [150, "150 km"]], function () { return +sg().rayon || 30; }, function (x) { sg().rayon = +x; save(); });
    select("ce-xp", [[3, "3 ans d'expérience"], [4, "4 ans d'expérience"], [5, "5 ans d'expérience"], [6, "6 ans d'expérience"], [99, "jamais (pas de limite)"]], function () { return +sg().xpmax || 4; }, function (x) { sg().xpmax = +x; save(); });
    var ss = function (k) { return function (x) { C().saveSet(k, +x); sg().critAt = Date.now(); save(); }; };
    select("ce-min", [50, 55, 60, 65, 70, 75, 80].map(function (n) { return [n, n + " / 100"]; }), function () { return v.minsc; }, ss("minsc"));
    select("ce-cap", [[30, "30"], [50, "50"], [80, "80"], [120, "120"]], function () { return v.cap; }, ss("cap"));
    select("ce-win", [[7, "7 jours"], [10, "10 jours"], [14, "14 jours"], [21, "21 jours"], [30, "30 jours"]], function () { return v.win; }, ss("win"));
    select("ce-age", [[20, "20 jours"], [30, "30 jours"], [40, "40 jours"], [60, "60 jours"]], function () { return v.age; }, ss("age"));

    var dsel = list(s.drom);
    G("ce-drom").innerHTML = DROM.map(function (d) { return '<label class="chk"><input type="checkbox" value="' + esc(d) + '"' + (dsel.some(function (x) { return x.toLowerCase() === d.toLowerCase(); }) ? " checked" : "") + "> " + esc(d) + "</label>"; }).join("");
    G("ce-drom").querySelectorAll("input").forEach(function (x) { x.onchange = function () { sg().drom = Array.prototype.filter.call(G("ce-drom").querySelectorAll("input"), function (y) { return y.checked; }).map(function (y) { return y.value; }).join(", "); save(); }; });
    G("ce-cts").innerHTML = CTS.map(function (c) { return '<label class="chk"><input type="checkbox" value="' + c[0] + '"' + ((s.ct || []).indexOf(c[0]) >= 0 ? " checked" : "") + "> " + c[1] + "</label>"; }).join("");
    G("ce-cts").querySelectorAll("input").forEach(function (x) { x.onchange = function () { sg().ct = Array.prototype.filter.call(G("ce-cts").querySelectorAll("input"), function (y) { return y.checked; }).map(function (y) { return y.value; }); save(); }; });
    summary(); counts();
  }

  window.CE_critInit = function () {
    if (!window.CE_crit || !document.getElementById("sgcrit")) return;
    summary();
    var d = G("sgcrit");
    d.addEventListener("toggle", function () { if (d.open) build(); });
    if (d.open) build();
  };
})();
