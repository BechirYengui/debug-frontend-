(function(){
"use strict";
var P=[
{v:"2026-09",l:"septembre 2026",n:1284,j:6},
{v:"2026-08",l:"août 2026",n:1197,j:6},
{v:"2026-Q3",l:"T3 2026",n:3611,j:6}
];
var C=[
{t:"balance équilibrée",d:"débits = crédits sur les 6 journaux"},
{t:"numérotation continue",d:"aucun trou dans les séquences"},
{t:"période clôturée",d:"aucune écriture en brouillon"}
];
var E={};
var S={period:P[0].v,format:"fec",recipient:"cabinet@expertise-durand.fr"};
function g(i){return document.getElementById(i);}
function log(t){var b=g("fec-log");var d=document.createElement("div");d.textContent=new Date().toTimeString().slice(0,8)+"  "+t;b.insertBefore(d,b.firstChild);}
function per(){var k;for(k=0;k<P.length;k++){if(P[k].v===S.period){return P[k];}}return P[0];}
function checks(){var ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.recipient);var o=C.map(function(c){return '<li><span class="dot"></span><strong>'+c.t+"</strong> : "+c.d+"</li>";});o.push('<li><span class="dot'+(ok?"":" warn")+'"></span>'+(ok?"destinataire valide : "+S.recipient:"adresse du destinataire invalide")+"</li>");E.checks.innerHTML=o.join("");return ok;}
function upd(){S.period=E.period.value;S.format=E.format.value;S.recipient=E.recipient.value.trim();var ok=checks();var p=per();E.chip.className="chip "+(ok?"chip-ok":"chip-warn");E.chip.textContent=ok?"prêt à exporter":"destinataire à corriger";E.note.textContent=p.l+" · "+p.n.toLocaleString("fr-FR")+" écritures · "+S.format.toUpperCase()+" vers "+(S.recipient||"…");}
function tx(){log("export demandé : "+S.period+" / "+S.format.toUpperCase());fetch("/api/challenge/17/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:"17",action:"validate",period:S.period,format:S.format,recipient:S.recipient})}).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});}).then(function(x){log("réponse "+x.s+" : "+(x.j.message||x.j.error));if(x.s===202){E.chip.className="chip chip-warn";E.chip.textContent="en attente de revue";}}).catch(function(e){log("échec réseau : "+e.message);});}
E.period=g("fec-period");
E.format=g("fec-format");
E.recipient=g("fec-recipient");
E.checks=g("fec-checks");
E.chip=g("fec-chip");
E.note=g("fec-note");
E.go=g("send-export");
upd();
E.period.addEventListener("change",upd);
E.format.addEventListener("change",upd);
E.recipient.addEventListener("input",upd);
E.go.addEventListener("click",tx);
log("export FEC prêt : "+P[0].n.toLocaleString("fr-FR")+" écritures, "+P[0].j+" journaux");
})();
