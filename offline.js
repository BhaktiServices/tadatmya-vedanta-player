/* [Grok-Bot] V2.00: Offline-Modus + Schalter „Datensparen“
   - Vorträge einzeln oder alle offline speichern (Cache API „tvp-audio-v1“), bevorzugt 40k, sonst Original.
   - CORS: Die Ordner-URL (www.dropbox.com …&preview=) leitet ohne CORS-Header weiter, fetch() scheitert. Daher wird direkt
     von dl.dropboxusercontent.com mit der Datei-ID aus dlmap.js geladen (Access-Control-Allow-Origin: *).
   - Wiedergabe offline per Blob-URL (keine Range-Requests nötig). navigator.storage.persist() wird angefragt. */
(function(){
  var CN="tvp-audio-v1", IDX="tvp-offline-v1";
  var urls={}, busy=false, stopAll=false;
  function idx(){ try{return JSON.parse(localStorage.getItem(IDX)||"{}");}catch(e){return {};} }
  function setIdx(o){ try{localStorage.setItem(IDX,JSON.stringify(o));}catch(e){} }
  function key(f){ return "./offline-audio/"+encodeURIComponent(f); }
  function mb(b){ return (b/1048576).toFixed(b<1048576*10?1:0).replace(".",",")+" MB"; }
  function lectures(){ return ((typeof LESUNGEN!=="undefined"&&LESUNGEN)||window.LESUNGEN||[]).filter(function(L){return L&&L.file&&/\.mp3$/i.test(L.file);}); }
  window.tvpOfflineHas=function(f){ return !!idx()[f]; };
  window.tvpOfflineUrl=function(f){ return urls[f]||null; };
  window.tvpOfflineBad=function(f){ remove(f); };
  function redraw(){ try{ if(typeof zeichne==="function") zeichne(); }catch(e){} render(); }
  function loadUrl(f){
    if(!("caches" in window)) return Promise.resolve();
    return caches.open(CN).then(function(c){return c.match(key(f));}).then(function(r){
      if(!r){ var o=idx(); delete o[f]; setIdx(o); return; }
      return r.blob().then(function(b){ urls[f]=URL.createObjectURL(new Blob([b],{type:"audio/mpeg"})); });
    });
  }
  function save(f,onProg){
    var tries=[]; var dsOn=(typeof dataSaveOn!=="function")||dataSaveOn();
    var u40=window.tvpDlUrl&&window.tvpDlUrl("40",f), uo=window.tvpDlUrl&&window.tvpDlUrl("orig",f);
    if(u40) tries.push(["40",u40]);
    if(uo) tries.push(["orig",uo]);
    if(!dsOn) tries.reverse();
    function attempt(k){
      if(k>=tries.length) return Promise.reject(new Error(tries.length?"Download fehlgeschlagen":"für diesen Vortrag noch keine Download-Kennung (dlmap.js)"));
      return fetch(tries[k][1],{mode:"cors"}).then(function(r){
        var ct=r.headers.get("content-type")||"";
        if(!r.ok||!/audio|octet/i.test(ct)) throw new Error("HTTP "+r.status);
        var total=+r.headers.get("content-length")||0, got=0, chunks=[];
        if(!r.body||!r.body.getReader) return r.blob().then(function(b){return [b,tries[k][0]];});
        var rd=r.body.getReader();
        function pump(){ return rd.read().then(function(x){
          if(x.done) return [new Blob(chunks,{type:"audio/mpeg"}),tries[k][0]];
          if(stopAll){ rd.cancel(); throw new Error("abgebrochen"); }
          chunks.push(x.value); got+=x.value.length; onProg&&onProg(got,total); return pump(); }); }
        return pump();
      }).catch(function(e){ if(stopAll) throw e; return attempt(k+1); });
    }
    return attempt(0).then(function(res){
      var b=res[0];
      return caches.open(CN).then(function(c){
        return c.put(key(f),new Response(b,{headers:{"Content-Type":"audio/mpeg","Content-Length":String(b.size)}}));
      }).then(function(){
        var o=idx(); o[f]={size:b.size,q:res[1],t:Date.now()}; setIdx(o);
        if(urls[f]) URL.revokeObjectURL(urls[f]);
        urls[f]=URL.createObjectURL(b);
      });
    });
  }
  function remove(f){
    var o=idx(); delete o[f]; setIdx(o);
    if(urls[f]){ URL.revokeObjectURL(urls[f]); delete urls[f]; }
    var p=("caches" in window)?caches.open(CN).then(function(c){return c.delete(key(f));}):Promise.resolve();
    return p.then(redraw);
  }
  function removeAll(){
    setIdx({}); Object.keys(urls).forEach(function(f){URL.revokeObjectURL(urls[f]);}); urls={};
    return (("caches" in window)?caches.delete(CN):Promise.resolve()).then(redraw);
  }
  window.tvpOfflineSave=function(f){ return save(f).then(redraw); };
  /* Schätzung „noch benötigt“: 40k ≈ 18 MB/h; ohne Dauer 18 MB pro Vortrag */
  function estimate(L){ return 18*1048576; }
  var status="";
  function render(){
    var box=document.getElementById("offList"); if(!box) return;
    var o=idx(), used=0, need=0, n=0;
    var ls=lectures();
    box.innerHTML="";
    ls.forEach(function(L){
      var has=!!o[L.file]; if(has){used+=o[L.file].size||0;n++;} else need+=estimate(L);
      var row=document.createElement("div"); row.className="off-row";
      var lab=document.createElement("span"); lab.className="off-lab";
      lab.textContent=(typeof labelOf==="function"?labelOf(L):L.file).replace(/<[^>]*>/g,"");
      if(has){ var m=document.createElement("span"); m.className="offmark"; m.textContent="offline · "+mb(o[L.file].size)+(o[L.file].q==="40"?"":" (Original)"); lab.appendChild(document.createTextNode(" ")); lab.appendChild(m); }
      var b=document.createElement("button"); b.type="button";
      b.textContent=has?"Löschen":"Speichern"; if(has) b.className="gold";
      b.disabled=busy;
      b.onclick=function(){ if(has) remove(L.file); else runQueue([L.file]); };
      row.appendChild(lab); row.appendChild(b); box.appendChild(row);
    });
    var s=document.getElementById("offSum");
    if(s) s.textContent="Offline: "+n+" von "+ls.length+" · belegt "+mb(used)+" · für den Rest noch ca. "+mb(need)+(status?" · "+status:"");
    var ba=document.getElementById("offAll"); if(ba){ ba.disabled=false; ba.textContent=busy?"Abbrechen":"Alle speichern"; }
    if(navigator.storage&&navigator.storage.estimate){ navigator.storage.estimate().then(function(e){ var q=document.getElementById("offQuota"); if(q&&e.quota) q.textContent="Gerätespeicher frei für den Player: ca. "+mb(Math.max(0,e.quota-e.usage)); }).catch(function(){}); }
  }
  function runQueue(files){
    if(busy) return; busy=true; stopAll=false;
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
    var k=0;
    function nextOne(){
      if(stopAll||k>=files.length){ busy=false; status=stopAll?"abgebrochen":(files.length?"fertig":""); redraw(); return; }
      var f=files[k++];
      status="lade "+k+"/"+files.length+" …"; render();
      var bar=document.getElementById("offBar");
      save(f,function(g,t){ var p=t?Math.round(g*100/t):0; status="lade "+k+"/"+files.length+": "+(t?p+" %":mb(g)); if(bar) bar.value=t?p:0; var s=document.getElementById("offSum"); if(s) s.textContent=s.textContent.replace(/ · lade .*$/,"")+" · "+status; })
        .then(function(){ redraw(); },function(e){ status="Fehler: "+e.message; })
        .then(nextOne);
    }
    render(); nextOne();
  }
  function build(){
    var css=document.createElement("style");
    css.textContent=".offmark{color:#1a1410;background:var(--gold);border-radius:4px;padding:0 .35em;font-size:.75em;margin-left:.3em}"+
      "#offDlg .off-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #3a2e26}#offDlg .off-lab{flex:1;font-size:.9rem}"+
      "#offDlg progress{width:100%;height:10px}#offDlg .off-sum{padding:0 12px;font-size:.85rem;color:var(--muted)}";
    document.head.appendChild(css);
    var row=document.querySelector("#btnVolNorm"); row=row&&row.parentNode;
    if(row){
      var bs=document.createElement("button"); bs.type="button"; bs.id="btnDataSave";
      function syncDs(){ var on=dataSaveOn(); bs.className=on?"gold":""; bs.textContent="Datensparen "+(on?"an":"aus"); bs.setAttribute("aria-pressed",on?"true":"false"); }
      bs.onclick=function(){
        var on=!dataSaveOn(); try{localStorage.setItem("tvp-datasave-v1",on?"1":"0");}catch(e){} syncDs();
        /* laufenden Vortrag an derselben Stelle mit der neuen Quelle fortsetzen */
        var a=document.getElementById("a"), f=a&&a.dataset.qfile;
        if(f&&a.dataset.q!=="off"&&typeof recoverPlayback==="function"){ var was=!a.paused; try{recoverDebounceUntil=0;recoverTries=0;}catch(e){} if(was) recoverPlayback("toggle"); else { var t=a.currentTime; a.src=mediaUrl(f); try{a.currentTime=t;}catch(e){} } }
      };
      syncDs(); row.appendChild(bs);
      var bo=document.createElement("button"); bo.type="button"; bo.id="btnOffline"; bo.textContent="Offline";
      bo.onclick=function(){ document.getElementById("offDlg").classList.add("on"); render(); };
      row.appendChild(bo);
    }
    var d=document.createElement("div"); d.className="overlay"; d.id="offDlg";
    d.innerHTML='<div class="panel"><div class="dlghead"><h3>Offline speichern</h3><button type="button" class="gold btnCloseTop" id="offClose">Schließen</button></div>'+
      '<p class="off-sum" id="offSum"></p><p class="off-sum" id="offQuota"></p><div style="padding:0 12px"><progress id="offBar" max="100" value="0"></progress></div>'+
      '<div class="dlgbody" id="offList" style="white-space:normal"></div>'+
      '<div class="dlgfoot" style="display:flex;gap:8px"><button type="button" class="gold" id="offAll" style="flex:1">Alle speichern</button><button type="button" id="offDel" style="flex:1">Alle löschen</button></div></div>';
    document.body.appendChild(d);
    function close(){ d.classList.remove("on"); }
    document.getElementById("offClose").onclick=close;
    d.addEventListener("click",function(e){ if(e.target===d) close(); });
    document.getElementById("offAll").onclick=function(){
      if(busy){ stopAll=true; return; }
      var o=idx(); runQueue(lectures().map(function(L){return L.file;}).filter(function(f){return !o[f];}));
    };
    document.getElementById("offDel").onclick=function(){ if(confirm("Alle offline gespeicherten Vorträge löschen?")) removeAll(); };
  }
  function init(){
    build();
    var o=idx();
    Promise.all(Object.keys(o).map(function(f){return loadUrl(f).catch(function(){});})).then(redraw);
    if(Object.keys(o).length){ try{ navigator.storage&&navigator.storage.persist&&navigator.storage.persist(); }catch(e){} }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
