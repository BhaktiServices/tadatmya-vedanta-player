/* [Grok-Bot] V1.94: Notizen pro Vortrag (Text, Lesezeichen, Handschrift; ohne Ton). Lokal im Browser (localStorage + IndexedDB), kein Cloud */
(function () {
  "use strict";

  var LS_KEY = "tv-notes-meta-v1";
  var IDB_NAME = "tv-notes-media-v1";
  var IDB_STORE = "blobs";
  var VERSION_LABEL = "V1.94";
  var BM_REWIND = 2.5;
  var BM_ACTIVE_EPS = 1.5;
  var PAD_BASE_H = 300;
  var PAD_EXTEND = 160;

  var currentFile = "";
  var saveTimer = 0;
  var dbPromise = null;

  /* handwriting state */
  var hwTool = "pen";
  var hwDrawing = false;
  var hwLast = null;
  var hwDirty = false;
  var hwCssW = 0;
  var hwCssH = PAD_BASE_H;
  var hwDpr = 1;

  function $(id) { return document.getElementById(id); }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function roundTime(t) {
    t = Number(t) || 0;
    if (!isFinite(t) || t < 0) t = 0;
    return Math.round(t * 10) / 10;
  }

  function loadMeta() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    } catch (e) {}
    return {};
  }

  function saveMeta(all) {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }

  function normalizeMediaList(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (x) {
      if (!x) return null;
      if (typeof x === "string") return { id: x, t: null };
      if (typeof x === "object" && x.id) return { id: x.id, t: x.t == null ? null : roundTime(x.t) };
      return null;
    }).filter(Boolean);
  }

  function getNote(file) {
    var all = loadMeta();
    var n = all[file];
    if (!n || typeof n !== "object") {
      return { html: "", bookmarks: [], drawings: [], recordings: [] };
    }
    return {
      html: n.html || "",
      bookmarks: Array.isArray(n.bookmarks) ? n.bookmarks : [],
      drawings: normalizeMediaList(n.drawings || []),
      recordings: normalizeMediaList(n.recordings || [])
    };
  }

  function putNote(file, note) {
    if (!file) return;
    var all = loadMeta();
    var empty = !(note.html && note.html.replace(/<[^>]*>/g, "").trim()) &&
      !(note.bookmarks && note.bookmarks.length) &&
      !(note.drawings && note.drawings.length) &&
      !(note.recordings && note.recordings.length);
    if (empty) delete all[file];
    else {
      all[file] = {
        html: note.html || "",
        bookmarks: note.bookmarks || [],
        drawings: note.drawings || [],
        recordings: note.recordings || []
      };
    }
    saveMeta(all);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB nicht verfügbar"));
        return;
      }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IDB open failed")); };
    });
    return dbPromise;
  }

  function idbPut(rec) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(rec);
        tx.oncomplete = function () { resolve(rec.id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readonly");
        var req = tx.objectStore(IDB_STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbDel(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function uid(prefix) {
    return (prefix || "m") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function resolveLecture() {
    var L = null;
    try {
      if (typeof i === "number" && i >= 0 && typeof sichtbar !== "undefined" && sichtbar[i]) {
        L = sichtbar[i];
      }
    } catch (e) {}
    if (!L) {
      try {
        var st = typeof loadState === "function" ? loadState() : null;
        if (st && st.file && typeof LESUNGEN !== "undefined") {
          L = LESUNGEN.find(function (x) { return x.file === st.file; }) || null;
        }
      } catch (e2) {}
    }
    if (!L && typeof sichtbar !== "undefined" && sichtbar.length) L = sichtbar[0];
    if (!L && typeof LESUNGEN !== "undefined" && LESUNGEN.length) L = LESUNGEN[0];
    return L;
  }

  function labelOfSafe(L) {
    if (typeof labelOf === "function") return labelOf(L);
    return (L.nr ? "#" + L.nr + "  " : "") + (L.titel || L.file || "");
  }

  function getAudio() {
    return document.getElementById("a");
  }

  function currentPlaybackFile() {
    try {
      if (typeof i === "number" && i >= 0 && typeof sichtbar !== "undefined" && sichtbar[i]) {
        return sichtbar[i].file || "";
      }
    } catch (e) {}
    return currentFile || "";
  }

  function seekTo(t) {
    var audio = getAudio();
    if (!audio) return;
    var dest = Math.max(0, Number(t) || 0);
    if (typeof applySeek === "function") applySeek(dest);
    else {
      try { audio.currentTime = dest; } catch (e) {}
    }
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
    highlightActiveBookmark(dest);
    updateScrubberMarkers();
  }

  function setStatus(msg) {
    var el = $("notesStatus");
    if (el) el.textContent = msg || "";
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      persistEditor();
    }, 400);
  }

  function persistEditor() {
    if (!currentFile) return;
    var ed = $("notesEditor");
    if (!ed) return;
    var note = getNote(currentFile);
    note.html = ed.innerHTML;
    putNote(currentFile, note);
    setStatus("Gespeichert · lokal");
  }

  function execCmd(cmd, val) {
    try { document.execCommand(cmd, false, val || null); } catch (e) {}
    var ed = $("notesEditor");
    if (ed) ed.focus();
    scheduleSave();
  }

  function sortedBookmarks(note) {
    return (note.bookmarks || []).slice().sort(function (a, b) {
      return (a.t || 0) - (b.t || 0);
    });
  }

  function activeBmIndex(sorted, t) {
    var best = -1;
    var bestDist = BM_ACTIVE_EPS + 0.01;
    for (var i = 0; i < sorted.length; i++) {
      var d = Math.abs((sorted[i].t || 0) - t);
      if (d <= BM_ACTIVE_EPS && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function highlightActiveBookmark(tOpt) {
    var audio = getAudio();
    var t = tOpt != null ? tOpt : (audio && isFinite(audio.currentTime) ? audio.currentTime : 0);
    var file = currentPlaybackFile() || currentFile;
    if (!file) return;
    var sorted = sortedBookmarks(getNote(file));
    var active = activeBmIndex(sorted, t);
    var box = $("notesBookmarks");
    if (box) {
      var rows = box.querySelectorAll(".notes-bm");
      for (var r = 0; r < rows.length; r++) {
        rows[r].classList.toggle("active", r === active);
      }
    }
    var track = $("bmTrack");
    if (track) {
      var marks = track.querySelectorAll(".bm-mark");
      for (var m = 0; m < marks.length; m++) {
        var mt = parseFloat(marks[m].getAttribute("data-t") || "0");
        marks[m].classList.toggle("active", Math.abs(mt - t) <= BM_ACTIVE_EPS);
      }
    }
    updateBmNav(sorted, active);
  }

  function updateBmNav(sorted, active) {
    var prev = $("notesBmPrev");
    var next = $("notesBmNext");
    if (!sorted) {
      var file = currentFile || currentPlaybackFile();
      sorted = file ? sortedBookmarks(getNote(file)) : [];
      var audio = getAudio();
      var t = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
      active = activeBmIndex(sorted, t);
    }
    if (prev) {
      prev.disabled = !sorted.length || active <= 0 && !(active < 0 && sorted.length);
      if (active < 0) prev.disabled = !sorted.length;
      /* Prev: jump to previous relative to current time if none active */
      if (active < 0) {
        var audio2 = getAudio();
        var cur = audio2 && isFinite(audio2.currentTime) ? audio2.currentTime : 0;
        var hasPrev = sorted.some(function (bm) { return (bm.t || 0) < cur - 0.05; });
        prev.disabled = !hasPrev;
      } else {
        prev.disabled = active <= 0;
      }
    }
    if (next) {
      if (active < 0) {
        var audio3 = getAudio();
        var cur3 = audio3 && isFinite(audio3.currentTime) ? audio3.currentTime : 0;
        var hasNext = sorted.some(function (bm) { return (bm.t || 0) > cur3 + 0.05; });
        next.disabled = !hasNext;
      } else {
        next.disabled = active >= sorted.length - 1;
      }
    }
  }

  function jumpBm(dir) {
    var file = currentFile || currentPlaybackFile();
    if (!file) return;
    var sorted = sortedBookmarks(getNote(file));
    if (!sorted.length) return;
    var audio = getAudio();
    var cur = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
    var active = activeBmIndex(sorted, cur);
    var idx;
    if (dir < 0) {
      if (active > 0) idx = active - 1;
      else if (active === 0) return;
      else {
        idx = -1;
        for (var i = sorted.length - 1; i >= 0; i--) {
          if ((sorted[i].t || 0) < cur - 0.05) { idx = i; break; }
        }
        if (idx < 0) return;
      }
    } else {
      if (active >= 0 && active < sorted.length - 1) idx = active + 1;
      else if (active === sorted.length - 1) return;
      else {
        idx = -1;
        for (var j = 0; j < sorted.length; j++) {
          if ((sorted[j].t || 0) > cur + 0.05) { idx = j; break; }
        }
        if (idx < 0) return;
      }
    }
    seekTo(sorted[idx].t);
  }

  function renderBookmarks(note) {
    var box = $("notesBookmarks");
    if (!box) return;
    box.innerHTML = "";
    var sorted = sortedBookmarks(note);
    if (!sorted.length) {
      box.innerHTML = "<p class=\"notes-empty\">Noch keine Lesezeichen.</p>";
      updateBmNav([], -1);
      updateScrubberMarkers();
      return;
    }
    sorted.forEach(function (bm) {
      var row = document.createElement("div");
      row.className = "notes-bm";
      row.setAttribute("data-id", bm.id || "");
      row.setAttribute("data-t", String(bm.t || 0));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "notes-bm-go gold";
      btn.textContent = "▶ " + fmtTime(bm.t) + (bm.label ? " · " + bm.label : "");
      btn.title = "Zur Stelle springen und abspielen";
      btn.addEventListener("click", function () { seekTo(bm.t); });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "notes-bm-del";
      del.textContent = "×";
      del.title = "Lesezeichen löschen";
      del.addEventListener("click", function () {
        var n = getNote(currentFile);
        if (bm.id) {
          n.bookmarks = n.bookmarks.filter(function (x) { return x.id !== bm.id; });
        } else {
          n.bookmarks = n.bookmarks.filter(function (x) {
            return Math.abs((x.t || 0) - (bm.t || 0)) >= 0.05;
          });
        }
        putNote(currentFile, n);
        renderBookmarks(n);
        updateScrubberMarkers();
        setStatus("Lesezeichen entfernt");
      });
      row.appendChild(btn);
      row.appendChild(del);
      box.appendChild(row);
    });
    highlightActiveBookmark();
    updateScrubberMarkers();
  }

  function mediaTimeLabel(t) {
    if (t == null || !isFinite(t)) return "";
    return "▶ " + fmtTime(t);
  }

  function renderMedia(note) {
    var drawBox = $("notesDrawings");

    if (drawBox) {
      drawBox.innerHTML = "";
      if (!note.drawings.length) {
        drawBox.innerHTML = "<p class=\"notes-empty\">Keine Handschriften.</p>";
      } else {
        note.drawings.forEach(function (item) {
          var wrap = document.createElement("div");
          wrap.className = "notes-media-item";
          if (item.t != null) {
            var jump = document.createElement("button");
            jump.type = "button";
            jump.className = "notes-media-t gold";
            jump.textContent = mediaTimeLabel(item.t);
            jump.title = "Zur Stelle springen";
            jump.addEventListener("click", function () { seekTo(item.t); });
            wrap.appendChild(jump);
          }
          var img = document.createElement("img");
          img.alt = "Handschrift";
          img.className = "notes-draw-thumb";
          wrap.appendChild(img);
          var del = document.createElement("button");
          del.type = "button";
          del.textContent = "Zeichnung löschen";
          del.addEventListener("click", function () { removeMedia(item.id, "drawings"); });
          wrap.appendChild(del);
          drawBox.appendChild(wrap);
          idbGet(item.id).then(function (rec) {
            if (!rec) return;
            if (rec.blob) img.src = URL.createObjectURL(rec.blob);
            else if (rec.dataURL) img.src = rec.dataURL;
          }).catch(function () {});
        });
      }
    }

  }

  function removeMedia(id, kind) {
    if (!currentFile) return;
    var n = getNote(currentFile);
    n[kind] = (n[kind] || []).filter(function (x) { return x.id !== id; });
    putNote(currentFile, n);
    idbDel(id).catch(function () {});
    renderMedia(n);
    setStatus("Medium gelöscht");
  }

  /* ——— Handwriting pad ——— */
  function hwCanvas() { return $("notesHwCanvas"); }
  function hwScroll() { return $("notesHwScroll"); }

  function hwCtx() {
    var c = hwCanvas();
    return c ? c.getContext("2d") : null;
  }

  function setHwTool(tool) {
    hwTool = tool === "eraser" ? "eraser" : "pen";
    var pen = $("notesHwPen");
    var ers = $("notesHwEraser");
    if (pen) pen.classList.toggle("gold", hwTool === "pen");
    if (ers) ers.classList.toggle("gold", hwTool === "eraser");
  }

  function resizeHwCanvas(keepContent) {
    var c = hwCanvas();
    var sc = hwScroll();
    if (!c || !sc) return;
    var w = Math.max(200, Math.floor(sc.clientWidth || sc.offsetWidth || 300));
    var h = Math.max(PAD_BASE_H, hwCssH || PAD_BASE_H);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var prev = null;
    if (keepContent && c.width > 0 && c.height > 0) {
      try {
        prev = document.createElement("canvas");
        prev.width = c.width;
        prev.height = c.height;
        prev.getContext("2d").drawImage(c, 0, 0);
      } catch (e) { prev = null; }
    }
    hwCssW = w;
    hwCssH = h;
    hwDpr = dpr;
    c.style.width = w + "px";
    c.style.height = h + "px";
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    var ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, c.width, c.height);
    if (prev) {
      ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, c.width, c.height);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function clearHwPad() {
    hwCssH = PAD_BASE_H;
    resizeHwCanvas(false);
    hwDirty = false;
    setStatus("Pad geleert");
  }

  function ensureHwReady() {
    var c = hwCanvas();
    if (!c) return;
    if (!c.width || !hwCssW) {
      hwCssH = PAD_BASE_H;
      resizeHwCanvas(false);
    }
  }

  function pointerPos(ev) {
    var c = hwCanvas();
    if (!c) return null;
    var rect = c.getBoundingClientRect();
    var src = ev.touches && ev.touches[0] ? ev.touches[0] :
      (ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev);
    return {
      x: (src.clientX - rect.left) * (c.width / rect.width) / hwDpr,
      y: (src.clientY - rect.top) * (c.height / rect.height) / hwDpr
    };
  }

  function maybeExtendPad(y) {
    if (y < hwCssH - 48) return;
    var sc = hwScroll();
    var oldH = hwCssH;
    hwCssH = oldH + PAD_EXTEND;
    resizeHwCanvas(true);
    if (sc) sc.scrollTop = sc.scrollHeight;
    hwDirty = true;
  }

  function strokeTo(p) {
    var ctx = hwCtx();
    if (!ctx || !hwLast || !p) return;
    ctx.globalCompositeOperation = "source-over";
    if (hwTool === "eraser") {
      ctx.strokeStyle = "#1a1410";
      ctx.lineWidth = 18;
    } else {
      ctx.strokeStyle = "#f3e6d0";
      ctx.lineWidth = 2.4;
    }
    ctx.beginPath();
    ctx.moveTo(hwLast.x, hwLast.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hwLast = p;
    hwDirty = true;
    maybeExtendPad(p.y);
  }

  function onHwStart(ev) {
    ensureHwReady();
    var p = pointerPos(ev);
    if (!p) return;
    hwDrawing = true;
    hwLast = p;
    if (ev.pointerType !== "mouse" || ev.buttons) {
      try { hwCanvas().setPointerCapture(ev.pointerId); } catch (e) {}
    }
    if (ev.cancelable) ev.preventDefault();
  }

  function onHwMove(ev) {
    if (!hwDrawing) return;
    var p = pointerPos(ev);
    strokeTo(p);
    if (ev.cancelable) ev.preventDefault();
  }

  function onHwEnd(ev) {
    if (!hwDrawing) return;
    hwDrawing = false;
    hwLast = null;
    if (ev && ev.cancelable) ev.preventDefault();
  }

  function saveHwDrawing() {
    if (!currentFile) return;
    var c = hwCanvas();
    if (!c || !c.width) {
      setStatus("Nichts zu speichern");
      return;
    }
    if (!hwDirty) {
      setStatus("Keine neue Zeichnung");
      return;
    }
    var audio = getAudio();
    var t = audio && isFinite(audio.currentTime) ? roundTime(audio.currentTime) : null;
    setStatus("Zeichnung speichern …");
    c.toBlob(function (blob) {
      if (!blob) {
        setStatus("Speichern fehlgeschlagen");
        return;
      }
      var id = uid("draw");
      idbPut({
        id: id,
        file: currentFile,
        type: "image/png",
        blob: blob,
        kind: "drawing",
        t: t,
        ts: Date.now()
      }).then(function () {
        var n = getNote(currentFile);
        n.drawings.push({ id: id, t: t });
        putNote(currentFile, n);
        renderMedia(n);
        hwDirty = false;
        setStatus("Handschrift gespeichert" + (t != null ? " · " + fmtTime(t) : ""));
      }).catch(function (err) {
        setStatus("Zeichnung speichern fehlgeschlagen");
        console.warn(err);
      });
    }, "image/png");
  }

  function bindHw() {
    var c = hwCanvas();
    if (!c || c.__tvHwBound) return;
    c.__tvHwBound = 1;
    c.addEventListener("pointerdown", onHwStart);
    c.addEventListener("pointermove", onHwMove);
    c.addEventListener("pointerup", onHwEnd);
    c.addEventListener("pointercancel", onHwEnd);
    c.addEventListener("pointerleave", function (ev) {
      if (hwDrawing) onHwEnd(ev);
    });
    /* prevent page scroll while drawing on touch */
    c.style.touchAction = "none";

    var pen = $("notesHwPen");
    var ers = $("notesHwEraser");
    var clr = $("notesHwClear");
    var sav = $("notesHwSave");
    if (pen) pen.addEventListener("click", function (e) { e.preventDefault(); setHwTool("pen");
      /* [Grok-Bot] V2.02: Stift holt das Pad ganz in den sichtbaren Bereich (vorher oft verdeckt/abgeschnitten) */
      var sc2 = hwScroll(), bd = sc2 && sc2.closest(".dlgbody");
      if (bd) { var d = sc2.getBoundingClientRect().bottom - bd.getBoundingClientRect().bottom; if (d > 0) bd.scrollTop += d + 4; }
      ensureHwReady(); setStatus("Stift aktiv – im Feld unten schreiben"); });
    if (ers) ers.addEventListener("click", function (e) { e.preventDefault(); setHwTool("eraser"); });
    if (clr) clr.addEventListener("click", function (e) { e.preventDefault(); clearHwPad(); });
    if (sav) sav.addEventListener("click", function (e) { e.preventDefault(); saveHwDrawing(); });
    setHwTool("pen");
  }

  /* ——— Scrubber markers ——— */
  function updateScrubberMarkers() {
    var track = $("bmTrack");
    if (!track) return;
    var file = currentPlaybackFile();
    var audio = getAudio();
    var dur = audio && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    track.innerHTML = "";
    if (!file || !dur) {
      track.style.display = "none";
      return;
    }
    var note = getNote(file);
    var sorted = sortedBookmarks(note);
    if (!sorted.length) {
      track.style.display = "none";
      return;
    }
    track.style.display = "block";
    var cur = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
    sorted.forEach(function (bm) {
      var pct = Math.max(0, Math.min(100, ((bm.t || 0) / dur) * 100));
      var mark = document.createElement("button");
      mark.type = "button";
      mark.className = "bm-mark";
      mark.setAttribute("data-t", String(bm.t || 0));
      mark.style.left = pct + "%";
      mark.title = "▶ " + fmtTime(bm.t) + (bm.label ? " · " + bm.label : "");
      mark.setAttribute("aria-label", mark.title);
      if (Math.abs((bm.t || 0) - cur) <= BM_ACTIVE_EPS) mark.classList.add("active");
      mark.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        seekTo(bm.t);
      });
      track.appendChild(mark);
    });
  }

  function loadPanel(L) {
    currentFile = L.file;
    var title = $("notesTitle");
    if (title) title.textContent = "Notizen · " + labelOfSafe(L);
    var note = getNote(currentFile);
    var ed = $("notesEditor");
    if (ed) {
      ed.innerHTML = note.html || "";
      if (!ed.innerHTML.trim()) ed.innerHTML = "";
    }
    renderBookmarks(note);
    renderMedia(note);
    setStatus("Lokal · " + VERSION_LABEL);
    setHwTool("pen");
    hwDirty = false;
    requestAnimationFrame(function () {
      hwCssH = PAD_BASE_H;
      resizeHwCanvas(false);
    });
  }

  function openNotes() {
    var L = resolveLecture();
    if (!L) {
      var err = $("err");
      if (err) err.textContent = "Keine Lesung gewählt.";
      return;
    }
    window.__tvModal = true;
    loadPanel(L);
    var dlg = $("notesDlg");
    if (dlg) dlg.classList.add("on");
  }

  function hideNotes() {
    persistEditor();
    window.__tvModal = false;
    window.__tvGuardUntil = Date.now() + 350;
    var dlg = $("notesDlg");
    if (dlg) dlg.classList.remove("on");
  }

  function addBookmark() {
    if (!currentFile) return;
    var audio = getAudio();
    var raw = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
    var t = roundTime(Math.max(0, raw - BM_REWIND));
    var label = "";
    try {
      label = window.prompt("Kurzlabel (optional):", "") || "";
    } catch (e) { label = ""; }
    var n = getNote(currentFile);
    n.bookmarks.push({ id: uid("bm"), t: t, label: String(label).trim().slice(0, 80) });
    putNote(currentFile, n);
    renderBookmarks(n);
    updateScrubberMarkers();
    setStatus("Lesezeichen bei " + fmtTime(t) + " (−" + BM_REWIND + "s)");
  }


  function clearNote() {
    if (!currentFile) return;
    if (!window.confirm("Alle Notizen zu diesem Vortrag löschen?")) return;
    var n = getNote(currentFile);
    var ids = (n.drawings || []).map(function (x) { return x.id; })
      .concat((n.recordings || []).map(function (x) { return x.id; }));
    /* also purge legacy image ids if any remain in storage */
    try {
      var all = loadMeta();
      var raw = all[currentFile];
      if (raw && Array.isArray(raw.images)) {
        raw.images.forEach(function (id) {
          if (typeof id === "string") ids.push(id);
          else if (id && id.id) ids.push(id.id);
        });
      }
    } catch (e) {}
    ids.forEach(function (id) { idbDel(id).catch(function () {}); });
    putNote(currentFile, { html: "", bookmarks: [], drawings: [], recordings: [] });
    var ed = $("notesEditor");
    if (ed) ed.innerHTML = "";
    clearHwPad();
    renderBookmarks(getNote(currentFile));
    renderMedia(getNote(currentFile));
    updateScrubberMarkers();
    setStatus("Notiz gelöscht");
  }

  function bindUi() {
    var dlg = $("notesDlg");
    if (!dlg || dlg.__tvNotesBound) return;
    dlg.__tvNotesBound = 1;

    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { hideNotes(); return; }
      if (e.target.closest("#btnCloseNotes, .btnCloseTop")) hideNotes();
    });

    var ed = $("notesEditor");
    if (ed) {
      ed.addEventListener("input", scheduleSave);
      ed.addEventListener("blur", persistEditor);
    }

    [["notesBold", "bold"], ["notesItalic", "italic"], ["notesUl", "insertUnorderedList"]].forEach(function (pair) {
      var b = $(pair[0]);
      if (b) b.addEventListener("click", function (e) {
        e.preventDefault();
        execCmd(pair[1]);
      });
    });

    var bm = $("notesBookmark");
    if (bm) bm.addEventListener("click", function (e) { e.preventDefault(); addBookmark(); });

    var prev = $("notesBmPrev");
    var next = $("notesBmNext");
    if (prev) prev.addEventListener("click", function (e) { e.preventDefault(); jumpBm(-1); });
    if (next) next.addEventListener("click", function (e) { e.preventDefault(); jumpBm(1); });

    var clr = $("notesClear");
    if (clr) clr.addEventListener("click", function (e) { e.preventDefault(); clearNote(); });

    bindHw();

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "Esc") {
        if (dlg.classList.contains("on")) hideNotes();
      }
    });

    var audio = getAudio();
    if (audio && !audio.__tvBmBound) {
      audio.__tvBmBound = 1;
      audio.addEventListener("timeupdate", function () {
        highlightActiveBookmark();
      });
      audio.addEventListener("loadedmetadata", updateScrubberMarkers);
      audio.addEventListener("durationchange", updateScrubberMarkers);
      audio.addEventListener("play", updateScrubberMarkers);
    }

    window.addEventListener("resize", function () {
      if ($("notesDlg") && $("notesDlg").classList.contains("on")) {
        resizeHwCanvas(true);
      }
      updateScrubberMarkers();
    });

    updateScrubberMarkers();
  }

  window.openNotes = openNotes;
  window.hideNotes = hideNotes;
  window.__tvUpdateBmMarkers = updateScrubberMarkers;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }
})();
