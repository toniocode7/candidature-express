(function(){
var K="candexp.";
function lsg(k,d){try{var v=localStorage.getItem(K+k);return v?JSON.parse(v):d}catch(e){return d}}
function lss(k,v){SGC=null;try{localStorage.setItem(K+k,JSON.stringify(v))}catch(e){}} // tout enregistrement vide la mémoire du tri des suggestions
function G(id){return document.getElementById(id)}
var FCMAX=1000,FCRES=150;
function fcMonth(){var d=new Date(),day=(typeof PF!=="undefined"&&PF.fcDay)||24,y=d.getFullYear(),m=d.getMonth()+1;if(d.getDate()<day){m--;if(m<1){m=12;y--}}return y+"-"+m}
function fcNext(){var d=new Date(),day=(typeof PF!=="undefined"&&PF.fcDay)||24,n=new Date(d.getFullYear(),d.getMonth(),day);if(d.getDate()>=day)n=new Date(d.getFullYear(),d.getMonth()+1,day);return n}
var FC=null;
function fcUsed(){var f=FC||{};return f.m===fcMonth()?(+f.u||0):0}
function fcLeft(){return FCMAX-fcUsed()}
function fcAdd(tool,a){var c=0;if(tool==="firecrawl_search")c=2*Math.ceil((+(a&&a.limit)||10)/10);else if(tool==="firecrawl_scrape")c=1+((a&&a.formats||[]).indexOf("json")>=0?4:0);if(!c)return;FC={m:fcMonth(),u:fcUsed()+c,t:Date.now()};lss("fc",FC);try{mark("fc")}catch(e){}try{fcUI()}catch(e){}}
async function MCP(){var m=await claude.use("mcp");if(!m)return m;return{callTool:function(s,t,a){if(s==="Firecrawl")fcAdd(t,a);return m.callTool(s,t,a)}}}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var PF=Object.assign({nom:"",adr:"",cp:"",pays:"",tel:"",mail:"",lien:"",photo:"",notes:"",mt:0},lsg("pf",{}));
FC=lsg("fc",null);if(!FC){var pfc=PF.fc||{};FC={m:fcMonth(),u:(PF.fcFix?(+pfc.u||0):580+(+pfc.u||0)),t:Date.now()};lss("fc",FC)}
FCMAX=1000;
var CV=Object.assign({list:[],mt:0},lsg("cvs",{}));
var OFF=lsg("off",[]);
var CUR=null,BUSY=false,AUTOOPEN=false,COL={};
var ST=["À postuler","Envoyée","Entretien","Refusée","Premier contact"],STORD=[0,1,4,2,3];
var LN={fr:"français",en:"anglais",es:"espagnol"};
var RULES="Règles d'écriture : ton classique, posé et naturel, qui ne doit sonner ni écrit par une IA ni traduit de l'anglais. Jamais de tiret long (— ou –), pas de jargon RH, pas d'accroche, pas de ton de dissertation. Ne rien inventer : n'utiliser que des faits présents dans le CV et les compléments sur le parcours. Citer les entreprises du parcours quand c'est utile. Anglais : niveau C1, présenté comme un « bon niveau » (« good command of English » en anglais), jamais « courant », « fluent » ni « bilingue ». Excel : parler de « formules avancées ». Le bac+5 s'intitule « Master Supply Chain, Achats et Approvisionnements » (traduit fidèlement dans les autres langues). Ne jamais préciser qu'un poste était une alternance. Dans les analyses et conseils, tutoyer le candidat, jamais « le candidat ».";
function TODAY(l){return new Date().toLocaleDateString(l||"fr-FR",{day:"numeric",month:"long",year:"numeric"})}
function pfLoc(){var a=[PF.cp,PF.adr].filter(Boolean).join(" ");return [a,PF.pays].filter(Boolean).join(", ")}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}