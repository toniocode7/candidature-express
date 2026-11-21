/* ---------- Entretiens, historique et retours ---------- */
var JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
function ivTxt(iv,short){if(!iv||!iv.at)return "";if(!iv.noh)return ivFmt(iv.at,short);var d=new Date(iv.at),now=new Date(),dd=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/864e5);return (dd===0?"aujourd'hui":dd===1?"demain":dd>1&&dd<7?JOURS[d.getDay()]:"le "+d.toLocaleDateString("fr-FR",{day:"numeric",month:short?"short":"long"}))+" (heure à confirmer)"}
function ivFmt(t,short){var d=new Date(t),now=new Date(),d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()),dd=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-d0)/864e5),h=d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h");
var day=dd===0?"aujourd'hui":dd===1?"demain":dd>1&&dd<7?JOURS[d.getDay()]:(short?d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"le "+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}));return day+" à "+h}
function ivAbs(t){var d=new Date(t);return d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+" à "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":","h")}
function histAdd(o,x){if(!Array.isArray(o.hist))histLog(o);o.hist=Array.isArray(o.hist)?o.hist:[];o.hist.push({t:Date.now(),x:x});if(o.hist.length>40){var ls=null;for(var k=o.hist.length-1;k>=0;k--)if(o.hist[k].s!=null){ls=o.hist[k];break}o.hist=o.hist.slice(-40);if(ls&&o.hist.indexOf(ls)<0)o.hist.unshift(ls)}}
function histLog(o){if(o.st==null)return;var h=Array.isArray(o.hist)?o.hist:(o.hist=[]),ir=o.st===2&&o.ir?1:0,fix=false;
var first1=null;h.forEach(function(e){if(!e||e.s==null)return;if(e.s===1&&!first1){first1=e;if(o.sentAt&&Math.abs(e.t-o.sentAt)>36e5&&e.t>o.sentAt){e.t=o.sentAt;fix=true}}else if(o.mt&&e.t>o.mt+6e4){e.t=o.mt;fix=true}});
var last=null;for(var i=h.length-1;i>=0;i--){if(h[i]&&h[i].s!=null){last=h[i];break}}
if(!last){var n0=h.length;if(o.st>=1&&o.sentAt)h.push({t:o.sentAt,s:1});if(o.st!==1&&o.st!==0)h.push({t:Math.min(Date.now(),o.mt||o.sentAt||Date.now()),s:o.st,ir:ir});if(h.length!==n0)fix=true}
else if(last.s!==o.st||(last.ir||0)!==ir)h.push({t:Date.now(),s:o.st,ir:ir});
if(fix){h.sort(function(a,b){return (a&&a.t||0)-(b&&b.t||0)});try{if(SY&&SY.col)SY.dirty["o_"+o.id]=1}catch(e){}}}
function histLabel(e){if(e.x)return [e.x,"x"];if(e.s===1)return ["Candidature envoyée",""];if(e.s===4)return ["Premier contact avec un recruteur",""];if(e.s===2)return e.ir?["Non retenu après l'entretien","r"]:["Entretien obtenu","g"];if(e.s===3)return ["Refusée","r"];return ["À postuler","o"]}
function histMount(b,o){if(b.querySelector(".hst"))return;var h=(o.hist||[]).slice().sort(function(a,c){return a.t-c.t});
var html='<div class="hst"><h4>Suivi</h4>'+(h.length?'<ul class="tl">'+h.map(function(e){var l=histLabel(e);return '<li class="'+l[1]+'">'+esc(l[0])+'<small>'+new Date(e.t).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+'</small></li>'}).join("")+'</ul>':'<p class="note">Rien pour l\'instant.</p>')+
'<label for="nt_'+esc(o.id)+'" class="note" style="font-weight:600">Mes notes</label><textarea id="nt_'+esc(o.id)+'" placeholder="Ce que le recruteur t\'a dit, le salaire évoqué, la prochaine étape...">'+esc(o.notes||"")+'</textarea></div>';
b.insertAdjacentHTML("afterbegin",html);var ta=b.querySelector(".hst textarea"),tt=0;ta.addEventListener("input",function(){var v=ta.value;clearTimeout(tt);tt=setTimeout(function(){o.notes=v;touch(o);saveOff();mark("o_"+o.id)},600)})}
var IVO=null;
function ivLocalVal(t){var d=new Date(t);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function ivOpen(o){IVO=o;var iv=o.iv||{};try{G("ivics").hidden=!(iv.at);G("ivics").onclick=function(){if(IVO&&IVO.iv&&IVO.iv.at)CE_ics(IVO.id)}}catch(e){}G("ivo").textContent=mlOffLabel(o);var def=new Date();def.setDate(def.getDate()+1);def.setHours(10,0,0,0);
G("ivdt").value=ivLocalVal(iv.at||def.getTime());G("ivdur").value=String(iv.dur||60);G("ivkind").value=iv.kind||"Sur place";G("ivloc").value=iv.loc||"";G("ivn").textContent=iv.at?"Entretien prévu "+ivTxt(iv)+".":"";G("ivdel").hidden=!iv.at;shOpen(G("ivd"))}
function ivRead(){var v=G("ivdt").value;if(!v)return null;var t=new Date(v).getTime();if(!t)return null;return {at:t,dur:+G("ivdur").value||60,kind:G("ivkind").value,loc:G("ivloc").value.trim()}}
function ivSave(){var o=IVO,iv=ivRead();if(!o)return false;if(!iv){G("ivn").textContent="Choisis une date et une heure.";return false}var same=o.iv&&o.iv.at===iv.at;o.iv=iv;if(!same)histAdd(o,"Entretien fixé au "+ivAbs(iv.at));touch(o);saveOff();mark("o_"+o.id,1);renderList();G("ivn").textContent="Entretien enregistré "+ivFmt(iv.at)+".";G("ivdel").hidden=false;return true}
G("ivsave").onclick=function(){if(ivSave())setTimeout(function(){G("ivd").close()},700)};

G("ivdel").onclick=function(){var o=IVO;if(!o)return;o.iv=null;histAdd(o,"Date d'entretien effacée");touch(o);saveOff();mark("o_"+o.id,1);renderList();G("ivd").close()};
/* retours */
var FBTY="Souci",FBL=lsg("retours",[]);
function fbUI(){G("fbl").innerHTML=FBL.slice(-5).reverse().map(function(f){return '<div>'+esc(f.type+" : "+f.txt)+'<small>'+new Date(f.t).toLocaleDateString("fr-FR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+'</small></div>'}).join("")}
document.querySelectorAll("[data-fb]").forEach(function(b){b.onclick=function(){FBTY=b.getAttribute("data-fb");document.querySelectorAll("[data-fb]").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))})}});
G("fbgo").onclick=async function(){var t=G("fbt").value.trim(),n=G("fbn");if(!t){G("fbt").focus();return}var f={id:"f"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:FBTY,txt:t,t:Date.now(),ecran:window.innerWidth+"x"+window.innerHeight,ua:/iPhone|iPad/.test(navigator.userAgent)?"iPhone":/Android/.test(navigator.userAgent)?"Android":"ordinateur",fait:false};
FBL.push(f);lss("retours",FBL);G("fbt").value="";fbUI();n.textContent="Enregistré, merci.";
try{var db=await claude.use("db");if(db){await db.collection("retours").doc(f.id).set(f);n.textContent="Enregistré. Montre-le à Claude quand tu lui demandes une correction."}else n.textContent="Enregistré sur cet appareil."}catch(e){n.textContent="Enregistré sur cet appareil (envoi impossible pour l'instant)."}};
fbUI();try{OFF.forEach(histLog)}catch(e){}

/* ---------- Tri, archives, annuler, bilan, objectif, export ---------- */
var SRT="recent",SRTW=false;try{localStorage.removeItem(K+"srt")}catch(e){}
function lastStatusT(o){var h=o.hist||[];for(var i=h.length-1;i>=0;i--){if(h[i].s!=null)return h[i].t}return o.mt||o.ct||0}
function isArch(o){return (o.st===3||(o.st===2&&o.ir))&&Date.now()-lastStatusT(o)>60*864e5}
function listPrep(a){if(SRTW){var ws=dWeekStart(Date.now());a=a.filter(function(o){return Math.max(o.ct||0,o.st>=1?dSent(o):0,lastStatusT(o))>=ws})}
var f={recent:function(x,y){return (y.ct||0)-(x.ct||0)},sent:function(x,y){return (y.st>=1?dSent(y):0)-(x.st>=1?dSent(x):0)},score:function(x,y){return ((dInfo(y).score)||0)-((dInfo(x).score)||0)},
ville:function(x,y){return String(dInfo(x).lieu||"~").localeCompare(String(dInfo(y).lieu||"~"),"fr")},ent:function(x,y){var e=function(o){var a=o.an||o.meta||{};return String(a.entreprise||(o.sug||{}).entreprise||"~")};return e(x).localeCompare(e(y),"fr")}}[SRT];
return f?a.slice().sort(f):a}
G("srt").value=SRT;G("srt").onchange=function(){SRT=this.value;try{localStorage.setItem(K+"srt",SRT)}catch(e){}renderList()};
var PREVTAB="all";G("srchb").onclick=function(){if(TAB!=="find"){PREVTAB=TAB;TAB="find"}else{TAB=PREVTAB||"all";FQ="";G("fq").value="";G("fqx").hidden=true}renderList();if(TAB==="find")setTimeout(function(){G("fq").focus()},30)};
/* annuler partout */
var UNDOSKIP=false,SNAPS=null,TOAST=null,TOASTT=0;
function snapOf(o){return {k:o.st+"|"+(o.ir||0),st:o.st,ir:o.ir||0,itv:o.itv||0,autoRef:o.autoRef||0,iv:o.iv||null}}
function undoScan(){var init=!SNAPS;SNAPS=SNAPS||{};var ch=[];OFF.forEach(function(o){var nw=snapOf(o),pv=SNAPS[o.id];if(!init&&pv&&pv.k!==nw.k&&!UNDOSKIP&&!(o.autoRef&&o.st===3&&pv.st===1))ch.push({o:o,pv:pv});SNAPS[o.id]=nw});if(ch.length)toastShow(ch)}
function toastShow(ch){var o=ch[ch.length-1].o,lab=o.st===2&&o.ir?"Entretien, non retenu":o.st==null?"Nouvelle":ST[o.st];
G("toastt").textContent=ch.length>1?ch.length+" candidatures mises à jour.":"« "+(dInfo(o).poste||"Offre")+" » passée en "+lab+".";TOAST=ch;G("toast").hidden=false;clearTimeout(TOASTT);TOASTT=setTimeout(function(){G("toast").hidden=true;TOAST=null},6000)}
/* Bandeau « Annuler » pour toute action (offre écartée, candidature supprimée...) : undoToast(texte, fonction qui annule). */
function undoToast(msg,fn){G("toastt").textContent=msg;TOAST={fn:fn};G("toast").hidden=false;clearTimeout(TOASTT);TOASTT=setTimeout(function(){G("toast").hidden=true;TOAST=null},6000)}
G("toastu").onclick=function(){if(!TOAST)return;if(TOAST.fn){var f=TOAST.fn;TOAST=null;G("toast").hidden=true;try{f()}catch(e){if(window.CE_err)CE_err(e,"annuler")}return}UNDOSKIP=true;try{TOAST.forEach(function(c){var o=c.o,p=c.pv;o.st=p.st;o.ir=p.ir;o.itv=p.itv;o.autoRef=p.autoRef;o.iv=p.iv;histAdd(o,"Changement annulé");touch(o);mark("o_"+o.id,1)});saveOff();renderList()}finally{UNDOSKIP=false}G("toast").hidden=true;TOAST=null};
(function(){var _so=saveOff;saveOff=function(){_so.apply(this,arguments);try{undoScan()}catch(e){}}})();try{undoScan()}catch(e){}
/* bilan de la semaine */
function recapUI(){var R=G("recap");if(!R)return;var ws=dWeekStart(Date.now()),pw=ws-7*864e5,key=String(ws);if(lsg("recap","")===key){R.hidden=true;return}
var sent=OFF.filter(function(o){return o.st>=1&&dSent(o)>=pw&&dSent(o)<ws}).length,resp=0,itv=0;
OFF.forEach(function(o){var hit=false,ih=false;(o.hist||[]).forEach(function(e){if(e.t<pw||e.t>=ws)return;if(e.s===4||e.s===2||(e.s===3&&!o.autoRef))hit=true;if(e.s===2||/^Entretien fixé/.test(e.x||""))ih=true});if(hit)resp++;if(ih)itv++});
if(!sent&&!resp&&!itv){R.hidden=true;return}
var up=OFF.filter(function(o){return o.st===2&&!o.ir&&o.iv&&o.iv.at>=Date.now()&&o.iv.at<ws+7*864e5}).sort(function(a,b){return a.iv.at-b.iv.at}),todo=OFF.filter(function(o){return o.st===0}).length;
var next=up.length?"Cette semaine : entretien "+ivTxt(up[0].iv)+" chez "+(((up[0].an||up[0].meta||{}).entreprise)||dInfo(up[0]).poste).split(" (")[0]+(up.length>1?" et "+(up.length-1)+" autre"+(up.length>2?"s":""):"")+".":todo?"Cette semaine : "+todo+" offre"+(todo>1?"s":"")+" t'attend"+(todo>1?"ent":"")+" dans « À postuler ».":"Cette semaine : lance une recherche dans Suggérées pour repartir avec de nouvelles offres.";
R.innerHTML='<h3>Ta semaine dernière</h3><div class="rcn"><div><b>'+sent+'</b><small>envoi'+(sent>1?'s':'')+'</small></div><div><b>'+resp+'</b><small>réponse'+(resp>1?'s':'')+'</small></div><div><b>'+itv+'</b><small>entretien'+(itv>1?'s':'')+'</small></div></div><p>'+esc(next)+'</p><div class="row"><button type="button" class="sb sec" id="recapok">OK, c\'est noté</button></div>';
R.hidden=false;G("recapok").onclick=function(){lss("recap",key);R.hidden=true}}
/* objectif */
function goalUI(){var Gd=G("goal");if(!Gd)return;var g=+SETV().goal||0,ws=dWeekStart(Date.now()),n=OFF.filter(function(o){return o.st>=1&&dSent(o)>=ws}).length;
if(!g){Gd.innerHTML='<h3>Objectif de la semaine</h3><p class="note" style="margin:0">'+n+' candidature'+(n>1?'s':'')+' envoyée'+(n>1?'s':'')+' depuis lundi.</p>'+(n?'<div class="glk"><button type="button" class="lk" id="goallist">Voir les '+n+' de la semaine</button>':'<div class="glk">')+'<button type="button" class="lk" id="goalset">Me fixer un objectif</button></div>'}
else{var pc=Math.min(100,Math.round(n*100/g)),left=g-n,d=new Date().getDay(),days=d===0?1:8-d;
Gd.innerHTML='<h3>Objectif de la semaine</h3><div class="gl"><b>'+n+' / '+g+'</b><small>'+(left<=0?'Objectif atteint, bravo !':'encore '+left+' · '+days+' jour'+(days>1?'s':'')+' restant'+(days>1?'s':''))+'</small></div><div class="gbar" role="progressbar" aria-valuemin="0" aria-valuemax="'+g+'" aria-valuenow="'+n+'"><i class="'+(left<=0?'done':'')+'" style="width:'+pc+'%"></i></div><div class="glk"><button type="button" class="lk" id="goallist">Voir les '+n+' de la semaine</button><button type="button" class="lk" id="goalset">Changer l\'objectif</button></div>'}
G("goalset").onclick=function(){openSet();spGo("suivi")};var gl=G("goallist");if(gl)gl.onclick=wkOpen}
(function(){var _h=homeUI;homeUI=function(){_h.apply(this,arguments);try{recapUI();goalUI()}catch(e){}}})();
/* stats utiles */
function dInsights(list){var del=[];list.forEach(function(o){var t0=dSent(o),h=(o.hist||[]).filter(function(e){return e.t>t0&&(e.s===4||e.s===2||(e.s===3&&!o.autoRef)||e.ir)}).sort(function(a,b){return a.t-b.t})[0];if(h)del.push((h.t-t0)/864e5)});
var avg=del.length?Math.round(del.reduce(function(a,b){return a+b},0)/del.length):null,med=null;if(del.length){var sd=del.slice().sort(function(a,b){return a-b});med=Math.round(sd[Math.floor(sd.length/2)])}
function tab(title,fn){var m={};list.forEach(function(o){var k=fn(o);m[k]=m[k]||{k:k,n:0,r:0,e:0};m[k].n++;if(dResp(o))m[k].r++;if(dItv(o))m[k].e++});var rows=Object.keys(m).map(function(k){return m[k]}).filter(function(x){return x.n>=2}).sort(function(a,b){return b.e/b.n-a.e/a.n||b.r/b.n-a.r/a.n||b.n-a.n});if(!rows.length)return "";
var best=rows[0];return '<div class="dcard"><h3>'+esc(title)+'</h3><table class="instab"><thead><tr><th></th><th>Envois</th><th>Réponses</th><th>Entretiens</th></tr></thead><tbody>'+rows.map(function(x){return '<tr><td>'+esc(x.k)+'</td><td>'+x.n+'</td><td>'+pct(x.r,x.n)+' %</td><td class="'+(x===best&&x.e?'hi':'')+'">'+pct(x.e,x.n)+' %</td></tr>'}).join("")+'</tbody></table></div>'}
var h='<div class="ins"><div class="dcard"><h3>Délai avant une réponse</h3>'+(avg==null?'<p class="dn">Pas encore assez de réponses pour le calculer.</p>':'<p class="dn" style="margin:0"><b style="font-size:1.3rem;color:var(--ink)">'+avg+' jour'+(avg>1?'s':'')+'</b> en moyenne'+(med!=null?', '+med+' jour'+(med>1?'s':'')+' pour la moitié des réponses':'')+'. Au-delà de '+Math.max(14,(med||7)*3)+' jours sans nouvelles, une réponse devient peu probable.</p>')+'</div>'+
tab("Ce qui marche le mieux, par métier",function(o){return dMet(dInfo(o).poste)})+tab("Ce qui marche le mieux, par lieu",function(o){return dLieu(dInfo(o).lieu)})+tab("Ce qui marche le mieux, par site",function(o){return dSite(o)})+tab("Ce qui marche le mieux, par contrat",function(o){return ceCt({contrat:dInfo(o).contrat})||"Non précisé"})+'</div>';return h}
/* Apprendre de tes résultats : petit ajustement (5 points au plus) de la note des nouvelles offres selon le taux de réponse
   obtenu pour le même métier et le même contrat. Il faut au moins 5 candidatures comparables ; aucune offre n'est écartée. */
var LEARN=null;
function learnAdj(x){if(!LEARN||Date.now()-LEARN.at>6e5){var sent=OFF.filter(function(o){return o.st!=null&&o.st!==0&&dSent(o)}),g={};sent.forEach(function(o){var i=dInfo(o);["m:"+dMet(i.poste),"c:"+(ceCt({contrat:i.contrat})||"")].forEach(function(k){var e=g[k]=g[k]||{n:0,r:0};e.n++;if(dResp(o))e.r++})});
var base=sent.length?sent.filter(dResp).length/sent.length:0;LEARN={at:Date.now(),g:g,base:base,ok:sent.length>=10}}
if(!LEARN.ok)return null;var adj=0,why=[];[["m:"+dMet(x.titre),"ce métier"],["c:"+(ceCt(x)||""),"ce type de contrat"]].forEach(function(p){var e=LEARN.g[p[0]];if(!e||e.n<5||p[0]==="c:")return;var d=Math.max(-3,Math.min(3,Math.round((e.r/e.n-LEARN.base)*25)));if(d){adj+=d;why.push(p[1]+" : "+Math.round(e.r/e.n*100)+" % de réponses pour toi")}});
adj=Math.max(-5,Math.min(5,adj));return adj?{d:adj,why:why.join(", ")}:null}
/* export */
G("expcsv").onclick=async function(){var n=G("expn");function q(v){v=String(v==null?"":v).replace(/\r?\n/g," ");return /[;"]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
var rows=[["Poste","Entreprise","Lieu","Contrat","Statut","Note","Ajoutée le","Envoyée le","Entretien","Notes","Lien"]];
OFF.forEach(function(o){var i=dInfo(o),a=o.an||o.meta||{};rows.push([i.poste,a.entreprise||(o.sug||{}).entreprise||"",i.lieu,i.contrat,o.st==null?"Nouvelle":(o.st===2&&o.ir?"Entretien, non retenu":ST[o.st]),i.score==null?"":i.score,new Date(o.ct).toLocaleDateString("fr-FR"),o.st>=1?new Date(dSent(o)).toLocaleDateString("fr-FR"):"",o.iv&&o.iv.at?new Date(o.iv.at).toLocaleString("fr-FR"):"",o.notes||"",i.url])});
var csv="﻿"+rows.map(function(r){return r.map(q).join(";")}).join("\r\n");
try{var d=await claude.use("downloads");if(!d)throw{code:"unavailable"};await d.save({filename:"Candidatures "+new Date().toISOString().slice(0,10)+".csv",data:new Blob([csv],{type:"text/csv"})});n.textContent=OFF.length+" candidatures exportées."}catch(e){n.textContent=e&&e.code==="cancelled"?"Export annulé.":"L'export n'a pas pu se faire ici ("+(e&&e.code||"erreur")+")."}};

/* ---------- Justificatif de recherche d'emploi (PDF) ---------- */
function jpDay(d){return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function jpSet(k){var n=new Date(),a,b;if(k==="m0"){a=new Date(n.getFullYear(),n.getMonth(),1);b=n}else if(k==="m1"){a=new Date(n.getFullYear(),n.getMonth()-1,1);b=new Date(n.getFullYear(),n.getMonth(),0)}else{a=new Date(n.getFullYear(),n.getMonth()-2,1);b=n}G("jpfrom").value=jpDay(a);G("jpto").value=jpDay(b)}
/* Candidatures envoyées entre deux dates (incluses), triées par date d'envoi. */
function jpRows(from,to){var a=new Date(from+"T00:00:00").getTime(),b=new Date(to+"T23:59:59").getTime();return OFF.filter(function(o){if(o.st==null||o.st===0)return false;var t=dSent(o);return t&&t>=a&&t<=b}).sort(function(x,y){return dSent(x)-dSent(y)}).map(function(o){var i=dInfo(o),a2=o.an||o.meta||{},sg=o.sug||{};
return {d:new Date(dSent(o)).toLocaleDateString("fr-FR"),e:String(a2.entreprise||sg.entreprise||"").split(" (")[0],p:i.poste||"",l:i.lieu||"",s:o.spont?"Candidature spontanée":dSite(o),r:o.st===2?(o.ir?"Entretien, non retenu":"Entretien"):o.st===4?"Premier contact":o.st===3?(o.autoRef?"Sans réponse":"Refus"):"En attente"}})}
/* Caractères hors de la police standard du PDF remplacés par leur équivalent simple. */
function jpTxt(s){return String(s==null?"":s).replace(/[‘’ʼ]/g,"'").replace(/[“”«»]/g,'"').replace(/[–—]/g,"-").replace(/œ/g,"oe").replace(/Œ/g,"OE").replace(/…/g,"...").replace(/[  ]/g," ").replace(/[^\x20-\x7e -ÿ]/g,"")}
async function jpPdf(from,to){var R=jpRows(from,to);var J=await loadJsPdf();var doc=new J({unit:"mm",format:"a4"}),W=210,M=14,y=18;
function fr(s){var d=new Date(s+"T12:00:00");return d.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}
doc.setFont("helvetica","bold");doc.setFontSize(15);doc.text(jpTxt("Justificatif de recherche d'emploi"),M,y);y+=7;
doc.setFont("helvetica","normal");doc.setFontSize(10);var who=[PF.nom,pfLoc(),PF.mail,PF.tel].filter(Boolean).map(jpTxt);if(who.length){doc.text(who.join("  ·  ").replace(/·/g,"-"),M,y);y+=5}
doc.text(jpTxt("Période : du "+fr(from)+" au "+fr(to)),M,y);y+=5;
var cnt={};R.forEach(function(r){cnt[r.r]=(cnt[r.r]||0)+1});
doc.text(jpTxt(R.length+" candidature"+(R.length>1?"s":"")+" envoyée"+(R.length>1?"s":"")+(R.length?" : "+Object.keys(cnt).map(function(k){return cnt[k]+" "+k.toLowerCase()}).join(", "):"")+"."),M,y);y+=8;
var C=[["Date",20],["Entreprise",37],["Poste",46],["Lieu",28],["Site",30],["Réponse",21]];
function head(){doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setFillColor(238,238,238);doc.rect(M,y-4,W-2*M,6,"F");var x=M+1;C.forEach(function(c){doc.text(jpTxt(c[0]),x,y);x+=c[1]});y+=4;doc.setFont("helvetica","normal")}
head();
R.forEach(function(r){var cells=[r.d,r.e,r.p,r.l,r.s,r.r].map(function(v,i){return doc.splitTextToSize(jpTxt(v)||"-",C[i][1]-2)}),h=Math.max.apply(null,cells.map(function(c){return c.length}))*3.6+2;
if(y+h>285){doc.addPage();y=18;head()}var x=M+1;cells.forEach(function(c,i){doc.text(c,x,y+1);x+=C[i][1]});doc.setDrawColor(225,225,225);doc.line(M,y+h-2.2,W-M,y+h-2.2);y+=h});
if(!R.length){doc.setFontSize(10);doc.text(jpTxt("Aucune candidature envoyée sur cette période."),M,y+4)}
var pages=doc.getNumberOfPages();for(var i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7.5);doc.setTextColor(130);doc.text(jpTxt("Établi le "+new Date().toLocaleDateString("fr-FR")+" à partir du suivi de candidatures  -  page "+i+" / "+pages),M,292);doc.setTextColor(0)}
return {blob:doc.output("blob"),n:R.length}}
(function(){if(!G("jpgo"))return;jpSet("m1");document.querySelectorAll("[data-jp]").forEach(function(b){b.onclick=function(){jpSet(b.getAttribute("data-jp"))}});
G("jpgo").onclick=async function(){var n=G("jpn"),f=G("jpfrom").value,t=G("jpto").value;if(!f||!t||f>t){n.textContent="Choisis une période valide.";return}n.textContent="Création...";
try{var r=await jpPdf(f,t);var d=await claude.use("downloads");if(!d)throw{code:"unavailable"};await d.save({filename:"Justificatif recherche d'emploi "+f+" au "+t+".pdf",data:r.blob});n.textContent=r.n+" candidature"+(r.n>1?"s":"")+" dans le PDF."}
catch(e){n.textContent=e&&e.code==="cancelled"?"Annulé.":"Le PDF n'a pas pu être créé ("+(e&&(e.code||e.message)||"erreur")+").";if(window.CE_err&&!(e&&e.code))CE_err(e,"justificatif")}}})();

var PREPO=null;
function irsegHtml(o){var past=o.st===2&&!o.ir&&o.iv&&o.iv.at&&o.iv.at<Date.now(),h='<div class="irseg">';
if(o.st===2)h+='<div class="irst" role="group" aria-label="Suivi de cet entretien"><button type="button" data-ir="0" aria-pressed="'+(!o.ir)+'">En cours</button><button type="button" data-ir="1" class="no" aria-pressed="'+(!!o.ir)+'">Non retenu</button></div>';
if(!(o.st===2&&o.ir)){var a=[];if(o.st===2&&!past)if(o.st===2&&!past&&o.iv&&o.iv.at)a.push('<button type="button" class="ivb" data-ics title="Ajouter au Calendrier">+ Calendrier</button>');a.push('<button type="button" class="ivb" data-iv><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'+(o.iv&&o.iv.at?esc(o.iv.noh?'Heure ?':ivFmt(o.iv.at,1)):'Fixer la date')+'</button>');
a.push('<button type="button" class="prep" data-prep>'+(o.prep?'Ma fiche entretien':'Préparer l\'entretien')+'</button>');if(past)a.push('<button type="button" class="prep'+(postHas(o)?'':' due')+'" data-post>'+(postHas(o)?'Mon débrief':'Après l\'entretien')+'</button>');
h+='<div class="irac'+(a.length===1?' one':'')+'">'+a.join("")+'</div>'}return h+'</div>'}