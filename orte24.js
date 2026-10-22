/* [Grok-Bot] V2.03: Fusszeile "Orte" wie im Bhakti Prayers Player (V3.66/V3.70): statt "Orte: heute/Monat/gesamt" (Zaehler)
   und "aktiv in" (Live-TOP10) jetzt "Orte letzte 24 h (n): Stadt, LAND ×k · …".
   Daten: jede Sitzung legt "Ort + Zeit" als retained Nachricht unter tvp/clbuerger/visits/v1/<sitzung> ab (alle 5 min erneuert),
   dazu noch vorhandene Presence-Eintraege (tvp/clbuerger/presence/v1/) < 24 h. Ort ueber geojs.io. Vollstaendig erst 24 h nach V2.03.
   stats-daily.js bleibt unveraendert; die Orte-Zeile wird nach jedem Neuzeichnen hier ausgeblendet. */
(function(){
  if(window.tvpOrte24) return;
  var st=document.createElement("style");
  st.textContent="#tv-live-slot{display:none!important}"+
    "#tv-orte24{font-size:.68rem;color:#cbb89a;opacity:.85;line-height:1.35;text-align:right;padding:0 12px 8px;margin:0;max-height:5.6em;overflow-y:auto}";
  document.head.appendChild(st);
  var V="tvp/clbuerger/visits/v1/", P="tvp/clbuerger/presence/v1/", DAY=864e5, seen={}, me={c:"",o:""}, cl=null, sid="";
  try{ sid=sessionStorage.getItem("tvp-presence-id")||""; }catch(e){}
  if(!sid) sid="s"+Math.random().toString(16).slice(2)+Date.now().toString(16);
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function strip(box){ /* alte Zeile "Orte: heute …" entfernen */
    var n=box.firstChild;
    while(n){ var nx=n.nextSibling;
      if(n.nodeType===3&&/^\s*Orte: heute/.test(n.nodeValue)){ var pr=n.previousSibling; if(pr&&pr.nodeName==="BR") box.removeChild(pr); box.removeChild(n); }
      n=nx; } }
  function paint(){ var s=document.getElementById("tv-stats"); if(!s) return; strip(s);
    var el=document.getElementById("tv-orte24");
    if(!el||el.previousSibling!==s){ if(el) el.remove(); el=document.createElement("div"); el.id="tv-orte24"; s.parentNode.insertBefore(el,s.nextSibling); }
    var now=Date.now(), by={}, sess={};
    Object.keys(seen).forEach(function(k){ var p=seen[k]; if(!p||now-p.t>DAY||(!p.c&&!p.o)) return; var id=k.split("|")[1];
      var l=[p.c,p.o].filter(Boolean).join(", "); var key=l+"|"+id; if(sess[key]) return; sess[key]=1; by[l]=(by[l]||0)+1; });
    var rows=Object.keys(by).sort(function(a,b){ return by[b]-by[a]||a.localeCompare(b); });
    var h="Orte letzte 24 h ("+rows.length+"): "+(rows.length?rows.map(function(r){ return esc(r)+(by[r]>1?" \u00d7"+by[r]:""); }).join(" \u00b7 "):"noch keine Daten");
    if(el.innerHTML!==h) el.innerHTML=h;
  }
  var mo=new MutationObserver(function(){ clearTimeout(mo.t); mo.t=setTimeout(paint,50); });
  function watch(){ var s=document.getElementById("tv-stats"); if(s&&!s.__o24){ s.__o24=1; mo.observe(s,{childList:true}); paint(); } }
  setInterval(watch,1000);
  function pub(){ if(!cl||!cl.connected||(!me.c&&!me.o)) return; var b=JSON.stringify({c:me.c.slice(0,64),o:me.o.slice(0,8),t:Date.now()});
    try{ cl.publish(V+sid,b,{qos:0,retain:true}); }catch(e){} seen["v|"+sid]=JSON.parse(b); paint(); }
  function go(){ if(cl||!window.mqtt||!navigator.onLine) return;
    try{ cl=window.mqtt.connect("wss://broker.emqx.io:8084/mqtt",{clientId:"tvpv-"+sid.slice(0,16),clean:true,reconnectPeriod:8000,connectTimeout:12000});
      cl.on("connect",function(){ cl.subscribe([V+"#",P+"#"],{qos:0}); pub(); });
      cl.on("message",function(tp,buf){ var pre=tp.indexOf(V)===0?"v":(tp.indexOf(P)===0?"p":""); if(!pre) return; var id=tp.slice((pre==="v"?V:P).length);
        if(!id||id.indexOf("/")>=0) return; try{ var p=JSON.parse(String(buf)); if(p&&p.t) seen[pre+"|"+id]={c:String(p.c||"").slice(0,64),o:String(p.o||"").slice(0,8),t:+p.t||0}; }catch(e){}
        clearTimeout(go.t); go.t=setTimeout(paint,300); });
    }catch(e){ cl=null; } }
  function start(){ fetch("https://get.geojs.io/v1/ip/geo.json").then(function(r){ return r.json(); }).then(function(g){ me.c=String(g&&g.city||"").trim(); me.o=String(g&&(g.country_code||g.country)||"").trim(); pub(); }).catch(function(){});
    if(!window.mqtt && !document.querySelector('script[src*="mqtt"]')){ var sc=document.createElement("script"); sc.src="https://cdn.jsdelivr.net/npm/mqtt@4.3.7/dist/mqtt.min.js"; sc.async=true; sc.onerror=function(){}; document.head.appendChild(sc); }
    paint(); var w=setInterval(function(){ if(window.mqtt){ clearInterval(w); go(); } },1000); }
  setInterval(pub,5*60*1000); setInterval(paint,30000);
  if(document.readyState==="complete") setTimeout(start,1500); else addEventListener("load",function(){ setTimeout(start,1500); });
  window.tvpOrte24=function(){ return seen; };
})();
