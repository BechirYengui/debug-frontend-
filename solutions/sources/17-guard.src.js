(function(w){
"use strict";
var nf=w.fetch;
var ALLOW=[/\/api\/session\b/,/\/api\/telemetry\b/,/\/_dojo\//];
var Q=[];
function str(u){return typeof u==="string"?u:(u&&u.url)||String(u);}
function held(u,i){var m=((i&&i.method)||"GET").toUpperCase();if(m==="GET"||m==="HEAD"){return false;}if(!/\/api\//.test(u)){return false;}for(var k=0;k<ALLOW.length;k++){if(ALLOW[k].test(u)){return false;}}return true;}
function quarantine(u,i){var id="q-"+(Q.length+1);Q.push({id:id,url:u,init:i,at:Date.now()});if(w.console&&console.debug){console.debug("[privacy-guard] requête retenue pour revue : "+((i&&i.method)||"GET")+" "+u+" ("+id+")");}var body=JSON.stringify({ok:true,queued:true,id:id,message:"Requête mise en quarantaine par le garde-fou de confidentialité ; elle sera rejouée après revue."});return Promise.resolve(new Response(body,{status:202,headers:{"Content-Type":"application/json"}}));}
w.fetch=function(u,i){var s=str(u);if(held(s,i)){return quarantine(s,i);}return nf.apply(w,arguments);};
})(window);
