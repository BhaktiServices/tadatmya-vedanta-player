const FOLDER="https://www.dropbox.com/scl/fo/m10ycst2zjp72cwygc1fo/ALB3AGy0uKvmitTOetYJB4U";
const RLKEY="ubqr97xi75q2xr6d3jhf4hcyf";
const STORE="tv-player-resume-v1";
const POS_STORE="tv-player-positions-v2";
const DONE_STORE="tv-player-done-v1";
const TEXT_BASE="texte/";
const LESUNGEN=(window.LESUNGEN||[]).map(function(L){ L.sum=L.sum||""; return L; });
/* [Grok-Bot] V2.00: sparsame 40k-Audios (40 kbit/s mono, gleiche Dateinamen im Dropbox-Unterordner 40k) */
const FOLDER40="https://www.dropbox.com/scl/fo/q5goztqfewubv1phqs332/AOcvsc00TiAtlTlhlhGskHc";
const RLKEY40="n6zhmkp4van54dpbk4mnmx21c";
const SAVE_KEY="tvp-datasave-v1";
const fb40={}; /* Dateien, bei denen 40k in dieser Sitzung scheiterte -> Original */
function mediaUrlOrig(name,bust){return FOLDER+"?rlkey="+encodeURIComponent(RLKEY)+"&preview="+encodeURIComponent(name)+"&raw=1"+(bust?"&_="+Date.now():"");}
function mediaUrl40(name,bust){return FOLDER40+"?rlkey="+encodeURIComponent(RLKEY40)+"&preview="+encodeURIComponent(name)+"&raw=1"+(bust?"&_="+Date.now():"");}
function dataSaveOn(){try{return localStorage.getItem(SAVE_KEY)!=="0";}catch(e){return true;}}
/* Quelle wählen: offline (Blob) > 40k (Datensparen an) > Original. Merkt die Art in a.dataset.q */
function mediaUrl(name,bust){
  if(!/\.mp3$/i.test(name||"")) return mediaUrlOrig(name,bust);
  let q="orig", u;
  const off=window.tvpOfflineUrl&&window.tvpOfflineUrl(name);
  if(off){ q="off"; u=off; }
  else if(dataSaveOn()&&!fb40[name]){ q="40"; u=mediaUrl40(name,bust); }
  else u=mediaUrlOrig(name,bust);
  try{ const el=document.getElementById("a"); if(el){ el.dataset.q=q; el.dataset.qfile=name; } }catch(e){}
  return u;
}
window.mediaUrl40=mediaUrl40; window.mediaUrlOrig=mediaUrlOrig;
const textCache={};
function loadPositions(){
  try{
    const raw=JSON.parse(localStorage.getItem(POS_STORE)||"{}");
    if(raw && typeof raw==="object" && !Array.isArray(raw)) return raw;
  }catch(e){}
  try{
    const st=JSON.parse(localStorage.getItem(STORE)||"null");
    if(st && st.file){
      const m={}; m[st.file]={time:st.time||0,ts:Date.now()};
      localStorage.setItem(POS_STORE,JSON.stringify(m));
      return m;
    }
  }catch(e){}
  return {};
}
function getPos(file){
  const m=loadPositions();
  const p=m[file];
  return p && typeof p.time==="number" ? p.time : 0;
}
function setPos(file,time){
  if(!file) return;
  const m=loadPositions();
  const t=Math.max(0,time||0);
  if(t<2){ delete m[file]; }
  else { m[file]={time:t,ts:Date.now()}; }
  localStorage.setItem(POS_STORE,JSON.stringify(m));
}
function clearPos(file){
  if(!file) return;
  const m=loadPositions();
  delete m[file];
  localStorage.setItem(POS_STORE,JSON.stringify(m));
}
function loadDone(){
  try{
    const raw=JSON.parse(localStorage.getItem(DONE_STORE)||"{}");
    if(raw && typeof raw==="object" && !Array.isArray(raw)) return raw;
  }catch(e){}
  return {};
}
function isDone(file){
  if(!file) return false;
  const m=loadDone();
  return !!m[file];
}
function markDone(file){
  if(!file) return;
  const m=loadDone();
  m[file]={ts:Date.now()};
  localStorage.setItem(DONE_STORE,JSON.stringify(m));
  clearPos(file);
}
function fmtZeitraum(from,to){
  if(!from && !to) return "";
  if(from && to && from!==to) return "Zeitraum: "+from+" – "+to;
  return "Zeitraum: "+(to||from);
}
function applyZeitraum(from,to){
  const el=document.getElementById("zeitraum");
  if(!el) return;
  const t=fmtZeitraum(from,to);
  if(t) el.textContent=t;
}
function loadZeitraum(){
  const z=window.TV_ZEITRAUM||{};
  if(z.from||z.to) applyZeitraum(z.from,z.to);
  fetch(mediaUrl("zeitraum.txt"),{cache:"no-store"}).then(function(r){return r.ok?r.text():"";}).then(function(t){
    t=(t||"").trim().split(/\r?\n/)[0]||"";
    if(!t) return;
    let from="",to="";
    if(t.indexOf("|")>=0){ const p=t.split("|"); from=p[0].trim(); to=(p[1]||"").trim(); }
    else {
      const m=t.replace(/^Zeitraum:\s*/i,"").split(/\s*[–-]\s*/);
      if(m.length>=2){ from=m[0].trim(); to=m[1].trim(); }
      else if(m.length===1) to=m[0].trim();
    }
    if(from||to) applyZeitraum(from,to);
  }).catch(function(){});
}
function loadLectureText(L){
  const key=L.file;
  if(textCache[key]!==undefined) return Promise.resolve(textCache[key]);
  const urls=[];
  if(L.nr) urls.push(TEXT_BASE+L.nr+".txt");
  function tryOne(k){
    if(k>=urls.length){textCache[key]=null;return Promise.resolve(null);}
    return fetch(urls[k],{cache:"no-store"}).then(function(r){
      if(!r.ok) return tryOne(k+1);
      return r.text().then(function(t){ textCache[key]=t; return t; });
    }).catch(function(){ return tryOne(k+1); });
  }
  return tryOne(0);
}
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");}
function loadState(){try{return JSON.parse(localStorage.getItem(STORE)||"null");}catch(e){return null;}}
function saveState(){
  if(i<0||!sichtbar[i])return;
  const file=sichtbar[i].file;
  const time=a.currentTime||0;
  const dur=a.duration;
  if(isFinite(dur)&&dur>30 && time>=dur*0.97){
    markDone(file);
    localStorage.setItem(STORE,JSON.stringify({file:file,time:0}));
    zeichne();
  } else {
    setPos(file,time);
    localStorage.setItem(STORE,JSON.stringify({file:file,time:time}));
  }
  updateResume();
}
let i=-1,resumeTo=0,sichtbar=LESUNGEN.slice(),started=false;
let userPaused=false;
let interruptTimer=0;
/* [Grok-Bot] V1.91: WhatsApp-Pause aus V1.90 zurückgenommen (Autostart lud nicht); Verhalten wie V1.89 */
function clearInterruptTimer(){ if(interruptTimer){ clearTimeout(interruptTimer); interruptTimer=0; } }
window.__tvModal=false;
window.__tvGuardUntil=0;
function modalOpen(){
  return window.__tvModal || Date.now()<window.__tvGuardUntil ||
    !!(document.querySelector(".overlay.on"));
}
const a=document.getElementById("a");
function holdPitch(){a.preservesPitch=true;a.webkitPreservesPitch=true;a.mozPreservesPitch=true;}
function setSpeed(v){const r=parseFloat(v);a.playbackRate=isFinite(r)&&r>0?r:1;try{holdPitch();}catch(e){}}
try{holdPitch();}catch(e){}
function canSkip(){
  if(modalOpen()) return false;
  if(!a.getAttribute("src")) return false;
  if(!started) return false;
  if(a.readyState<1) return false;
  const dur=a.duration;
  if(!(isFinite(dur)&&dur>1) && !(a.currentTime>0.2)) return false;
  return true;
}
function syncSkipBtns(){
  const on=canSkip();
  ["btnSkipBack","btnSkipFwd"].forEach(function(id){
    const b=document.getElementById(id);
    if(b) b.disabled=!on;
  });
}
function syncPlayBtn(){
  const b=document.getElementById("btnPlay");
  if(b) b.textContent=a.paused?"Play":"Pause";
  syncSkipBtns();
}
a.addEventListener("play",function(){ started=true; const sel=document.getElementById("speed"); if(sel)setSpeed(sel.value); syncPlayBtn(); });
function filterList(){const q=document.getElementById("q").value.trim().toLowerCase();sichtbar=LESUNGEN.filter(function(L){if(!q)return true;return (L.titel+" "+L.file+" "+(L.tags||[]).join(" ")).toLowerCase().indexOf(q)!==-1;});if(i>=sichtbar.length)i=sichtbar.length?0:-1;zeichne();}
function labelOf(L){return (L.nr?"#"+L.nr+"  ":"")+L.titel;}
function zeichne(){
  const box=document.getElementById("list");
  box.innerHTML="";
  sichtbar.forEach(function(L,idx){
    const d=document.createElement("button");
    d.type="button";
    d.className="item"+(idx===i?" active":"");
    d.setAttribute("data-idx",String(idx));
    const done=isDone(L.file);
    const pos=getPos(L.file);
    let mark="";
    if(done) mark+=" <span class=\"done\" title=\"angehört\">✓</span>";
    if(pos>3) mark+=" · weiter bei "+fmt(pos);
    if(window.tvpOfflineHas&&window.tvpOfflineHas(L.file)) mark+=" <span class=\"offmark\" title=\"offline gespeichert\">offline</span>"; /* [Grok-Bot] V2.00 */
    d.innerHTML=labelOf(L)+mark+"<div class='tags'>"+(L.tags||[]).join(" ")+"</div>";
    box.appendChild(d);
  });
}
(function bindList(){
  const box=document.getElementById("list");
  if(!box||box.__tvClick) return;
  box.__tvClick=1;
  let sx=0,sy=0,moved=false;
  box.addEventListener("pointerdown",function(e){
    const t=e.touches?e.touches[0]:e;
    sx=t.clientX; sy=t.clientY; moved=false;
  },{passive:true});
  box.addEventListener("pointermove",function(e){
    const t=e.touches?e.touches[0]:e;
    if(Math.abs(t.clientX-sx)>12 || Math.abs(t.clientY-sy)>12) moved=true;
  },{passive:true});
  box.addEventListener("click",function(e){
    if(modalOpen()) return;
    if(moved){ moved=false; return; }
    const d=e.target.closest(".item");
    if(!d||!box.contains(d)) return;
    const idx=parseInt(d.getAttribute("data-idx"),10);
    if(!isFinite(idx)) return;
    play(idx);
  });
})();
function updateResume(){const st=loadState();const btn=document.getElementById("btnResume");if(!st||!st.file){btn.disabled=true;btn.textContent="Weiterhören";return;}const L=LESUNGEN.find(function(x){return x.file===st.file;});btn.disabled=false;btn.textContent="Weiterhören · "+(L?labelOf(L):"Datei")+" ("+fmt(st.time)+")";}
function play(idx,startAt){
  if(modalOpen() && !window.__tvAllowPlay) return;
  if(!sichtbar.length)return;
  i=Math.max(0,Math.min(idx,sichtbar.length-1));
  const L=sichtbar[i];
  let at=startAt;
  if(at===undefined){
    at=getPos(L.file)||0;
  }
  resumeTo=at||0;
  started=false;
  recoverTries=0;
  clearRecoverTimers();
  syncSkipBtns();
  document.getElementById("now").textContent=labelOf(L);
  userPaused=false;
  updateMediaSession(L);
  document.getElementById("nr").value=L.nr||"";
  document.getElementById("err").textContent="";
  zeichne();
  a.muted=false; a.volume=1; a.src=mediaUrl(L.file);
  function tryPlay(){
    userPaused=false;
    const p=a.play();
    if(p&&p.catch)p.catch(function(){document.getElementById("err").textContent="Kein Ton — Play im Balken oder die goldene Play-Taste tippen.";});
  }
  if(a.readyState>=3) tryPlay();
  else a.addEventListener("canplay",tryPlay,{once:true});
  a.load();
}
window.play=play;
function playNr(){const n=parseInt(document.getElementById("nr").value,10);const idx=sichtbar.findIndex(function(L){return L.nr===n;});if(idx<0){document.getElementById("err").textContent="Keine Lesung für #"+n;return;}play(idx,0);}
function resumeNow(){const st=loadState();if(!st)return;let idx=sichtbar.findIndex(function(L){return L.file===st.file;});if(idx<0){document.getElementById("q").value="";filterList();idx=sichtbar.findIndex(function(L){return L.file===st.file;});}if(idx<0)return;play(idx,st.time||0);}
function skipTarget(sec){
  let base=a.currentTime;
  if(!isFinite(base)||base<0) base=0;
  let dest=base+sec;
  const dur=a.duration;
  if(isFinite(dur)&&dur>1&&dur!==Infinity) dest=Math.max(0,Math.min(dest,dur-0.25));
  else dest=Math.max(0,dest);
  return dest;
}
function applySeek(dest){
  try{
    if(typeof a.fastSeek==="function") a.fastSeek(dest);
    else a.currentTime=dest;
  }catch(e){
    try{ a.currentTime=dest; }catch(e2){}
  }
}
function skip(sec){
  if(!canSkip()) return;
  const dest=skipTarget(sec);
  const wasPlaying=!a.paused;
  applySeek(dest);
  function resumePlay(){
    if(!wasPlaying) return;
    const p=a.play();
    if(p&&p.catch) p.catch(function(){});
  }
  a.addEventListener("seeked",function onSeeked(){
    a.removeEventListener("seeked",onSeeked);
    resumePlay();
  });
  setTimeout(function(){
    if(Math.abs((a.currentTime||0)-dest)>1.5) applySeek(dest);
    resumePlay();
    saveState();
  },180);
}
window.skip=skip;
function prev(){if(modalOpen())return;play(i<0?0:i-1,0);} function next(){if(modalOpen())return;play(i<0?0:i+1,0);}
function currentLectureFile(){
  return (i>=0&&sichtbar[i])?sichtbar[i].file:"";
}
let recoverTries=0, recoverDebounceUntil=0, recoverStallTimer=0, recoverWaitTimer=0;
function clearRecoverTimers(){
  if(recoverStallTimer){ clearTimeout(recoverStallTimer); recoverStallTimer=0; }
  if(recoverWaitTimer){ clearTimeout(recoverWaitTimer); recoverWaitTimer=0; }
}
function recoverPlayback(reason){
  const now=Date.now();
  if(now<recoverDebounceUntil) return;
  recoverDebounceUntil=now+1500;
  if(reason==="toggle"||reason==="play-reject") recoverTries=0;
  const file=currentLectureFile();
  if(!file){
    document.getElementById("err").textContent="Stream abgebrochen — nochmal Play tippen.";
    return;
  }
  recoverTries++;
  if(recoverTries>3){
    document.getElementById("err").textContent="Stream abgebrochen — nochmal Play tippen.";
    return;
  }
  let pos=a.currentTime;
  if(!(isFinite(pos)&&pos>1)) pos=getPos(file)||0;
  resumeTo=pos||0;
  started=false;
  syncSkipBtns();
  document.getElementById("err").textContent="Verbindung neu …";
  clearRecoverTimers();
  a.muted=false; a.volume=1;
  a.src=mediaUrl(file,true);
  function onCanPlay(){
    a.removeEventListener("canplay",onCanPlay);
    if(resumeTo>0){
      try{
        const dur=a.duration;
        const t=isFinite(dur)&&dur>1?Math.min(resumeTo,Math.max(0,dur-1)):resumeTo;
        a.currentTime=t;
      }catch(e){}
    }
    userPaused=false;
    const p=a.play();
    if(p&&p.catch)p.catch(function(){
      document.getElementById("err").textContent="Stream abgebrochen — nochmal Play tippen.";
    });
  }
  a.addEventListener("canplay",onCanPlay,{once:true});
  a.load();
}
function playFromSession(){
  userPaused=false;
  if(!a.getAttribute("src")){
    if(loadState())resumeNow();
    else play(0,0);
    return;
  }
  if(a.error || (a.getAttribute("src") && a.readyState===0)){
    recoverPlayback("toggle");
    return;
  }
  const p=a.play();
  if(p&&p.catch)p.catch(function(){ recoverPlayback("play-reject"); });
  try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="playing"; }catch(e){}
}
function pauseFromSession(){
  userPaused=true;
  clearInterruptTimer();
  a.pause();
  try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="paused"; }catch(e){}
}
function toggle(){
  if(modalOpen())return;
  if(!a.getAttribute("src")){
    userPaused=false;
    if(loadState())resumeNow();
    else play(0,0);
    return;
  }
  if(a.error || (a.getAttribute("src") && a.readyState===0)){
    userPaused=false;
    recoverPlayback("toggle");
    return;
  }
  if(a.paused){
    userPaused=false;
    const p=a.play();
    if(p&&p.catch)p.catch(function(){ recoverPlayback("play-reject"); });
    try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="playing"; }catch(e){}
  } else {
    userPaused=true;
    clearInterruptTimer();
    a.pause();
    try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="paused"; }catch(e){}
  }
}
function placeOverlay(){const d=document.getElementById("dlg");if(d){d.style.top="0px";d.style.left="0px";d.style.right="0px";d.style.bottom="0px";}}
function showSum(){
  const L=(i>=0?sichtbar[i]:null)||sichtbar[0];if(!L)return;
  window.__tvModal=true;
  document.getElementById("dlgT").textContent=labelOf(L);
  document.getElementById("dlgTags").textContent=(L.tags||[]).join(" ");
  document.getElementById("dlgB").textContent="Text wird geladen …";
  placeOverlay();
  const dlg=document.getElementById("dlg");
  dlg.classList.add("on");
  dlg.querySelectorAll(".xclose").forEach(function(b){ b.remove(); });
  loadLectureText(L).then(function(t){document.getElementById("dlgB").textContent=t||L.sum||"Kein Text gefunden.";});
}
function hideSum(){
  window.__tvModal=false;
  window.__tvGuardUntil=Date.now()+350;
  const dlg=document.getElementById("dlg");
  if(dlg) dlg.classList.remove("on");
}
window.hideSum=hideSum;
window.showSum=showSum;
(function bindTextClose(){
  const dlg=document.getElementById("dlg");
  if(!dlg||dlg.__tvClose) return;
  dlg.__tvClose=1;
  dlg.addEventListener("click",function(e){
    if(e.target===dlg){ hideSum(); return; }
    if(e.target.closest("#btnCloseSum, .btnCloseTop, .xclose")) hideSum();
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape" || e.key==="Esc"){
      hideSum();
      if(typeof hideFb==="function") hideFb();
    }
  });
})();
a.addEventListener("loadedmetadata",function(){
  if(resumeTo>0&&isFinite(a.duration)){
    a.currentTime=Math.min(resumeTo,Math.max(0,a.duration-1));
    resumeTo=0;
  }
  syncSkipBtns();
});
a.addEventListener("canplay",syncSkipBtns);
let lastPosStateAt=0;
a.addEventListener("timeupdate",function(){
  if(!a.paused)saveState();
  syncSkipBtns();
  const now=Date.now();
  if(now-lastPosStateAt<1000) return;
  lastPosStateAt=now;
  try{
    if(navigator.mediaSession && isFinite(a.duration) && a.duration>0){
      navigator.mediaSession.setPositionState({
        duration:a.duration,
        playbackRate:a.playbackRate||1,
        position:Math.min(a.currentTime||0,a.duration)
      });
    }
  }catch(e){}
});
a.addEventListener("pause",function(){
  saveState();syncPlayBtn();
  if(userPaused){
    try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="paused"; }catch(e){}
    return;
  }
  const dur=a.duration;
  const nearEnd=(a.ended) || (isFinite(dur) && dur>0 && a.currentTime>=dur-0.5);
  if(nearEnd || !a.getAttribute("src")) return;
  clearInterruptTimer();
  interruptTimer=setTimeout(function(){
    interruptTimer=0;
    if(userPaused || !a.paused || !a.getAttribute("src")) return;
    const p=a.play();
    if(p&&p.catch)p.catch(function(){ recoverPlayback("interrupt"); });
  },550);
});
a.addEventListener("ended",function(){
  const doneFile=(i>=0&&sichtbar[i])?sichtbar[i].file:"";
  if(doneFile) markDone(doneFile);
  localStorage.setItem(STORE,JSON.stringify({file:doneFile,time:0}));
  started=false;syncSkipBtns();updateResume();
  next();
  if(doneFile) markDone(doneFile);
  zeichne();
});
a.addEventListener("error",function(){
  started=false;syncSkipBtns();
  /* [Grok-Bot] V2.00: Fehler bei 40k oder Offline-Kopie -> sofort auf nächste Quelle (Original) zurückfallen */
  const q=a.dataset.q, f=a.dataset.qfile;
  if(f&&(q==="40"||q==="off")){
    if(q==="off"&&window.tvpOfflineBad) window.tvpOfflineBad(f);
    if(q==="40") fb40[f]=1;
    recoverTries=0; recoverDebounceUntil=0;
  }
  recoverPlayback("error");
});
a.addEventListener("stalled",function(){
  if(recoverStallTimer) clearTimeout(recoverStallTimer);
  recoverStallTimer=setTimeout(function(){
    recoverStallTimer=0;
    if(!a.paused && a.readyState<2) recoverPlayback("stalled");
  },8000);
});
a.addEventListener("waiting",function(){
  if(recoverWaitTimer) clearTimeout(recoverWaitTimer);
  recoverWaitTimer=setTimeout(function(){
    recoverWaitTimer=0;
    if(!a.paused && a.readyState<3) recoverPlayback("waiting");
  },12000);
});
a.addEventListener("playing",function(){
  recoverTries=0;
  clearRecoverTimers();
  clearInterruptTimer();
  document.getElementById("err").textContent="";
  syncPlayBtn();
  try{ if(navigator.mediaSession) navigator.mediaSession.playbackState="playing"; }catch(e){}
});
function bindSkip(id,sec){
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener("click",function(e){
    e.preventDefault();
    if(!canSkip()) return;
    skip(sec);
  });
}
bindSkip("btnSkipBack",-10);
bindSkip("btnSkipFwd",10);
syncSkipBtns();
function updateMediaSession(L){
  if(!navigator.mediaSession || !L) return;
  try{
    let art="";
    try{ art=new URL("cover.jpg", location.href).href; }catch(e){ art="cover.jpg"; }
    navigator.mediaSession.metadata=new MediaMetadata({
      title:labelOf(L),
      artist:"Rishi Sahadev",
      album:"Tādātmya Vedānta",
      artwork:[{src:art,sizes:"512x512",type:"image/jpeg"}]
    });
  }catch(e){}
}
try{
  if(navigator.mediaSession){
    navigator.mediaSession.setActionHandler("play",function(){ playFromSession(); });
    navigator.mediaSession.setActionHandler("pause",function(){ pauseFromSession(); });
    navigator.mediaSession.setActionHandler("nexttrack",function(){ next(); });
    navigator.mediaSession.setActionHandler("previoustrack",function(){ prev(); });
    navigator.mediaSession.setActionHandler("seekbackward",function(){ if(canSkip()) skip(-10); });
    navigator.mediaSession.setActionHandler("seekforward",function(){ if(canSkip()) skip(10); });
  }
}catch(e){}
document.addEventListener("visibilitychange",function(){
  if(document.visibilityState!=="visible") return;
  if(userPaused || !a.paused || !a.getAttribute("src")) return;
  const p=a.play();
  if(p&&p.catch)p.catch(function(){});
});
function mergeEntries(arr){
  if(!Array.isArray(arr)) return 0;
  let n=0;
  arr.forEach(function(E){
    if(!E) return;
    const file=E.file||E.name||E.filename;
    if(!file) return;
    if(LESUNGEN.some(function(L){return L.file===file;})) return;
    let nr=E.nr||null;
    const m=String(file+" "+(E.titel||"")).match(/#(\d+)/);
    if(!nr && m) nr=parseInt(m[1],10);
    LESUNGEN.push({nr:nr,titel:E.titel||E.title||file.replace(/\.mp3$/i,""),file:file,tags:E.tags||[],sum:E.sum||""});
    n++;
  });
  if(n){ sichtbar=LESUNGEN.slice(); filterList(); updateResume(); }
  return n;
}
function loadExtraCatalog(){
  fetch(mediaUrl("katalog.json"),{cache:"no-store"}).then(function(r){return r.ok?r.json():Promise.reject();}).then(mergeEntries).catch(function(){
    fetch(mediaUrl("katalog.txt"),{cache:"no-store"}).then(function(r){return r.ok?r.text():"";}).then(function(t){
      if(!t) return;
      const files=t.split(/\r?\n/).map(function(l){return l.trim();}).filter(function(l){return l&&l.charAt(0)!=="#"&&/\.mp3$/i.test(l);});
      mergeEntries(files.map(function(f){return {file:f};}));
    }).catch(function(){});
  });
}
zeichne();updateResume();syncSkipBtns();
loadZeitraum();
loadExtraCatalog();
if(!LESUNGEN.length) document.getElementById("err").textContent="Katalog lesungen.js fehlt.";
