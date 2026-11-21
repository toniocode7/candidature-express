/* ---------- Synchronisation entre appareils ---------- */
window.CE_PENDING_SYNC=function(){return Object.keys(SY.dirty).length+Object.keys(SY.fly||{}).length+(SY.busy?1:0)};var SY={col:null,t:null,dirty:{},fly:{},pri:{},busy:false};
var PFK=["nom","mail","tel","cp","adr","pays","lien","notes","photo"];
function pfEmpty(v){return v==null||String(v).trim()===""}
function pfMerge(v){var rp=v.p||{},clr=PF.clr||{},rclr=rp.clr||{},chg=false,need=false,remNewer=(v.mt||0)>(PF.mt||0);
PFK.forEach(function(k){var L=PF[k],R=rp[k],lc=clr[k]||0,rc=rclr[k]||0;
if(pfEmpty(R)&&pfEmpty(L))return;
if(pfEmpty(L)&&!pfEmpty(R)){if(lc&&lc>=(v.mt||0)){need=true;return}PF[k]=R;chg=true;return}
if(pfEmpty(R)&&!pfEmpty(L)){if(rc&&rc>(PF.mt||0)&&remNewer){PF[k]="";chg=true;return}need=true;return}
if(L!==R){if(remNewer){PF[k]=R;chg=true}else need=true}});
var fh=(PF.fhid||[]),rh=(rp.fhid||[]),uh=fh.concat(rh.filter(function(k){return fh.indexOf(k)<0})).slice(-400);if(uh.length!==fh.length){PF.fhid=uh;chg=true}if(uh.length!==rh.length)need=true;if((rp.fclr||0)>(PF.fclr||0)){PF.fclr=rp.fclr;chg=true}else if((PF.fclr||0)>(rp.fclr||0))need=true;
if(rp.set&&remNewer){PF.set=Object.assign({},PF.set||{},rp.set);chg=true}else if(rp.set&&!PF.set){PF.set=rp.set;chg=true}
if(remNewer)PF.mt=v.mt;if(chg)lss("pf",PF);if(need||(!remNewer&&(PF.mt||0)>(v.mt||0)))SY.dirty.profil=1;return chg}
function pfFromCv(force){var t=((CV.list||[]).map(function(c){return c.text}).join("\n"))||"";if(!t)return 0;var n=0;function put(k,v){if(v&&(force||pfEmpty(PF[k]))&&PF[k]!==v){PF[k]=v;n++}}
var m=/[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(t);put("mail",m&&m[0]);
m=/(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/.exec(t);put("tel",m&&m[0].replace(/\s+/g," ").trim());
m=/linkedin\.com\/in\/[\w%-]+/i.exec(t);put("lien",m&&("https://www."+m[0]));
m=/\b(\d{5})\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'\- ]{1,30})/.exec(t);if(m){put("cp",m[1]);put("adr",m[2].replace(/\s+(France|Tél|Tel|Mail|E-mail).*$/i,"").trim());put("pays","France")}
var first=t.split(/\n/).map(function(x){return x.trim()}).filter(Boolean)[0]||"";if(/^[A-ZÀ-Ý][a-zà-ÿ'\-]+(\s+[A-ZÀ-Ý][A-Za-zà-ÿ'\-]+){1,3}$/.test(first))put("nom",first);
if(n){PF.mt=Date.now();lss("pf",PF);mark("profil");pfUI()}return n}
function setSyn(t){G("syn").textContent=t||"";G("syn").title=t||""}
function mark(k,f){SY.dirty[k]=1;if(f)SY.pri[k]=1;if(!SY.col)return;clearTimeout(SY.t);SY.t=setTimeout(push,f||Object.keys(SY.pri).length?150:1200)}
function offDoc(o){return{id:o.id,txt:o.txt,src:o.src||"texte",url:o.url||"",an:o.an||null,st:o.st==null?null:o.st,co:o.co==null?null:o.co,ct:o.ct,mt:o.mt,rv:o.rv||0,key:o.key||"",meta:o.meta||null,sug:o.sug||null,sentAt:o.sentAt||0,autoRef:o.autoRef||0,itv:o.itv||0,ir:o.ir||0,exp:o.exp||0,exp1:o.exp1||0,chk:o.chk||0,expRef:o.expRef||0,prep:o.prep||null,iv:o.iv||null,hist:o.hist||[],notes:o.notes||"",post:o.post||null,cof:o.cof===undefined?undefined:o.cof,rcp:o.rcp||null}}
async function push(){if(!SY.col)return;if(SY.busy){clearTimeout(SY.t);SY.t=setTimeout(push,1500);return}SY.busy=true;var keys=Object.keys(SY.dirty),pri=SY.pri;SY.pri={};keys.sort(function(a,b){return (pri[b]?1:0)-(pri[a]?1:0)});SY.dirty={};keys.forEach(function(k){SY.fly[k]=1});var done={};
async function one(k){
if(k==="fc"){if(FC)await SY.col.doc("fc").set(FC)}
else if(k==="mail"){await SY.col.doc("mail").set(JSON.parse(JSON.stringify(ML)))}
else if(k==="profil"){var p=Object.assign({},PF);delete p.mt;await SY.col.doc("profil").set({p:p,mt:PF.mt||Date.now()})}
else if(k==="cvs"){await SY.col.doc("cvs").set({list:CV.list,mt:CV.mt||Date.now()})}
else if(k==="sugg"){await SY.col.doc("sugg").set(JSON.parse(JSON.stringify(SG)))}
else if(k.indexOf("o_")===0){var o=find(k.slice(2));if(o&&!delIs(o.id)){await SY.col.doc(k).set(offDoc(o));o.sy=1}else{await SY.col.doc(k).delete()}}done[k]=1}
var err=null;try{for(var i=0;i<keys.length;i++){if(i&&Object.keys(SY.pri).length){var nk=Object.keys(SY.pri).filter(function(k){return SY.dirty[k]});SY.pri={};for(var j=0;j<nk.length;j++){delete SY.dirty[nk[j]];SY.fly[nk[j]]=1;await one(nk[j])}}if(i&&!pri[keys[i]])await new Promise(function(r){setTimeout(r,i%10===0?500:120)});await one(keys[i])}
saveOff();setSyn("Synchronisé sur ton compte");SY.fail=0}catch(e){err=e;keys.forEach(function(k){if(!done[k]){SY.dirty[k]=1;if(pri[k])SY.pri[k]=1}});SY.fail=(SY.fail||0)+1;setSyn("Synchronisation en pause")}SY.fly={};SY.busy=false;if(Object.keys(SY.dirty).length){clearTimeout(SY.t);SY.t=setTimeout(push,err?Math.min(60000,3000*Math.pow(2,SY.fail-1)):Object.keys(SY.pri).length?100:1200)}}
/* Candidatures supprimées sur cet appareil : gardées 30 jours pour que la synchronisation ne les remette jamais,
   même si elle passe avant que la suppression soit arrivée dans la base (ou si la suppression échoue : nouvel essai). */
var DELS=lsg("dels",{});
function delIs(id){var t=DELS[id];return !!t&&Date.now()-t<30*864e5}
function delAdd(id){DELS[id]=Date.now();Object.keys(DELS).forEach(function(k){if(Date.now()-DELS[k]>30*864e5)delete DELS[k]});lss("dels",DELS)}
function delUndo(id){delete DELS[id];lss("dels",DELS)}
function newer(a,b){var x=a.rv||0,y=b.rv||0;if(x!==y)return x>y?1:-1;x=a.mt||0;y=b.mt||0;return x===y?0:x>y?1:-1}
async function pull(){if(!SY.col)return;try{var snap=await SY.col.get(),seen={},ch=false;
snap.docs.forEach(function(d){if(d.id.indexOf("o_")===0&&delIs(d.id.slice(2))){SY.dirty[d.id]=1;return}if(d.same){if(d.id.indexOf("o_")===0)seen[d.id.slice(2)]=1;return}var v=d.data();if(!v)return;
if(d.id==="profil"&&v.p){if(pfMerge(v))ch=true}
else if(d.id==="mail"&&v.seen){mlMerge(v)}
else if(d.id==="fc"&&v.m){if(!FC||v.m!==FC.m?(v.m===fcMonth()):((+v.u||0)>(+FC.u||0))){FC={m:v.m,u:+v.u||0,t:v.t||0};lss("fc",FC);try{fcUI()}catch(e){}}else if(FC&&FC.m===v.m&&(+FC.u||0)>(+v.u||0))SY.dirty.fc=1}
else if(d.id==="sugg"&&v.mt){var lr=SG.hidReset||0,rr=v.hidReset||0,uh=rr>lr?(v.hidden||[]):lr>rr?(SG.hidden||[]):sgUnion(SG.hidden,v.hidden),us=rr>lr?(v.hidSig||[]):lr>rr?(SG.hidSig||[]):sgUnionSig(SG.hidSig,v.hidSig),grew=uh.length>(SG.hidden||[]).length||us.length>(SG.hidSig||[]).length,rgrew=uh.length>(v.hidden||[]).length||us.length>(v.hidSig||[]).length;if((v.mt||0)>(SG.mt||0)){SG=Object.assign(SG,v);SG.hidden=uh;SG.hidSig=us;SG.hidReset=Math.max(lr,rr);lss("sugg",SG);sgUI();if(rgrew)SY.dirty.sugg=1}else{SG.hidden=uh;SG.hidSig=us;SG.hidReset=Math.max(lr,rr);if(grew){lss("sugg",SG);sgUI()}if((SG.mt||0)>(v.mt||0)||rgrew)SY.dirty.sugg=1}}
else if(d.id==="cvs"&&v.list){if((v.mt||0)>(CV.mt||0)){CV={list:v.list,mt:v.mt};lss("cvs",CV);ch=true}else if((CV.mt||0)>(v.mt||0))SY.dirty.cvs=1}
else if(d.id.indexOf("o_")===0&&v.id){seen[v.id]=1;var l=find(v.id);if(!l){v.sy=1;OFF.push(v);ch=true}else{var kk="o_"+l.id,c=newer(v,l);l.sy=1;if(SY.dirty[kk]||SY.fly[kk]){}else if(c>0){Object.assign(l,v,{sy:1});ch=true}else if(c<0)SY.dirty[kk]=1}}});
var n=OFF.length;OFF=OFF.filter(function(o){if(!seen[o.id]&&o.sy)return false;if(!seen[o.id])SY.dirty["o_"+o.id]=1;return true});if(OFF.length!==n){ch=true;if(CUR&&!find(CUR))CUR=null}
if(!snap.docs.some(function(d){return d.id==="profil"})&&(PF.nom||PF.mail))SY.dirty.profil=1;
if(!snap.docs.some(function(d){return d.id==="cvs"})&&CV.list.length)SY.dirty.cvs=1;if(!snap.docs.some(function(d){return d.id==="sugg"})&&SG&&SG.mt)SY.dirty.sugg=1;if(!snap.docs.some(function(d){return d.id==="mail"})&&ML&&ML.mt)SY.dirty.mail=1;
OFF.sort(function(a,b){return b.ct-a.ct});UNDOSKIP=true;try{saveOff()}finally{UNDOSKIP=false}
if(ch){autoRefuse();pfUI();cvUI();if(!CUR&&OFF.length&&OFF[0].an&&OFF[0].st==null)CUR=OFF[0].id;renderList();renderRes();try{homeFeed()}catch(e){}}
if(pfEmpty(PF.nom)&&pfEmpty(PF.mail)&&CV.list.length)pfFromCv(false);setSyn("Synchronisé sur ton compte");if(Object.keys(SY.dirty).length){clearTimeout(SY.t);SY.t=setTimeout(push,800)}}catch(e){setSyn("Synchronisation indisponible pour l'instant")}}
(async function(){try{var u=await claude.use("user"),db=await claude.use("db");if(!u||!db)return;var id=await u.id();SY.col=db.collection("data/users/"+id);await pull();
window.addEventListener("ce:remote",function(){pull()});document.addEventListener("visibilitychange",function(){if(!document.hidden)pull();else if(Object.keys(SY.dirty).length){clearTimeout(SY.t);push()}})}catch(e){}})();

/* ---------- Paramètres ---------- */
function openSet(){var d=G("pfbox");spGo("");if(!d.open){try{d.showModal()}catch(e){d.setAttribute("open","")}}setUI();spSum()}
var SPT={profil:"Mes coordonnées",cv:"Mes CV",parcours:"Mon parcours",docs:"CV, lettres et messages",suivi:"Suivi des candidatures",recherche:"Recherche d'offres",app:"Apparence",notifs:"Notifications et calendrier",aide:"Aide"};
var PARBUSY=false;
async function parFill(force){if(PARBUSY)return;var n=G("parn"),b=G("parfill"),c=cvFor("fr"),t=G("pnotes");
if(!c){n.textContent="Ajoute d'abord ton CV dans « Mes CV ».";return}
if(t.value.trim()&&!force){return}
PARBUSY=true;b.disabled=true;n.textContent="Je reprends ton CV principal...";var out="";
try{var sample=await claude.use("sample");if(sample){var res=await sample("Réorganise ce CV en un parcours détaillé, en texte simple et lisible (pas de markdown : ni #, ni *, ni gras). Garde TOUTES les informations du CV, n'invente rien, ne reformule pas en mieux. Structure :\nFORMATION\npuis une ligne par diplôme (intitulé, école, ville, dates)\n\nEXPÉRIENCES\npour chaque poste : une ligne « Poste, Entreprise, Ville (dates) », puis ses missions sur des lignes commençant par « - »\n\nCOMPÉTENCES\nLANGUES\nCENTRES D'INTÉRÊT (seulement s'ils sont dans le CV)\n\nLaisse une ligne vide entre les blocs. Réponds uniquement avec le texte.\n\nCV :\n"+c.text,{cache:false,modelTier:"default"});out=String(res&&res.text||"").replace(/\*\*/g,"").replace(/^#+\s*/gm,"").replace(/\s*—\s*/g,", ").trim()}}catch(e){out=""}
if(!out)out=String(c.text||"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
var old=t.value.trim();if(old&&!/^FORMATION/.test(old))out+="\n\nCOMPLÉMENTS\n"+old;t.value=out;t.dispatchEvent(new Event("input",{bubbles:true}));n.textContent="Repris depuis « "+(c.name||"ton CV")+" ». Modifie ce que tu veux.";PARBUSY=false;b.disabled=false;try{spSum()}catch(e){}}
G("parfill").onclick=function(){var b=this,t=G("pnotes");if(t.value.trim()&&!b.dataset.ok){b.dataset.ok="1";b.textContent=/^FORMATION/.test(t.value.trim())?"Appuie encore : tes modifications seront remplacées":"Appuie encore : tes notes seront gardées en bas";setTimeout(function(){delete b.dataset.ok;b.textContent="Reprendre mon CV principal"},4000);return}delete b.dataset.ok;b.textContent="Reprendre mon CV principal";parFill(true)};
function spGo(k){if(k==="notifs"&&window.CE_notifUI)setTimeout(CE_notifUI,0);if(k==="aide"&&window.CE_errUI)setTimeout(CE_errUI,0);if(k==="aide"&&window.CE_perfUI)setTimeout(CE_perfUI,0);G("sphome").hidden=!!k;document.querySelectorAll("#pfbox .sp").forEach(function(x){x.hidden=x.getAttribute("data-p")!==k});G("setback").hidden=!k;G("seth").textContent=k?SPT[k]:"Paramètres";try{G("pfbox").querySelector(".dwb").scrollTop=0}catch(e){}if(!k)spSum();if(k==="parcours"&&!G("pnotes").value.trim()&&(CV.list||[]).length)parFill(false)}
function spSel(id){var e=G(id);return e&&e.selectedIndex>=0?e.options[e.selectedIndex].text:""}
function spSum(){function S(k,t){var e=G("sps_"+k);if(e)e.textContent=t}try{
var nm=G("pnom").value.trim(),vi=G("padr").value.trim();S("profil",[nm,vi].filter(Boolean).join(" · ")||"À compléter");
var n=(CV.list||[]).length,lg={fr:"français",en:"anglais",es:"espagnol"};S("cv",n?n+" CV : "+(CV.list||[]).map(function(c){return lg[c.lang]||c.lang}).filter(function(x,i,a){return a.indexOf(x)===i}).join(", "):"Aucun CV, importe-en un");
var pn=G("pnotes").value.trim();S("parcours",pn?pn.split(/\s+/).length+" mots":"Se remplit avec ton CV principal");
S("docs",spSel("stlang")+" · photo "+(G("stphoto").checked?"oui":"non"));
var nr=G("stnr").value;S("suivi",(G("stauto").checked?"Mise à jour auto · ":"")+(nr==="0"?"jamais refusée toute seule":"refusée après "+nr+" j sans réponse"));
S("recherche","Note min. "+G("stmin").value+" · "+G("stcap").value+" offres max · "+G("stwin").value+" jours");
S("app",spSel("sttheme"));S("aide","Guide et astuces")}catch(e){}}
document.querySelectorAll("#pfbox .spr").forEach(function(b){b.onclick=function(){spGo(b.getAttribute("data-sp"))}});
G("setback").onclick=function(){spGo("")};G("spguide").onclick=function(){closeSet();setTimeout(gdOpen,150)};
G("pfbox").addEventListener("change",function(){setTimeout(spSum,50)});G("pfbox").addEventListener("input",function(){clearTimeout(spSum.t);spSum.t=setTimeout(spSum,300)});
function closeSet(){var d=G("pfbox");if(d.open)d.close()}
G("setb").onclick=openSet;G("setx").onclick=closeSet;
G("pfbox").addEventListener("click",function(e){if(e.target===this)closeSet()});
function fcUI(){if(window.CE_quotaUI){CE_quotaUI();return}var u=fcUsed(),p=Math.min(100,Math.round(u*100/FCMAX)),i=G("fcbi");if(!i)return;i.style.width=p+"%";i.className=u>=FCMAX-FCRES?"hi":p>=50?"mid":"";G("fct").textContent="≈ "+u+" / "+FCMAX+" crédits utilisés. Renouvellement le "+fcNext().toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+". Une recherche en utilise environ 30, il en reste donc pour environ "+Math.max(0,Math.floor((FCMAX-FCRES-u)/30))+" recherches complètes avant le mode économie. Sous les "+FCRES+" derniers crédits, les recherches passent en mode économie (Indeed seul, gratuit) pour garder de quoi analyser des liens et préparer des lettres."}
function SETV(){return Object.assign({lang:"auto",photo:true,age:40,noresp:30,win:10,minsc:65,cap:80,fcmax:1000},PF.set||{})}
function applySet(){var v=SETV();FCMAX=1000;SGMAXAGE=+v.age||40;SGDAYS=SGMAXAGE}
function setUI(){var v=SETV();G("stlang").value=v.lang;G("stphoto").checked=v.photo!==false;G("stwin").value=String(v.win);G("stmin").value=String(v.minsc);G("stcap").value=String(v.cap);fcUI();G("stnr").value=String(v.noresp||0);G("stexp").checked=v.expchk!==false;G("stgoal").value=String(v.goal||0);G("stauto").checked=v.automl!==false;G("stchk").checked=v.chkweb!==false;G("stage").value=String(v.age);var th="auto";try{th=localStorage.getItem(K+"theme")||"auto"}catch(e){}G("sttheme").value=th;
var nh=typeof SG!=="undefined"?((SG.hidSig||[]).length||(SG.hidden||[]).length):0;G("sthid").textContent=nh?nh+" offre"+(nh>1?"s":"")+" supprimée"+(nh>1?"s":""):"Aucune pour l'instant";G("sthidb").hidden=!nh}
function saveSet(k,val){PF.set=Object.assign(SETV(),{});PF.set[k]=val;PF.mt=Date.now();lss("pf",PF);mark("profil");applySet()}
G("stlang").onchange=function(){saveSet("lang",this.value)};
G("stphoto").onchange=function(){saveSet("photo",this.checked)};G("stwin").onchange=function(){saveSet("win",+this.value)};G("stmin").onchange=function(){saveSet("minsc",+this.value)};G("stcap").onchange=function(){saveSet("cap",+this.value)};G("stnr").onchange=function(){saveSet("noresp",+this.value);if(autoRefuse())renderList();else renderList()};G("stchk").onchange=function(){saveSet("chkweb",this.checked)};G("stexp").onchange=function(){saveSet("expchk",this.checked)};G("stgoal").onchange=function(){saveSet("goal",+this.value);try{homeUI()}catch(e){}};G("stauto").onchange=function(){saveSet("automl",this.checked)};
G("stage").onchange=function(){saveSet("age",+this.value);try{sgUI()}catch(e){}};
function applyTheme(t){if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.removeAttribute("data-theme")}
G("sttheme").onchange=function(){try{localStorage.setItem(K+"theme",this.value)}catch(e){}applyTheme(this.value)};
try{applyTheme(localStorage.getItem(K+"theme")||"auto")}catch(e){}
G("sthidb").onclick=function(){var b=this;if(!b.dataset.ok){b.dataset.ok="1";b.classList.add("no","armed");b.textContent="Confirmer";setTimeout(function(){delete b.dataset.ok;b.classList.remove("no","armed");b.textContent="Les faire revenir"},4000);return}
delete b.dataset.ok;b.classList.remove("no","armed");b.textContent="Les faire revenir";SG.hidden=[];SG.hidSig=[];SG.hidReset=Date.now();sgSave();sgUI();setUI()};

/* ---------- Profil ---------- */
var PFF={pnom:"nom",pmail:"mail",ptel:"tel",pcp:"cp",padr:"adr",ppays:"pays",plien:"lien",pnotes:"notes"};
function pfUI(){Object.keys(PFF).forEach(function(i){if(document.activeElement!==G(i))G(i).value=PF[PFF[i]]||""});
G("phv").innerHTML=PF.photo?'<img alt="Ta photo" src="'+PF.photo+'">':'<span class="noph" aria-hidden="true"></span>';G("phx").hidden=!PF.photo;
G("pfsum").textContent=(PF.nom||"Profil à compléter")+" · "+CV.list.length+" CV";G("setdot").hidden=!!CV.list.length;applySet()}
Object.keys(PFF).forEach(function(i){G(i).addEventListener("input",function(){PF[PFF[i]]=G(i).value.trim();PF.clr=Object.assign({},PF.clr||{});if(PF[PFF[i]]==="")PF.clr[PFF[i]]=Date.now();else delete PF.clr[PFF[i]];PF.mt=Date.now();lss("pf",PF);mark("profil");G("pfsum").textContent=(PF.nom||"Profil à compléter")+" · "+CV.list.length+" CV"})});
G("phb").onclick=function(){G("phf").click()};
G("pfcv").onclick=function(){if(!CV.list.length){G("pfcvn").textContent="Ajoute d'abord un CV ci-dessous.";return}var n=pfFromCv(false);G("pfcvn").textContent=n?n+" champ"+(n>1?"s":"")+" rempli"+(n>1?"s":"")+" à partir de ton CV. Vérifie-les.":"Rien à compléter : les champs remplis ne sont pas modifiés."};
G("phx").onclick=function(){PF.photo="";PF.clr=Object.assign({},PF.clr||{});PF.clr.photo=Date.now();PF.mt=Date.now();lss("pf",PF);mark("profil");pfUI()};
G("phf").onchange=function(e){var f=e.target.files[0];e.target.value="";if(!f)return;var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var W=300,H=400,c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d"),s=Math.max(W/im.width,H/im.height),w=im.width*s,h=im.height*s;x.fillStyle="#fff";x.fillRect(0,0,W,H);x.drawImage(im,(W-w)/2,Math.min(0,(H-h)/3),w,h);PF.photo=c.toDataURL("image/jpeg",.85);PF.mt=Date.now();lss("pf",PF);mark("profil");pfUI()};im.src=r.result};r.readAsDataURL(f)};

/* ---------- CV ---------- */
function guessLang(t){t=" "+norm(t)+" ";function c(ws){return ws.reduce(function(n,w){return n+(t.split(" "+w+" ").length-1)},0)}var fr=c(["et","des","les","du","pour","avec","experience","competences"]),en=c(["and","the","with","for","skills","experience","of"]),es=c(["y","los","las","con","para","del","experiencia"]);if(es>fr&&es>en)return"es";return en>fr?"en":"fr"}
function cvUI(){var L=G("cvl");if(!CV.list.length){L.innerHTML='<p class="empty" style="margin:0">Aucun CV pour l\'instant. Importe ton CV en PDF ou colle son texte.</p>'}else{L.innerHTML=CV.list.map(function(c){return '<div class="cv"><span><b>'+esc(c.name)+'</b><span class="tag">'+(c.lang||"fr").toUpperCase()+'</span></span><span class="row"><button class="ghost sm" data-del="'+esc(c.id)+'" type="button">Supprimer</button></span></div>'}).join("")}
L.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-del");if(b.dataset.ok){CV.list=CV.list.filter(function(c){return c.id!==id});CV.mt=Date.now();lss("cvs",CV);mark("cvs");cvUI();pfUI()}else{b.dataset.ok="1";b.textContent="Confirmer la suppression";setTimeout(function(){if(b.isConnected){delete b.dataset.ok;b.textContent="Supprimer"}},4000)}}});pfUI()}
function addCv(name,lang,text){CV.list=CV.list.filter(function(c){return (c.lang||"fr")!==lang});CV.list.push({id:"c"+uid(),name:name,lang:lang,text:text,at:Date.now()});CV.mt=Date.now();lss("cvs",CV);mark("cvs");cvUI()}
G("cvtxt").onclick=function(){G("cvadd").hidden=false;G("cvn").value="";G("cvt").value="";G("cvn").focus()};
G("cvno").onclick=function(){G("cvadd").hidden=true};
G("cvt").addEventListener("input",function(){if(G("cvt").value.length>200)G("cvlg").value=guessLang(G("cvt").value)});
G("cvok").onclick=function(){var t=G("cvt").value.trim();if(t.length<80){G("cvnote").textContent="Colle le texte complet du CV.";return}addCv(G("cvn").value.trim()||"Mon CV",G("cvlg").value,t);G("cvadd").hidden=true;G("cvnote").textContent="CV enregistré."};
G("cvpdf").onclick=function(){G("cvf").click()};
G("cvf").onchange=async function(e){var f=e.target.files[0];e.target.value="";if(!f)return;G("cvnote").textContent="Lecture du PDF...";try{var t=await pdfText(f);if(t.length<80)throw 0;addCv(f.name.replace(/\.pdf$/i,""),guessLang(t),t);G("cvnote").textContent="CV importé. Vérifie la langue indiquée."}catch(err){G("cvnote").textContent="Ce PDF ne contient pas de texte lisible. Colle plutôt le texte du CV."}};

var PDFP=null;
function loadPdfjs(){if(PDFP)return PDFP;PDFP=new Promise(function(res,rej){var s=document.createElement("script");s.src="vendor/pdf.min.js";s.onload=function(){try{window.pdfjsLib.GlobalWorkerOptions.workerSrc="vendor/pdf.worker.min.js";res(window.pdfjsLib)}catch(e){PDFP=null;rej(e)}};s.onerror=function(){PDFP=null;rej(new Error("load"))};document.head.appendChild(s)});return PDFP}
async function pdfText(file){var lib=await loadPdfjs(),buf=await file.arrayBuffer(),pdf=await lib.getDocument({data:buf}).promise,out=[];
for(var i=1;i<=pdf.numPages;i++){var pg=await pdf.getPage(i),tc=await pg.getTextContent(),lines=[],cur="",y=null,px=null;
tc.items.forEach(function(it){if(!it.transform)return;var ty=it.transform[5],tx=it.transform[4];if(y!==null&&Math.abs(ty-y)>3){lines.push(cur);cur="";px=null}
if(px!==null&&tx-px>1&&cur&&!/\s$/.test(cur)&&!/^\s/.test(it.str))cur+=" ";cur+=it.str;y=ty;px=tx+(it.width||0)});lines.push(cur);out.push(lines.join("\n"))}
return out.join("\n\n").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function cvFor(lang){function last(f){var l=CV.list.filter(f);return l[l.length-1]}return last(function(c){return c.lang===lang})||last(function(c){return c.lang==="fr"})||CV.list[CV.list.length-1]||null}
