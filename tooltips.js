/* [Grok-Bot] V2.01: Hovertexte (title) für alle Knöpfe und Schalter, auch dynamisch erzeugte.
   Knöpfe ohne lesbaren Text bekommen zusätzlich aria-label. Umschalter nennen den aktuellen Zustand. */
(function(){
  function txt(b){ return (b.textContent||"").replace(/\s+/g," ").trim(); }
  function onOff(b){ return /\ban\b/.test(txt(b))||b.getAttribute("aria-pressed")==="true"; }
  var BY_ID={
    btnPlay:function(b){ var a=document.getElementById("a"); return (a&&!a.paused)?"Pause":"Abspielen / Pause"; },
    btnSkipBack:"10 s zurück", btnSkipFwd:"10 s vor",
    btnResume:"An der gemerkten Stelle weiterhören",
    btnAutoStart:function(b){ return "AutoStart ist "+(onOff(b)?"an":"aus")+" – tippen zum Umschalten"; },
    btnNotes:"Notizen zum aktuellen Vortrag",
    btnVolNorm:function(b){ return "Lautstärke angleichen ist "+(onOff(b)?"an":"aus")+" – tippen zum Umschalten"; },
    btnDataSave:function(b){ return "Datensparen ist "+(onOff(b)?"an (40 kbit/s)":"aus (Original)")+" – tippen zum Umschalten"; },
    btnOffline:"Vorträge offline speichern oder löschen",
    btnSpeakSum:"Excerpt vorlesen / anhalten", btnCloseSum:"Schließen", btnCloseNotes:"Notizen schließen",
    notesBold:"Fett", notesItalic:"Kursiv", notesUl:"Aufzählung",
    notesBookmark:"Lesezeichen an dieser Stelle setzen (2,5 s früher)", notesClear:"Notiz löschen",
    notesBmPrev:"Zum vorherigen Lesezeichen", notesBmNext:"Zum nächsten Lesezeichen",
    notesHwPen:"Stift", notesHwEraser:"Radierer", notesHwClear:"Handschrift leeren", notesHwSave:"Handschrift speichern",
    offClose:"Schließen", offDel:"Alle abhaken: Downloads abbrechen und alle Offline-Kopien löschen",
    offAll:"Alle anhaken: alle Vorträge offline speichern",
    btnAuto:"AutoStart"
  };
  var BY_CLICK={"prev()":"Vorheriger Vortrag","next()":"Nächster Vortrag","showSum()":"Excerpt (Begleittext) anzeigen","hideSum()":"Schließen","hideNotes()":"Schließen","toggle()":"Abspielen / Pause"};
  function titleFor(b){
    var r=BY_ID[b.id]; if(r) return typeof r==="function"?r(b):r;
    var oc=b.getAttribute("onclick"); if(oc&&BY_CLICK[oc]) return BY_CLICK[oc];
    var t=txt(b);
    if(b.closest("#list")) return "Vortrag abspielen: "+t.replace(/\s*·.*$/,"").slice(0,80);
    if(b.closest("#offDlg")){ if(t==="Speichern") return "Vortrag offline speichern"; if(t==="Löschen") return "Offline-Kopie dieses Vortrags löschen"; }
    if(b.classList.contains("bm-mark")) return "Zum Lesezeichen springen";
    if(/^Schließen$/.test(t)) return "Schließen";
    if(/^(Löschen|×|✕|x)$/i.test(t)) return "Löschen";
    return b.getAttribute("aria-label")||t||"Knopf";
  }
  function apply(root){
    (root||document).querySelectorAll("button,select,input[type=number],input[type=search]").forEach(function(b){
      var t;
      if(b.tagName==="BUTTON") t=titleFor(b);
      else if(b.id==="speed") t="Abspielgeschwindigkeit";
      else if(b.id==="voicePick") t="Sprecher für Vorlesen";
      else if(b.id==="nr") t="Vortragsnummer eingeben, Enter spielt ab";
      else if(b.id==="q") t="Suche nach #Hashtag oder Wort";
      else return;
      if(b.title!==t) b.title=t;
      var vis=b.tagName==="BUTTON"?txt(b):"x";
      if(!/[A-Za-zÄÖÜäöü0-9]{2,}/.test(vis)&&b.getAttribute("aria-label")!==t) b.setAttribute("aria-label",t);
    });
  }
  var pend=0;
  function later(){ if(pend) return; pend=requestAnimationFrame(function(){ pend=0; apply(); }); }
  function init(){
    apply();
    new MutationObserver(later).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["aria-pressed","class","disabled"]});
    var a=document.getElementById("a"); if(a){ a.addEventListener("play",later); a.addEventListener("pause",later); a.title="Audio"; }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
