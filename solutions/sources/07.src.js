(function(){
"use strict";
var O=[
{r:"WMS-88214",c:"Grivel SA",l:4,w:31.2,p:18900,s:"prete"},
{r:"WMS-88215",c:"Atlas Log",l:1,w:2.4,p:4200,s:"picking"},
{r:"WMS-88216",c:"Nordis",l:9,w:78.6,p:51200,s:"prete"},
{r:"WMS-88217",c:"Laforet",l:2,w:6.1,p:9900,s:"attente"}
];
var C={chronoflux:{n:"Chronoflux",b:490,k:38},ferro:{n:"Ferro Express",b:640,k:22},lento:{n:"Lento",b:210,k:61}};
var S={ref:"WMS-88214",car:"chronoflux",ins:true,km:142,pop:null};
var E={};
function g(i){return document.getElementById(i);}
function eur(c){return (c/100).toFixed(2).replace(".",",")+" EUR";}
function cur(){for(var i=0;i<O.length;i++){if(O[i].r===S.ref){return O[i];}}return O[0];}
function fee(){var c=C[S.car];var o=cur();var f=c.b+Math.round(c.k*S.km/10)+Math.round(o.w*7);if(S.ins){f+=Math.round(o.p*0.004);}return f;}
function log(t){var b=g("wms-log");var d=document.createElement("div");d.textContent=new Date().toTimeString().slice(0,8)+"  "+t;b.insertBefore(d,b.firstChild);}
function rows(){E.rows.innerHTML=O.map(function(o){var a=o.r===S.ref;return '<tr style="opacity:'+(a?1:.5)+'"><td data-cmd="pick" data-ref="'+o.r+'">'+o.r+'</td><td>'+o.c+'</td><td>'+o.l+'</td><td>'+o.w.toFixed(1)+' kg</td><td><span class="chip '+(o.s==="prete"?"chip-ok":"chip-warn")+'">'+o.s+'</span></td></tr>';}).join("");}
function opts(){E.car.innerHTML=Object.keys(C).map(function(k){return '<option value="'+k+'"'+(k===S.car?" selected":"")+">"+C[k].n+"</option>";}).join("");}
function upd(){var o=cur();E.km.value=S.km;E.fee.textContent=eur(fee());E.val.textContent=eur(o.p);E.wt.textContent=o.w.toFixed(1)+" kg";E.note.textContent=o.c+" - "+o.l+" colis - "+C[S.car].n+" - "+(S.ins?"assurance incluse":"sans assurance");E.chip.className="chip "+(o.s==="prete"?"chip-ok":"chip-warn");E.chip.textContent=o.s;rows();}
function pop(t){cls();var p=document.createElement("div");p.className="pop";p.setAttribute("data-pop","1");p.textContent=t.getAttribute("data-tip")||"";t.appendChild(p);S.pop=p;}
function cls(){if(S.pop&&S.pop.parentNode){S.pop.parentNode.removeChild(S.pop);}S.pop=null;}
function tx(){var o=cur();log("expédition demandée "+o.r);fetch("/api/challenge/07/solve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:"07",action:"validate",ref:o.r,carrier:S.car,feeCents:fee()})}).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});}).then(function(x){log("réponse "+x.s+" : "+(x.j.message||x.j.error));}).catch(function(e){log("échec réseau : "+e.message);});}
E.panel=g("order-panel");
E.rows=g("order-rows");
E.car=g("carrier");
E.km=g("distance");
E.ins=g("insured");
E.fee=g("fee");
E.val=g("declared");
E.wt=g("weight");
E.note=g("wms-note");
E.chip=g("order-chip");
document.addEventListener("click",function(e){
var t=e.target.closest?e.target.closest("[data-cmd]"):null;
if(!t){cls();return;}
var c=t.getAttribute("data-cmd");
if(c==="dispatch"){tx();return;}
if(c==="pick"){S.ref=t.getAttribute("data-ref");upd();return;}
if(c==="tip"){pop(t);return;}
});
E.panel.addEventListener("click",function(e){
e.stopPropagation();
if(!e.target.closest("[data-cmd=tip]")){cls();}
});
E.car.addEventListener("change",function(){S.car=E.car.value;upd();});
E.km.addEventListener("input",function(){var n=parseInt(E.km.value,10);S.km=isNaN(n)?0:Math.min(2000,Math.max(0,n));upd();});
E.ins.addEventListener("change",function(){S.ins=E.ins.checked;upd();});
opts();
upd();
log("4 commandes chargées depuis le WMS");
})();
