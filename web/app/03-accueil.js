/* ---------- Navigation et prise en main ---------- */
function agoTxt(t){var m=Math.round((Date.now()-t)/6e4);if(m<1)return "à l'instant";if(m<60)return "il y a "+m+" min";var h=Math.round(m/60);if(h<24)return "il y a "+h+" h";var d=Math.round(h/24);return d===1?"hier":"il y a "+d+" jours"}
var VIEWS={mapv:["mapv"],home:["hello","cmdsec","hnext","todo","hfeed"],dashbox:["dashbox"],pastewrap:["pastewrap","res"],sugbox:["sugbox"],histbox:["histbox"]},VIEW="home";
function setView(v){if(!VIEWS[v])v="home";var chg=v!==VIEW;VIEW=v;if(v==="sugbox"&&!window.CE_BG&&SG.at&&(SG.seenAt||0)<SG.at){SG.seenAt=SG.at;try{sgSave()}catch(e){}}Object.keys(VIEWS).forEach(function(k){VIEWS[k].forEach(function(id){var e=G(id);if(e)e.classList.toggle("offv",k!==v)})});
VIEWS[v].forEach(function(id){var e=G(id);if(e&&e.tagName==="DETAILS"&&!e.open)e.open=true});
document.querySelectorAll("#bnav [data-go]").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-go")===v);b.setAttribute("aria-current",b.getAttribute("data-go")===v?"page":"false")});
document.body.setAttribute("data-view",v);if(chg)window.scrollTo(0,0);try{homeUI()}catch(e){}if(v==="histbox"){try{mlUI()}catch(e){}if(chg&&ML.last&&Date.now()-ML.last>20*6e4)setTimeout(function(){try{mlCheck(true)}catch(e){}},400)}}
function goTo(k){if(k==="cmd"){setView("home");var p=G("cmdp");p.hidden=false;G("cmdb").setAttribute("aria-expanded","true");setTimeout(function(){try{G("cmdt").focus({preventScroll:true})}catch(e){}},200);return}
setView(k)}
function goTab(t){TAB=t;try{localStorage.setItem(K+"tab",TAB)}catch(e){}renderList();goTo("histbox")}
document.querySelectorAll("#bnav [data-go]").forEach(function(b){b.onclick=function(){goTo(b.getAttribute("data-go"))}});
document.querySelectorAll(".page > details.sugd > summary").forEach(function(sm){sm.addEventListener("click",function(e){e.preventDefault()})});
function homeUI(){var H=G("homeq");if(!H)return;var fn=String(PF.nom||"").trim().split(/\s+/)[0];var hr=new Date().getHours();G("hello").textContent=(hr>=18||hr<5?"Bonsoir":"Bonjour")+(fn?" "+fn:"")+" !";
var sent=OFF.filter(function(o){return o.st===1}).length,itv=OFF.filter(function(o){return o.st===2&&!o.ir}).length,pc=OFF.filter(function(o){return o.st===4}).length,sn=sgNewN(),tot=(function(){try{return (sgKeep()||[]).length}catch(e){return 0}})();
var all=OFF.filter(function(o){return o.st>=1}),resp=all.filter(dResp).length;
function T(k,ico,t,sub){return '<button type="button" class="hq" data-go2="'+k+'"><span class="hqi"><svg viewBox="0 0 24 24">'+ico+'</svg></span><b>'+t+'</b><small>'+sub+'</small></button>'}
H.innerHTML=T("histbox",'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',"Mes candidatures",sent+" en attente"+(itv?" · "+itv+" entretien"+(itv>1?"s":""):"")+(pc?" · "+pc+" contact"+(pc>1?"s":""):""))+
T("sugbox",'<path d="M4 7h16M4 12h16M4 17h10"/>',"Suggérées",sn?sn+" nouvelle"+(sn>1?"s":""):tot?tot+" offre"+(tot>1?"s":""):"Lancer une recherche")+
T("pastewrap",'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',"Analyser","Lien, texte ou captures")+
T("dashbox",'<path d="M5 20V11M12 20V5M19 20v-7"/>',"Stats",all.length?Math.round(resp*100/all.length)+" % de réponses":"Rien pour l'instant");
H.querySelectorAll("[data-go2]").forEach(function(b){b.onclick=function(){goTo(b.getAttribute("data-go2"))}});
var bh=G("bdgh");if(bh){var n=(ML.pend||[]).filter(function(p){return ML.seen.indexOf(p.mid)<0}).length+(ML.auto||[]).length;bh.hidden=!n||VIEW==="home";bh.textContent=n}}
function sgNewN(){try{return (sgKeep()||[]).filter(function(x){return SG.at&&x.fd===SG.at}).length}catch(e){return 0}}
/* Pastille sur l'icône de l'app : réponses à valider, nouvelles suggestions de la dernière recherche,
   débriefs d'entretien et entretiens des prochaines 24 h. Même chiffre envoyé avec les notifications (CE_badgeN). */
function badgeN(){var now=Date.now();try{return (ML.pend||[]).filter(function(p){return ML.seen.indexOf(p.mid)<0}).length+((SG.seenAt||0)<SG.at?sgNewN():0)+OFF.filter(postDue).length+OFF.filter(function(o){return o.st===2&&!o.ir&&o.iv&&o.iv.at&&o.iv.at>now-36e5&&o.iv.at<now+864e5}).length}catch(e){return 0}}
var BADGE=-1;function appBadge(){if(window.CE_BG||!navigator.setAppBadge)return;var n=badgeN();if(n===BADGE)return;BADGE=n;try{(n>0?navigator.setAppBadge(n):navigator.clearAppBadge()).catch(function(){})}catch(e){}}
window.CE_badgeN=badgeN;
function todoUI(){var T=G("todo");if(!T)return;var now=Date.now(),nx=null;try{nx=homeNext()}catch(e){}try{homeFeed()}catch(e){}
var pend=(ML.pend||[]).filter(function(p){return ML.seen.indexOf(p.mid)<0}).length,sn=sgNewN(),aun=(ML.auto||[]).length,
itv=OFF.filter(function(o){return o.st===2&&!o.ir}).length,pc=OFF.filter(function(o){return o.st===4}).length,todo=OFF.filter(function(o){return o.st===0}).length,R=[];
function P(n,s,p){return n+" "+(n>1?p||s+"s":s)}
if(pend)R.push({c:"r",b:pend,t:P(pend,"réponse")+" à valider",a:"Valider",k:"mail"});
OFF.filter(postDue).forEach(function(o){var e=coName(o)||dInfo(o).poste||"";R.push({c:"g",b:"?",t:"Débrief de l'entretien"+(e?" · "+e:""),a:"Ouvrir",post:o.id})});
var up=OFF.filter(function(o){return o.st===2&&!o.ir&&o.iv&&o.iv.at&&o.iv.at>now-36e5&&o.iv.at<now+7*864e5&&o!==nx}).sort(function(a,c){return a.iv.at-c.iv.at});
up.forEach(function(o){var e=coName(o)||dInfo(o).poste||"";R.push({c:"g",b:"!",t:"Entretien "+ivTxt(o.iv,1)+(e?" · "+e:""),a:"Voir",oid:o.id})});
if(aun)R.push({c:"g",b:aun,t:P(aun,"mise")+" à jour "+(aun>1?"automatiques":"automatique"),a:"Voir",k:"mail"});
if(sn)R.push({c:"o",b:sn,t:P(sn,"nouvelle suggestion","nouvelles suggestions"),a:"Voir",k:"sug"});
var stl=staleList().length;if(stl)R.push({c:"o",b:stl,t:P(stl,"offre")+" à postuler depuis plus de 2 semaines",a:"Trier",k:"stale"});if(todo>stl)R.push({c:"",b:todo-stl,t:P(todo-stl,"offre")+" à postuler",a:"Voir",k:"todo"});
if(pc)R.push({c:"",b:pc,t:P(pc,"premier contact","premiers contacts")+" en cours",a:"Voir",k:"pc"});
if(itv&&!up.length&&!nx)R.push({c:"g",b:itv,t:P(itv,"entretien")+" en cours",a:"Voir",k:"itv"});
T.hidden=false;T.innerHTML='<h3 class="tdh">À faire</h3>'+(R.length?'<div class="tdr">'+R.slice(0,7).map(function(r,i){return '<button type="button" class="tdi '+r.c+'" data-i="'+i+'"><b>'+esc(String(r.b))+'</b><span>'+esc(r.t)+'</span><em>'+r.a+'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></em></button>'}).join("")+'</div>':'<p class="note tdz">Rien d\'urgent pour l\'instant, tout est à jour.</p>');
T.querySelectorAll("[data-i]").forEach(function(b){b.onclick=function(){var r=R[+b.getAttribute("data-i")];if(!r)return;if(r.post){var o=find(r.post);if(o)postOpen(o)}else if(r.oid){TAB="itv";showInList(r.oid)}else if(r.k==="stale")staleOpen();else if(r.k==="mail")goTo("histbox");else if(r.k==="sug")goTo("sugbox");else goTab(r.k)}});
appBadge();var bs=G("bdgs"),bo=G("bdgo");if(bs){bs.hidden=!sn;bs.textContent=sn>99?"99+":sn}if(bo){bo.hidden=!pend;bo.textContent=pend}}

/* ---------- Accueil : quoi de neuf ---------- */
function homeFeed(){var F=G("hfeed");if(!F)return;var lim=Date.now()-30*864e5,ev=[];
OFF.forEach(function(o){var h=o.hist||[],lastS=-1;for(var i=h.length-1;i>=0;i--){if(h[i].s!=null){lastS=i;break}}var e=coName(o)||"",p=dInfo(o).poste||"";
h.forEach(function(x,i){if(!x||x.t<lim)return;var t="",c="";if(x.s!=null){if(x.s===0)return;if(x.s===1){t="Candidature envoyée";c=""}else if(x.s===4){t="Premier contact";c="b"}else if(x.s===2){if(x.ir){t="Non retenu après l'entretien";c="r"}else{t="Entretien obtenu";c="g"}}else if(x.s===3){t=i===lastS&&o.expRef?"Annonce retirée, passée en Refusée":i===lastS&&o.autoRef?"Sans réponse, passée en Refusée":"Refus reçu";c="r"}}
else if(x.x){if(/^Mail :/.test(x.x))return;t=x.x;c=/^Entretien|^Appel/.test(x.x)?"g":""}if(t)ev.push({t:x.t,l:t,c:c,e:e,p:p,id:o.id,k:x.s!=null?o.id+"|s"+x.s+(x.s===2&&x.ir?"r":""):o.id+"|x|"+x.x,ok:o.id+"|"+x.t+"|"+t})})});
try{if(SG.at&&SG.at>lim){var n=(SG.items||[]).filter(function(x){return x.fd===SG.at}).length;if(n)ev.push({t:SG.at,k:"sug|"+SG.at,l:n+" nouvelle"+(n>1?"s":"")+" offre"+(n>1?"s":"")+" suggérée"+(n>1?"s":""),c:"o",sug:1})}}catch(e){}
var HID=PF.fhid||[],CLR=PF.fclr||0;ev=ev.filter(function(x){return x.t>CLR&&HID.indexOf(x.k)<0&&HID.indexOf(x.ok)<0});ev.sort(function(a,b){return b.t-a.t});var sk={};ev=ev.filter(function(x){if(sk[x.k])return false;sk[x.k]=1;return true});ev=ev.slice(0,5);
F.hidden=false;F.innerHTML='<div class="fdh"><h3 class="tdh">Quoi de neuf</h3>'+(ev.length?'<button type="button" class="fdclr">Tout effacer</button>':'')+'</div>'+(ev.length?'<div class="tdr">'+ev.map(function(x,i){return '<div class="fdi '+x.c+'"><button type="button" class="fdo" data-f="'+i+'"><i></i><span><b>'+esc(x.l)+'</b><small>'+esc([x.e,x.sug?'':x.p].filter(Boolean).join(' · ')||'Offres suggérées')+'</small></span><time class="fdt" datetime="'+new Date(x.t).toISOString()+'" data-t="'+x.t+'">'+esc(agoTxt(x.t))+'</time></button><button type="button" class="fdx" data-x="'+i+'" aria-label="Supprimer cette notification"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></div>'}).join("")+'</div>':'<p class="note tdz">Rien de nouveau pour l\'instant.</p>');
function fsave(){PF.mt=Date.now();lss("pf",PF);mark("profil",1);homeFeed()}
F.querySelectorAll("[data-x]").forEach(function(b){b.onclick=function(){var x=ev[+b.getAttribute("data-x")];if(!x)return;PF.fhid=(PF.fhid||[]).concat([x.k]).slice(-400);fsave()}});
var cl=F.querySelector(".fdclr");if(cl)cl.onclick=function(){PF.fclr=Date.now();PF.fhid=[];fsave()};
F.querySelectorAll("[data-f]").forEach(function(b){b.onclick=function(){var x=ev[+b.getAttribute("data-f")];if(!x)return;if(x.sug){goTo("sugbox");return}TAB="all";showInList(x.id)}})}
/* ---------- Accueil : entretien imminent ---------- */
function homeNext(){var H=G("hnext");if(!H)return null;var now=Date.now(),o=OFF.filter(function(o){return o.st===2&&!o.ir&&o.iv&&o.iv.at&&o.iv.at>now-60*6e4&&o.iv.at<now+48*36e5}).sort(function(a,c){return a.iv.at-c.iv.at})[0];
if(!o){H.hidden=true;H.innerHTML="";return null}var iv=o.iv,d=iv.at-now,cd;
if(iv.noh)cd=ivTxt(iv);else if(d<=0)cd="C'est maintenant";else{var dj=Math.floor(d/864e5),hh=Math.floor(d%864e5/36e5),mm=Math.floor(d%36e5/6e4);cd="Dans "+(dj?dj+" j "+hh+" h":hh?hh+" h "+String(mm).padStart(2,"0"):Math.max(1,mm)+" min")}
var a=o.an||o.meta||{},loc=String(iv.loc||"").trim(),kind=iv.kind||"",act="";
var url=(loc.match(/https?:\/\/\S+/)||[])[0],tel=(loc.replace(/[\s.]/g,"").match(/(\+33|0)[1-9]\d{8}/)||[])[0];
if(url)act='<a class="sb sec" href="'+esc(url)+'" target="_blank" rel="noopener">Rejoindre la visio</a>';else if(tel&&/t[ée]l[ée]phone/i.test(kind))act='<a class="sb sec" href="tel:'+esc(tel)+'">Appeler</a>';else if(loc&&!/visio|t[ée]l[ée]phone/i.test(kind))act='<a class="sb sec" href="https://maps.apple.com/?q='+encodeURIComponent(loc)+'" target="_blank" rel="noopener">Itinéraire</a>';else act='<button type="button" class="sb sec" data-hn="iv">Modifier la date</button>';
H.innerHTML='<div class="hnh"><span class="hnl">Entretien imminent</span><span class="hncd">'+esc(cd)+'</span></div><h3>'+esc(dInfo(o).poste||"Entretien")+'</h3><p class="note">'+esc([String(a.entreprise||"").split(" (")[0],ivTxt(iv),kind].filter(Boolean).join(" · "))+'</p>'+(loc&&!url?'<p class="hnloc">'+esc(loc)+'</p>':'')+'<div class="hna"><button type="button" class="sb main" data-hn="prep">'+(o.prep?'Ma fiche entretien':'Préparer l\'entretien')+'</button>'+act+'</div>';
H.hidden=false;var pb=H.querySelector('[data-hn="prep"]');if(pb)pb.onclick=function(){prepOpen(o)};var ib=H.querySelector('[data-hn="iv"]');if(ib)ib.onclick=function(){ivOpen(o)};return o}
setInterval(function(){if(VIEW==="home"&&!document.hidden){try{homeNext()}catch(e){}try{document.querySelectorAll("#hfeed .fdt").forEach(function(t){t.textContent=agoTxt(+t.getAttribute("data-t"))})}catch(e){}}},30000);
document.addEventListener("visibilitychange",function(){if(!document.hidden&&VIEW==="home"){try{todoUI()}catch(e){}}});

/* ---------- Accueil : offre du jour ---------- */

(function(){var _rl=renderList;renderList=function(){_rl.apply(this,arguments);try{todoUI();homeUI()}catch(e){}};var _ml=mlUI;mlUI=function(){_ml.apply(this,arguments);try{todoUI()}catch(e){}};var _ss=sgSave;sgSave=function(){_ss.apply(this,arguments);try{todoUI()}catch(e){}}})();
setInterval(function(){try{todoUI();homeUI()}catch(e){}},5000);
document.querySelectorAll("dialog.sheet [data-close]").forEach(function(b){b.onclick=function(){b.closest("dialog").close()}});
document.querySelectorAll("dialog.sheet").forEach(function(d){d.addEventListener("click",function(e){if(e.target===d)d.close()})});
function shOpen(d){if(!d.open){try{d.showModal()}catch(e){d.setAttribute("open","")}}}
/* statut rapide */
function stSheet(o){var d=G("stsh"),L=G("stshl");G("stshn").textContent=mlOffLabel(o);
L.innerHTML=STORD.map(function(i){var cur=o.st===i;return '<button type="button" data-v="'+i+'" aria-current="'+cur+'"><span>'+esc(ST[i])+'</span>'+(cur?'<span>Actuel</span>':'')+'</button>'+(i===2&&o.st===2?'<div class="sub"><button type="button" data-ir="0" aria-current="'+(!o.ir)+'">En cours</button><button type="button" data-ir="1" aria-current="'+(!!o.ir)+'">Non retenu</button></div>':'')}).join("");
L.querySelectorAll("[data-v]").forEach(function(b){b.onclick=function(){var v=+b.getAttribute("data-v");if(v!==o.st){cmdApply(o.id,v,false);if(v===1)o.sentAt=Date.now()}d.close()}});
L.querySelectorAll("[data-ir]").forEach(function(b){b.onclick=function(){cmdApply(o.id,2,b.getAttribute("data-ir")==="1");d.close()}});
shOpen(d)}
/* fiche entretien */
function prepList(a){return '<ul>'+(a||[]).map(function(x){return '<li>'+esc(String(x).replace(/\s*—\s*/g,", "))+'</li>'}).join("")+'</ul>'}
var COTRY={};function prepRender(o){var B=G("prepb"),P=o.prep&&o.prep.d;G("prept").textContent="Entretien · "+(dInfo(o).poste||"Offre");if(o.cof===undefined&&!COTRY[o.id]){COTRY[o.id]=1;coLoad(o).then(function(c){if(c===undefined)COTRY[o.id]=2;if(G("prepd").open&&PREPO===o)prepRender(o)})}PREPO=o;var CO=(o.cof===undefined&&COTRY[o.id]===2)?"":coHtml(o);
if(!P){B.innerHTML='<p class="note">'+esc(mlOffLabel(o))+'</p><p>Je prépare une fiche à partir de l\'annonce et de ton CV : ce qu\'il faut savoir sur le poste et l\'entreprise, tes atouts à mettre en avant, les questions probables avec des pistes de réponse, et les questions à poser.</p><div class="row"><button type="button" class="sb main" id="prepgo">Préparer ma fiche</button><span class="note" id="prepn"></span></div>'+CO;G("prepgo").onclick=function(){prepGen(o)};return}
var h='<p class="note">'+esc(mlOffLabel(o))+' · fiche du '+new Date(o.prep.at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+'</p>';
if(P.poste&&P.poste.length)h+='<section><h4>Le poste en bref</h4>'+prepList(P.poste)+'</section>';
h+=CO;if(P.entreprise&&P.entreprise.length)h+='<section><h4>L\'entreprise</h4>'+prepList(P.entreprise)+'</section>';
if(P.atouts&&P.atouts.length)h+='<section><h4>Tes atouts à mettre en avant</h4>'+prepList(P.atouts)+'</section>';
if(P.points_faibles&&P.points_faibles.length)h+='<section><h4>Points sensibles et comment y répondre</h4>'+P.points_faibles.map(function(x){return '<div class="qa"><b>'+esc(x.point||"")+'</b><span class="ph">'+esc(String(x.reponse||"").replace(/\s*—\s*/g,", "))+'</span></div>'}).join("")+'</section>';
if(P.questions&&P.questions.length)h+='<section><h4>Questions probables</h4>'+P.questions.map(function(x){return '<div class="qa"><b>'+esc(x.question||"")+'</b><span class="ph">'+esc(String(x.piste||"").replace(/\s*—\s*/g,", "))+'</span></div>'}).join("")+'</section>';
if(P.a_poser&&P.a_poser.length)h+='<section><h4>Questions à poser</h4>'+prepList(P.a_poser)+'</section>';
if(P.pratique&&P.pratique.length)h+='<section><h4>Côté pratique</h4>'+prepList(P.pratique)+'</section>';
h+='<div class="row"><button type="button" class="sb sec" id="prepgo">Refaire la fiche</button><span class="note" id="prepn"></span></div>';B.innerHTML=h;G("prepgo").onclick=function(){prepGen(o)}}
function prepOpen(o){prepRender(o);shOpen(G("prepd"));G("prepb").scrollTop=0}
async function prepGen(o){var n=G("prepn"),b=G("prepgo"),sample=null;try{sample=await claude.use("sample")}catch(e){}if(!sample){n.textContent="La préparation n'est pas disponible dans cette vue. Vérifie ta connexion internet puis réessaie.";return}
b.disabled=true;n.textContent="Préparation en cours, une vingtaine de secondes...";
try{var cof=null,coT="";try{cof=await coLoad(o)}catch(e){}try{coT=await companyInfo(o)}catch(e){}var a=o.an||o.meta||{},cv=cvFor("fr"),cvt="";try{cvt=JSON.stringify(cv).slice(0,5000)}catch(e){}
var P=await sample.json("Tu aides {{PRENOM}} à préparer un entretien d'embauche. Tutoie-le, écris en français naturel, phrases courtes, sans tirets longs, sans jargon RH. Appuie-toi UNIQUEMENT sur l'annonce, l'analyse et son CV ci-dessous. Pour l'entreprise, sers-toi de l'annonce, des INFOS ENTREPRISE ci-dessous (Indeed et recherche web) et seulement de faits très connus ; si tu n'es pas sûr, écris « à vérifier sur leur site ». N'invente aucune expérience : les atouts et pistes de réponse doivent venir de son CV.\n\nStatut : "+(o.st===4?"premier contact avec un recruteur, entretien pas encore fixé":"entretien prévu")+".\n\nANALYSE DE L'OFFRE :\n"+JSON.stringify({poste:a.poste,entreprise:a.entreprise,lieu:a.lieu,contrat:a.contrat,salaire:a.salaire,resume:a.resume,points_forts:a.forts,points_faibles:a.faibles,conseil:a.conseil,mots_cles:a.motscles})+"\n\nANNONCE :\n"+String(o.txt||"").slice(0,4000)+"\n\nINFOS ENTREPRISE :\n"+JSON.stringify(cof||{}).slice(0,1500)+"\n"+String(coT||"").slice(0,2500)+"\n\nCV :\n"+cvt+"\n\nRéponds en JSON seulement : {\"poste\":[\"3 à 5 points clés du poste\"],\"entreprise\":[\"2 à 4 points\"],\"atouts\":[\"4 à 6 atouts concrets tirés du CV, reliés au poste\"],\"points_faibles\":[{\"point\":\"un écart possible avec l'annonce\",\"reponse\":\"comment l'aborder honnêtement\"}],\"questions\":[{\"question\":\"question probable\",\"piste\":\"piste de réponse avec un exemple de son parcours\"}],\"a_poser\":[\"4 à 5 questions à poser au recruteur\"],\"pratique\":[\"3 à 5 rappels pratiques : documents, tenue, horaires, trajet ou visio\"]}\nDonne 8 questions probables.",{cache:false,modelTier:"default"});
if(!P||typeof P!=="object"||!(P.questions||P.atouts))throw{code:"réponse vide"};o.prep={d:P,at:Date.now()};touch(o);saveOff();mark("o_"+o.id,1);prepRender(o);try{renderList()}catch(e){}}
catch(e){n.textContent="La préparation a échoué ("+(e&&e.code||"erreur")+"). Réessaie.";b.disabled=false}}
/* chips d'instruction */
document.querySelectorAll("#cmdchips button").forEach(function(b){b.onclick=function(){var t=G("cmdt");if(b.dataset.run){t.value=b.dataset.run;cmdRun();return}t.value=b.dataset.fill;t.focus();try{t.setSelectionRange(t.value.length,t.value.length)}catch(e){}}});
/* guide */
var GD=[["M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z","Bienvenue dans Candidature Express","La barre en bas te fait passer d'un espace à l'autre : Accueil, Analyser, Suggérées, Candidatures et Stats. Sur l'accueil, « Donner une instruction » te laisse écrire ce que tu veux en langage normal : « j'ai reçu un appel de Manpower », « prépare mon entretien chez Thales »."],
["M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.3-4.3","1. Trouver et analyser","« Suggestions » rassemble les offres trouvées pour toi. « Analyser » lit une annonce (lien, texte ou captures), te donne une note et prépare un CV et une lettre adaptés."],
["M4 4h16v16H4zM8 9h8M8 13h8M8 17h5","2. Suivre tes candidatures","Dans « Mes candidatures », appuie sur l'étiquette de statut d'une offre (ou reste appuyé sur la ligne) pour la changer : Envoyée, Premier contact, Entretien, Refusée. Le bandeau « À faire » en haut te dit quoi traiter en priorité."],
["M5 20V11M12 20V5M19 20v-7","3. Répondre et progresser","« Vérifier mes mails » relie les réponses reçues à tes offres. Pour un entretien, « Préparer l'entretien » te fait une fiche complète. « Stats » montre où tu en es."]],GI=0;
function gdUI(){var g=GD[GI];G("gdots").innerHTML=GD.map(function(x,i){return '<i class="'+(i===GI?"on":"")+'"></i>'}).join("");
G("gdc").innerHTML='<div class="gico"><svg viewBox="0 0 24 24"><path d="'+g[0]+'"/></svg></div><h3 id="gdt">'+esc(g[1])+'</h3><p>'+esc(g[2])+'</p>';
G("gdprev").hidden=!GI;G("gdnext").textContent=GI===GD.length-1?"C'est parti":"Suivant"}
function gdOpen(){GI=0;gdUI();shOpen(G("guided"))}
function gdEnd(){lss("guide",1);G("guided").close()}
G("gdnext").onclick=function(){if(GI<GD.length-1){GI++;gdUI()}else gdEnd()};G("gdprev").onclick=function(){if(GI>0){GI--;gdUI()}};G("gdskip").onclick=gdEnd;
G("guided").addEventListener("cancel",function(){lss("guide",1)});
G("helpb").onclick=gdOpen;
setView("home");setTimeout(function(){try{todoUI();homeUI();if(!lsg("guide",0))gdOpen()}catch(e){}},900);
