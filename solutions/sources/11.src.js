(function(){
"use strict";
var COLS=["email","prenom","nom","societe","pays"];
var E={};
var S={sep:",",skip:true,dedup:true,rows:[],bad:[]};
function g(i){return document.getElementById(i);}
function log(t){var b=g("csv-log");var d=document.createElement("div");d.textContent=new Date().toTimeString().slice(0,8)+"  "+t;b.insertBefore(d,b.firstChild);}
function split(l){return l.split(S.sep).map(function(c){return c.trim().replace(/^"|"$/g,"");});}
function mail(v){return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);}
function parse(){var raw=E.src.value.split(/\r?\n/).filter(function(l){return l.trim().length>0;});if(S.skip&&raw.length){raw=raw.slice(1);}var seen={};var ok=[];var bad=[];raw.forEach(function(l,i){var c=split(l);var r={};COLS.forEach(function(k,j){r[k]=c[j]||"";});if(!mail(r.email)){bad.push({n:i+1,why:"email invalide",v:r.email||"(vide)"});return;}if(S.dedup&&seen[r.email.toLowerCase()]){bad.push({n:i+1,why:"doublon",v:r.email});return;}seen[r.email.toLowerCase()]=1;ok.push(r);});S.rows=ok;S.bad=bad;}
function head(){E.head.innerHTML="<tr>"+COLS.map(function(c){return "<th>"+c+"</th>";}).join("")+"</tr>";}
function body(){E.body.innerHTML=S.rows.slice(0,6).map(function(r){return "<tr>"+COLS.map(function(c){return "<td>"+(r[c]||'<span class="muted">-</span>')+"</td>";}).join("")+"</tr>";}).join("");}
function errs(){E.errs.innerHTML=S.bad.length?S.bad.slice(0,5).map(function(b){return '<li><span class="dot warn"></span>ligne '+b.n+" : "+b.why+" ("+b.v+")</li>";}).join(""):'<li><span class="dot"></span>Aucune ligne rejetée.</li>';}
function bld(){return {challengeId:"11",action:"validate",separator:S.sep,accepted:S.rows.length,rejected:S.bad.length,sample:S.rows.slice(0,3)};}
function upd(){S.sep=E.sep.value;S.skip=E.skip.checked;S.dedup=E.dedup.checked;parse();head();body();errs();E.nOk.textContent=S.rows.length;E.nKo.textContent=S.bad.length;E.nCol.textContent=COLS.length;E.chip.className="chip "+(S.rows.length?"chip-ok":"chip-warn");E.chip.textContent=S.rows.length?S.rows.length+" lignes prêtes":"rien à importer";E.note.textContent="Séparateur "+JSON.stringify(S.sep)+", "+(S.skip?"entête ignorée":"entête conservée")+", "+(S.dedup?"dédoublonnage actif":"doublons conservés")+".";}
function tx(){var p=bld();log("import soumis : "+p.accepted+" lignes");fetch("/api/challenge/11/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:p}).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});}).then(function(x){log("réponse "+x.s+" : "+(x.j.message||x.j.error));}).catch(function(e){log("échec réseau : "+e.message);});}
E.src=g("csv-src");
E.sep=g("separator");
E.skip=g("skip-header");
E.dedup=g("dedup");
E.head=g("csv-head");
E.body=g("csv-body");
E.errs=g("csv-errors");
E.nOk=g("n-ok");
E.nKo=g("n-ko");
E.nCol=g("n-col");
E.chip=g("csv-chip");
E.note=g("csv-note");
E.go=g("run-import");
E.src.addEventListener("input",upd);
E.sep.addEventListener("change",upd);
E.skip.addEventListener("change",upd);
E.dedup.addEventListener("change",upd);
E.go.addEventListener("click",tx);
upd();
log("fichier contacts-2026-09.csv chargé en mémoire");
})();
