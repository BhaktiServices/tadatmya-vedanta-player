/* [Grok-Bot] V2.14: YouTube-Link je Vortrag (Liste und laufender Titel).
   IDs aus TV_THUMBS (Nummer, inkl. @yt in katalog.txt) und TV_THUMBS_FILE (Dateiname/Titel).
   Nur Einträge mit bekannter ID bekommen einen Button. Klick öffnet das Original in einem neuen Tab
   und startet nicht die Wiedergabe (Link liegt außerhalb der Listen-Taste, plus stopPropagation). */
(function(){
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
  function ytUrl(id){ return "https://www.youtube.com/watch?v="+id; }
  function makeLink(id, L){
    const a=document.createElement("a");
    a.className="yt-link";
    a.href=ytUrl(id);
    a.target="_blank";
    a.rel="noopener";
    const label="Original auf YouTube ansehen"+(L && typeof labelOf==="function"?" · "+labelOf(L):"");
    a.title=label;
    a.setAttribute("aria-label",label);
    a.innerHTML='<span class="yt-ico" aria-hidden="true"></span><span class="yt-txt">YouTube</span>';
    function stop(e){ e.stopPropagation(); }
    a.addEventListener("click", stop);
    a.addEventListener("pointerdown", stop);
    a.addEventListener("pointerup", stop);
    return a;
  }
  function decorateList(){
    const box=document.getElementById("list");
    if(!box || typeof sichtbar==="undefined") return;
    const items=box.querySelectorAll("button.item");
    for(let n=0;n<items.length;n++){
      const d=items[n];
      const idx=parseInt(d.getAttribute("data-idx"),10);
      if(!isFinite(idx) || !sichtbar[idx]) continue;
      const L=sichtbar[idx];
      const id=ytId(L);
      let wrap=d.parentNode;
      if(!wrap || !wrap.classList || !wrap.classList.contains("item-wrap")){
        wrap=document.createElement("div");
        wrap.className="item-wrap";
        d.parentNode.insertBefore(wrap, d);
        wrap.appendChild(d);
      }
      let a=wrap.querySelector("a.yt-link");
      if(!id){
        if(a) a.remove();
        wrap.classList.remove("has-yt");
        continue;
      }
      wrap.classList.add("has-yt");
      if(!a){
        a=makeLink(id, L);
        wrap.appendChild(a);
      }else{
        a.href=ytUrl(id);
        const label="Original auf YouTube ansehen"+(typeof labelOf==="function"?" · "+labelOf(L):"");
        a.title=label;
        a.setAttribute("aria-label",label);
      }
    }
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
    const id=ytId(L);
    if(id) el.appendChild(makeLink(id, L));
  }
  window.tvYtId=ytId;
  const origZeichne=window.zeichne;
  if(typeof origZeichne==="function"){
    window.zeichne=function(){
      const ret=origZeichne.apply(this, arguments);
      try{ decorateList(); }catch(e){}
      return ret;
    };
  }
  const origPlay=window.play;
  if(typeof origPlay==="function"){
    window.play=function(idx){
      const ret=origPlay.apply(this, arguments);
      try{
        const L=(typeof sichtbar!=="undefined" && typeof i==="number" && i>=0)?sichtbar[i]:null;
        if(L) setNowLink(L);
      }catch(e){}
      return ret;
    };
  }
  try{ decorateList(); }catch(e){}
})();
