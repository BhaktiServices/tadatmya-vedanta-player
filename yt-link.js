/* [Grok-Bot] V2.15: ein YouTube-Button beim laufenden Vortrag.
   Öffnet ein Overlay mit eingebettetem Video (youtube-nocookie) an der aktuellen Stelle
   (start=<Sekunden>). Audio wird dabei pausiert (userPaused, damit der Wächter nicht neu startet).
   Beim Schließen: IFrame entfernen; wenn die YouTube-IFrame-API bereit ist, Audio an die
   Videozeit setzen (nicht automatisch weiterlaufen). Offline oder wenn das IFrame in 8 s
   nicht lädt: freundliche Meldung, Audio nicht bzw. nicht weiter pausiert.
   IDs aus TV_THUMBS und TV_THUMBS_FILE. Kein Listen-Button. Kein Zeit-Offset (Dauern stimmen). */
(function(){
  var ytPlayer=null, loadTimer=0, pausedForYt=false;

  function ytId(L){
    if(!L) return "";
    if(L.nr){
      const byNr=(window.TV_THUMBS||{})[L.nr];
      if(byNr && byNr.yt) return byNr.yt;
    }
    const file=String(L.file||"")+(L.titel||"");
    const map=window.TV_THUMBS_FILE||{};
    for(const k in map){
      if(k && file.indexOf(k)>=0 && map[k] && map[k].yt) return map[k].yt;
    }
    return "";
  }
  function currentSec(){
    const a=document.getElementById("a");
    let t=a && isFinite(a.currentTime)?a.currentTime:0;
    if(t<0) t=0;
    return Math.floor(t);
  }
  function currentLecture(){
    if(typeof sichtbar!=="undefined" && typeof i==="number" && i>=0 && sichtbar[i]) return sichtbar[i];
    return null;
  }
  function watchUrl(id, sec){
    let u="https://www.youtube.com/watch?v="+id;
    if(sec>0) u+="&t="+sec+"s";
    return u;
  }
  function embedUrl(id, sec){
    let u="https://www.youtube-nocookie.com/embed/"+id+"?start="+Math.max(0,sec|0)+"&autoplay=1&rel=0&playsinline=1&enablejsapi=1";
    try{ u+="&origin="+encodeURIComponent(location.origin); }catch(e){}
    return u;
  }
  function ensureApi(){
    if(window.YT && YT.Player) return;
    if(document.getElementById("tvYtApi")) return;
    const s=document.createElement("script");
    s.id="tvYtApi";
    s.src="https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
  function pauseAudio(){
    const a=document.getElementById("a");
    if(!a || a.paused){ pausedForYt=false; return; }
    pausedForYt=true;
    if(typeof pauseFromSession==="function") pauseFromSession();
    else {
      try{ userPaused=true; }catch(e){}
      try{ a.pause(); }catch(e){}
    }
  }
  function resumeIfPausedForYt(){
    if(!pausedForYt) return;
    pausedForYt=false;
    const a=document.getElementById("a");
    if(!a || !a.getAttribute("src")) return;
    try{ userPaused=false; }catch(e){}
    const p=a.play();
    if(p&&p.catch)p.catch(function(){});
  }
  function seekAudio(sec){
    const a=document.getElementById("a");
    if(!a || !isFinite(sec) || sec<0) return;
    try{
      const dur=a.duration;
      if(isFinite(dur)&&dur>0) sec=Math.min(sec, Math.max(0, dur-0.25));
      a.currentTime=sec;
    }catch(e){}
  }
  function clearPlayer(syncTime){
    let t=-1;
    if(ytPlayer){
      if(syncTime){
        try{ t=Math.floor(ytPlayer.getCurrentTime()||0); }catch(e){ t=-1; }
      }
      try{ ytPlayer.destroy(); }catch(e){}
      ytPlayer=null;
    }
    const wrap=document.getElementById("ytFrameWrap");
    if(wrap){
      const iframe=wrap.querySelector("iframe");
      if(iframe) iframe.src="about:blank";
      wrap.innerHTML="";
    }
    if(syncTime && t>=0) seekAudio(t);
  }
  function showOffline(){
    clearTimeout(loadTimer); loadTimer=0;
    clearPlayer(false);
    const dlg=document.getElementById("ytDlg");
    const msg=document.getElementById("ytOffline");
    const ext=document.getElementById("ytExt");
    if(dlg) dlg.classList.add("offline","on");
    if(msg) msg.hidden=false;
    if(ext) ext.hidden=true;
    resumeIfPausedForYt();
  }
  function onVideoReady(){
    clearTimeout(loadTimer); loadTimer=0;
  }
  function attachPlayer(iframe){
    function hook(){
      if(!window.YT || !YT.Player || !iframe || !iframe.parentNode) return;
      try{
        ytPlayer=new YT.Player(iframe, {events:{onReady:function(){ onVideoReady(); }}});
      }catch(e){}
    }
    if(window.YT && YT.Player) hook();
    else {
      const prev=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=function(){
        if(typeof prev==="function") try{ prev(); }catch(e){}
        hook();
      };
    }
  }
  function closeYt(){
    clearTimeout(loadTimer); loadTimer=0;
    const dlg=document.getElementById("ytDlg");
    const wasOffline=!!(dlg && dlg.classList.contains("offline"));
    clearPlayer(!wasOffline);
    if(dlg){
      dlg.classList.remove("on","offline");
      dlg.setAttribute("aria-hidden","true");
    }
    const msg=document.getElementById("ytOffline");
    if(msg) msg.hidden=true;
    pausedForYt=false;
  }
  function openYt(){
    const L=currentLecture();
    const id=ytId(L);
    if(!id) return;
    const sec=currentSec();
    const dlg=document.getElementById("ytDlg");
    const wrap=document.getElementById("ytFrameWrap");
    const msg=document.getElementById("ytOffline");
    const ext=document.getElementById("ytExt");
    const title=document.getElementById("ytDlgTitle");
    if(!dlg||!wrap) return;
    if(title) title.textContent=(typeof labelOf==="function"?labelOf(L):"YouTube");
    if(ext){ ext.href=watchUrl(id, sec); ext.hidden=false; }
    if(msg) msg.hidden=true;
    dlg.classList.remove("offline");
    dlg.classList.add("on");
    dlg.setAttribute("aria-hidden","false");
    if(navigator.onLine===false){
      showOffline();
      return;
    }
    pauseAudio();
    ensureApi();
    wrap.innerHTML="";
    const iframe=document.createElement("iframe");
    iframe.id="ytFrame";
    iframe.src=embedUrl(id, sec);
    iframe.setAttribute("allow","autoplay; encrypted-media; picture-in-picture; fullscreen");
    iframe.setAttribute("allowfullscreen","");
    iframe.setAttribute("title",(typeof labelOf==="function"?labelOf(L):"YouTube"));
    iframe.addEventListener("load", function(){
      if(navigator.onLine===false){ showOffline(); return; }
      onVideoReady();
    });
    wrap.appendChild(iframe);
    attachPlayer(iframe);
    clearTimeout(loadTimer);
    loadTimer=setTimeout(function(){
      if(!dlg.classList.contains("on") || dlg.classList.contains("offline")) return;
      showOffline();
    }, 8000);
  }
  function setNowLink(L){
    const el=document.getElementById("now");
    if(!el) return;
    const title=(L && typeof labelOf==="function")?labelOf(L):(L?String(L.titel||""):"");
    el.textContent="";
    const t=document.createElement("span");
    t.className="now-title";
    t.textContent=title;
    el.appendChild(t);
    if(!ytId(L)) return;
    const b=document.createElement("button");
    b.type="button";
    b.className="yt-link";
    const lab="YouTube-Video an der aktuellen Stelle im Player öffnen";
    b.title=lab;
    b.setAttribute("aria-label",lab);
    b.innerHTML='<span class="yt-ico" aria-hidden="true"></span><span class="yt-txt">YouTube</span>';
    b.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      openYt();
    });
    el.appendChild(b);
  }

  window.tvYtId=ytId;
  window.tvCloseYt=closeYt;

  const origPlay=window.play;
  if(typeof origPlay==="function"){
    window.play=function(idx){
      const ret=origPlay.apply(this, arguments);
      try{
        const L=currentLecture();
        if(L) setNowLink(L);
      }catch(e){}
      return ret;
    };
  }

  function bindDlg(){
    const dlg=document.getElementById("ytDlg");
    if(!dlg||dlg.__tvYtBound) return;
    dlg.__tvYtBound=1;
    const closeBtn=document.getElementById("ytDlgClose");
    if(closeBtn) closeBtn.addEventListener("click", function(e){ e.preventDefault(); closeYt(); });
    dlg.addEventListener("click", function(e){ if(e.target===dlg) closeYt(); });
    document.addEventListener("keydown", function(e){
      if(e.key==="Escape" && dlg.classList.contains("on")){ e.preventDefault(); closeYt(); }
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bindDlg);
  else bindDlg();
})();
