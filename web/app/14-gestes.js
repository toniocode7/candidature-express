/* ---------- Gestes, vibrations, transitions, fêtes et calendrier ---------- */
var RMOT=false;try{RMOT=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}

/* Petite vibration quand un geste est validé. L'iPhone n'autorise pas les vibrations dans une app web : on utilise
   l'interrupteur natif de Safari (iOS 18 et plus), qui fait vibrer quand il change d'état. Sans effet ailleurs. */
var HAP=null;
function buzz(){try{if(navigator.vibrate&&!/iPhone|iPad/.test(navigator.userAgent)){navigator.vibrate(10);return}
if(!HAP){var l=document.createElement("label"),i=document.createElement("input");l.setAttribute("aria-hidden","true");l.style.cssText="position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";i.type="checkbox";i.setAttribute("switch","");i.tabIndex=-1;l.appendChild(i);document.body.appendChild(l);HAP=l}
HAP.click()}catch(e){}}

/* Barre du bas : faire glisser le doigt d'un onglet à l'autre ; l'onglet sous le doigt s'allume, on y va au relâchement. */
(function(){var N=G("bnav");if(!N)return;var act=false,cur=null,moved=false;
function at(x,y){var e=document.elementFromPoint(x,y);return e&&e.closest?e.closest("#bnav [data-go]"):null}
function clear(){N.querySelectorAll(".scrub").forEach(function(b){b.classList.remove("scrub")})}
N.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse")return;act=true;moved=false;cur=at(e.clientX,e.clientY);try{N.setPointerCapture(e.pointerId)}catch(er){}});
N.addEventListener("pointermove",function(e){if(!act)return;var b=at(e.clientX,Math.min(e.clientY,N.getBoundingClientRect().bottom-4));if(b&&b!==cur){cur=b;moved=true;clear();b.classList.add("scrub");buzz()}});
function end(){if(!act)return;act=false;clear();if(moved&&cur){N.dataset.skip="1";goTo(cur.getAttribute("data-go"));setTimeout(function(){delete N.dataset.skip},450)}}
N.addEventListener("pointerup",end);N.addEventListener("pointercancel",function(){act=false;clear()});
N.addEventListener("click",function(e){if(N.dataset.skip){e.stopPropagation();e.preventDefault()}},true)})();

/* Fenêtres du bas : les tirer vers le bas pour les fermer (depuis l'en-tête, ou n'importe où quand le contenu est en haut). */
(function(){var S=null;
document.addEventListener("touchstart",function(e){var d=e.target.closest&&e.target.closest("dialog.sheet[open]");S=null;if(!d||innerWidth>=700||e.touches.length>1)return;
if(e.target.closest("input,textarea,select,.simrec,.mpbox,.calg"))return;if(d.scrollTop>2&&!e.target.closest(".shh"))return;
S={d:d,y0:e.touches[0].clientY,x0:e.touches[0].clientX,dy:0,t0:Date.now(),on:false}},{passive:true});
document.addEventListener("touchmove",function(e){if(!S)return;var dy=e.touches[0].clientY-S.y0,dx=e.touches[0].clientX-S.x0;
if(!S.on){if(dy>10&&dy>Math.abs(dx)*1.3&&S.d.scrollTop<=2){S.on=true;S.d.style.transition="none"}else if(Math.abs(dx)>12||dy<-6){S=null;return}else return}
e.preventDefault();S.dy=Math.max(0,dy);S.d.style.transform="translateY("+S.dy+"px)"},{passive:false});
function end(){if(!S||!S.on){S=null;return}var d=S.d,v=S.dy/Math.max(1,Date.now()-S.t0);S=null;
if(d.style.transform&&(parseFloat(d.style.transform.slice(11))>130||(v>0.7&&parseFloat(d.style.transform.slice(11))>45))){buzz();d.style.transition="transform .2s ease-in";d.style.transform="translateY(105%)";setTimeout(function(){d.close();d.style.transform="";d.style.transition=""},190)}
else{d.style.transition="transform .22s cubic-bezier(.2,.8,.2,1)";d.style.transform="";setTimeout(function(){d.style.transition=""},230)}}
document.addEventListener("touchend",end);document.addEventListener("touchcancel",end)})();

/* Tirer l'écran vers le bas (en haut de page) : récupère les dernières données de ta base.
   Ni recherche ni lecture de mails : ceux-là restent sur leurs boutons. */
(function(){var P=null,ind=null,busy=false;
function pill(t,on){if(!ind){ind=document.createElement("div");ind.className="ptr";ind.setAttribute("role","status");document.body.appendChild(ind)}ind.textContent=t;ind.classList.toggle("on",!!on)}
document.addEventListener("touchstart",function(e){P=null;if(busy||window.scrollY>0||e.touches.length>1||document.querySelector("dialog[open]"))return;if(e.target.closest&&e.target.closest("#bnav,.mpbox,input,textarea,select"))return;P={y0:e.touches[0].clientY,x0:e.touches[0].clientX,dy:0}},{passive:true});
document.addEventListener("touchmove",function(e){if(!P)return;var dy=e.touches[0].clientY-P.y0,dx=e.touches[0].clientX-P.x0;if(window.scrollY>0||Math.abs(dx)>Math.abs(dy)){if(P.dy<10){P=null;if(ind)ind.classList.remove("on")}return}
P.dy=dy;if(dy>25){var r=dy>85;if(r&&!P.r)buzz();P.r=r;pill(r?"Relâche pour actualiser":"Tire pour actualiser",true);ind.style.transform="translate(-50%,"+Math.min(40,dy/3)+"px)"}},{passive:true});
document.addEventListener("touchend",async function(){if(!P)return;var go=P.r;P=null;if(!ind)return;ind.style.transform="";if(!go){ind.classList.remove("on");return}
busy=true;pill("Actualisation...",true);try{await pull();pill("À jour",true)}catch(e){pill("Pas de connexion pour l'instant",true)}busy=false;setTimeout(function(){if(ind)ind.classList.remove("on")},900)})})();

/* Transitions : l'onglet qui arrive glisse légèrement depuis le côté d'où l'on vient. */
(function(){var ORDER=["home","pastewrap","sugbox","histbox","dashbox"],_sv=setView;
setView=function(v){var from=VIEW,r=_sv.apply(this,arguments);try{if(!RMOT&&!window.CE_BG&&from!==VIEW&&VIEWS[VIEW]){var c=ORDER.indexOf(VIEW)>=ORDER.indexOf(from)?"vin-n":"vin-p";
VIEWS[VIEW].forEach(function(id){var e=G(id);if(!e)return;e.classList.remove("vin-n","vin-p");void e.offsetWidth;e.classList.add(c)});if(VIEW==="dashbox")calUI()}}catch(e){}return r}})();

/* Fête : confettis quand une candidature passe en Entretien (une seule fois par candidature, sur chaque appareil). */
function confetti(){if(RMOT)return;var c=document.createElement("canvas"),x=c.getContext("2d"),W=innerWidth,H=innerHeight,dpr=Math.min(2,devicePixelRatio||1);c.className="cnf";c.width=W*dpr;c.height=H*dpr;document.body.appendChild(c);x.scale(dpr,dpr);
var col=["#4338CA","#8B85F8","#16A34A","#F59E0B","#EC4899","#06B6D4"],P=[];for(var i=0;i<140;i++)P.push({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*9,vy:-Math.random()*11-4,s:4+Math.random()*5,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:col[i%col.length]});
var t0=performance.now();(function f(t){var k=(t-t0)/1000;x.clearRect(0,0,W,H);P.forEach(function(p){p.vy+=.32;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.globalAlpha=Math.max(0,1-k/2.2);x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.66);x.restore()});if(k<2.2)requestAnimationFrame(f);else c.remove()})(t0)}
function celebCheck(){if(window.CE_BG)return;var C=lsg("celeb",null),cand=OFF.filter(function(o){return o.st===2&&!o.ir});if(C===null){lss("celeb",cand.map(function(o){return o.id}));return}
var nw=cand.filter(function(o){return C.indexOf(o.id)<0});if(!nw.length)return;lss("celeb",C.concat(nw.map(function(o){return o.id})).slice(-500));setTimeout(function(){confetti();buzz()},250)}
(function(){var _r=renderList;renderList=function(){_r.apply(this,arguments);try{celebCheck()}catch(e){}try{if(VIEW==="dashbox")calUI()}catch(e){}}})();

/* ---------- Calendrier (onglet Stats) ---------- */
var CALM=null,CALD=null;
function calEvents(){var E={};function add(t,ev){var d=new Date(t),k=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();(E[k]=E[k]||[]).push(ev)}
OFF.forEach(function(o){if(o.iv&&o.iv.at&&(o.st===2||o.st===4)&&!o.ir)add(o.iv.at,{k:"iv",t:o.iv.at,o:o});if(o.st!=null&&o.st!==0){var s=dSent(o);if(s)add(s,{k:"sent",t:s,o:o})}});return E}
function calUI(){var B=G("calbox");if(!B)return;var now=new Date();if(!CALM)CALM=new Date(now.getFullYear(),now.getMonth(),1);var E=calEvents(),y=CALM.getFullYear(),m=CALM.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
var h='<div class="calh"><button type="button" class="gear" data-cm="-1" aria-label="Mois précédent"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><h3>'+esc(CALM.toLocaleDateString("fr-FR",{month:"long",year:"numeric"}))+'</h3><button type="button" class="gear" data-cm="1" aria-label="Mois suivant"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div><div class="calg" role="grid">'+["L","M","M","J","V","S","D"].map(function(d){return '<span class="cwd">'+d+'</span>'}).join("");
for(var i=0;i<first;i++)h+='<span></span>';
for(var d=1;d<=days;d++){var k=y+"-"+(m+1)+"-"+d,ev=E[k]||[],iv=ev.filter(function(e){return e.k==="iv"}).length,sn=ev.filter(function(e){return e.k==="sent"}).length,today=now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===d;
h+='<button type="button" class="cday'+(today?' today':'')+(CALD===k?' sel':'')+(ev.length?' has':'')+'" data-k="'+k+'" aria-label="'+d+(iv?", "+iv+" entretien"+(iv>1?"s":""):"")+(sn?", "+sn+" envoyée"+(sn>1?"s":""):"")+'"><b>'+d+'</b><i>'+(iv?'<em class="civ"></em>':'')+(sn?'<em class="csn"></em>':'')+'</i></button>'}
h+='</div><p class="note callg"><span><em class="civ"></em>Entretien ou appel prévu</span><span><em class="csn"></em>Candidature envoyée</span></p><div id="calday"></div>';
B.innerHTML='<div class="dcard">'+h+'</div>';
B.querySelectorAll("[data-cm]").forEach(function(b){b.onclick=function(){CALM=new Date(y,m+(+b.getAttribute("data-cm")),1);CALD=null;calUI()}});
B.querySelectorAll("[data-k]").forEach(function(b){b.onclick=function(){CALD=CALD===b.getAttribute("data-k")?null:b.getAttribute("data-k");calUI()}});
if(CALD){var L=(E[CALD]||[]).sort(function(a,b){return a.t-b.t}),p=CALD.split("-"),dd=new Date(+p[0],+p[1]-1,+p[2]),IV=L.filter(function(e){return e.k==="iv"}),SN=L.filter(function(e){return e.k==="sent"});
function nm(o){return [coName(o)||(o.an||o.meta||{}).entreprise||"",dInfo(o).poste].filter(Boolean).join(" · ")}
var sum=[SN.length?SN.length+" candidature"+(SN.length>1?"s":"")+" envoyée"+(SN.length>1?"s":""):"",IV.length?IV.length+" "+(IV.length>1?"rendez-vous":"rendez-vous"):""].filter(Boolean).join(" · ");
var h='<div class="caldh"><h4>'+esc(dd.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))+'</h4>'+(sum?'<span>'+esc(sum)+'</span>':'')+'</div>';
if(!L.length)h+='<p class="note">Rien ce jour-là.</p>';
h+=IV.map(function(e){var o=e.o,i=L.indexOf(e);return '<div class="cali iv" role="button" tabindex="0" data-ci="'+i+'"><span class="civ"></span><span class="calt"><b>'+esc((o.st===4?"Appel":"Entretien")+(o.iv.noh?"":" à "+new Date(e.t).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})))+'</b><small>'+esc(nm(o))+'</small></span></div>'}).join("");
if(SN.length)h+='<details class="calsn"'+(IV.length||SN.length<=3?'':'')+(SN.length<=3?' open':'')+'><summary><span class="csn"></span>'+(SN.length>3?'Voir les '+SN.length+' candidatures envoyées':SN.length>1?'Candidatures envoyées':'Candidature envoyée')+'</summary>'+SN.map(function(e){return '<div class="cals" role="button" tabindex="0" data-ci="'+L.indexOf(e)+'">'+esc(nm(e.o)||"Candidature")+'</div>'}).join("")+'</details>';
G("calday").innerHTML=h;
G("calday").querySelectorAll("[data-ci]").forEach(function(b){var go=function(){var e=L[+b.getAttribute("data-ci")];if(e)ofOpen(e.o)};b.onclick=go;b.onkeydown=function(k){if(k.key==="Enter"||k.key===" "){k.preventDefault();go()}}})}}
