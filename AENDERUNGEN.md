# Änderungen und Kennzeichnung

Am Player arbeiten zwei KI-Helfer: **Grok.com** und **Grok-Bot** (Stabschef).
Damit beide die Arbeit des anderen erkennen, gilt ab V1.87:

- Jede Änderung im Code bekommt einen Kommentar mit Kennung und Version, z. B.
  `/* [Grok-Bot] V1.87: … */` oder `/* [Grok.com] V1.88: … */`
  (in .txt/.md: `# [Grok-Bot] V1.87: …`).
- Jede neue Version bekommt hier oben einen Eintrag mit Kennung.
- Commit-Nachrichten beginnen mit der Kennung, z. B. `[Grok-Bot] V1.87: …`.
- Vor einer Änderung zuerst den neuesten Stand von `main` holen, damit nichts überschrieben wird.
- Version immer an zwei Stellen hochzählen: `index.html` (Titel, Anzeige, `?v=`-Parameter der geänderten Skripte) und `sw.js` (Cache-Name).

## Wichtige Regeln im Code

- **Dropbox im Browser:** Dropbox blockiert Abrufe von Textdateien (katalog, zeitraum) aus anderen Webseiten (CORS). Nur die MP3-Wiedergabe funktioniert direkt aus Dropbox. Listen und Zeitraum stehen deshalb in `katalog.txt` hier im Repo.
- **Zeitraum:** Zeile `@zeitraum: TT.MM.JJJJ – TT.MM.JJJJ` in `katalog.txt`. Der Player liest sie bei jedem Aufruf neu (`katalog.js`). Ende = Datum der letzten Live-Aufnahme laut YouTube.
- **Titelbilder:** Beim Start eines Vortrags wird 4 Sekunden das YouTube-Titelbild gezeigt (`thumb-overlay.js`), der Ton läuft schon. Nummer und YouTube-ID stehen in `thumbs.js`; neue Vorträge bekommen eine Zeile `@yt: <Nr> <YouTube-ID>` in `katalog.txt`.
- **Statistik:** nur aus Tageswerten aufsummiert (`stats-daily.js`), keine eigenen Monats- oder Gesamtzähler.
- **Excerpts:** `texte/N.txt` = Überschrift, „geschrieben von …“, Leerzeile, Text (siehe `texte/README.txt`).

## Verlauf

- **V1.98 [Grok-Bot]** – Katalog-Pflege: Kapitel von #36 aus `texte/36.txt` abgeleitet, jetzt „Kap. 10.3“ (vorher vorläufig „10.2 ff.“), `lesungen.js`. In `katalog.txt` Zeitraum bis 04.10.2026 (Live-Aufnahme #37) und Titelbild `@yt: 37 ygzD2zrn4YE` vorab eingetragen; die MP3 von #37 liegt noch nicht in Dropbox.
- **V1.97 [Grok-Bot]** – Nur noch ein AutoStart-Schalter: Der ältere Schalter aus `feedback.js` (`#btnAuto`) ist per CSS in `index.html` ausgeblendet. Seine Logik (Start beim ersten Tippen, wenn der Browser Autoplay blockiert) liest weiter `tvp-autostart`; `auto-start.js` hält diesen Wert jetzt gleich mit dem sichtbaren Schalter.
- **V1.96 [Grok-Bot]** – AutoStart: Nach dem Hochscrollen des Buchbilds scrollt die Seite weich weiter, bis der aktuelle Vortrag in der Liste direkt unter dem Player steht (`auto-start.js`). Scrollt man selbst, unterbleibt das.
- **V1.95 [Grok-Bot]** – Wächter gegen Aussetzer mitten im Vortrag (neue Datei `watchdog.js`, nach `app.js` geladen): prüft alle 3 s; steht die Zeit 15 s still, obwohl der Ton laufen soll, wird die Quelle neu geladen und an derselben Stelle weitergespielt. Stoppt der Player unerwartet (nicht per Pause-Taste), wird alle 4 s neu gestartet statt nur einmal. Hat `app.js` nach 3 Fehlversuchen aufgegeben, versucht der Wächter es mit wachsendem Abstand (8–30 s) bis zu 12 Mal. Während „Vorlesen“ (Sprachausgabe aktiv) greift der Wächter nicht. Der Startablauf ist unverändert.
- **V1.94 [Grok-Bot]** – Notizen pro Vortrag: Button „Notizen“ neben Excerpt. Text (fett, kursiv, Liste), Lesezeichen „an dieser Stelle“ (2,5 s früher, mit Vorheriges/Nächstes und goldenen Marken unter dem Audio-Balken) und Handschrift-Pad (Stift, Radierer, Speichern mit Zeitstelle). Keine Tonaufnahme. Alles bleibt lokal im Browser des Geräts (localStorage + IndexedDB). Neue Datei `notes.js`, dazu `index.html` und `sw.js`.
- **V1.92 [Grok.com]** – Buchbild und Klappentext nebeneinander (Windows/Desktop). Das Bild ist nicht mehr halb so hoch wie der Bildschirm, sondern lässt rechts Platz für den Text. Beim Verkleinern des Fensters wird das Bild mitverkleinert (`cover-fx.js`, `index.html`). Auf dem Telefon bleibt das Bild oben, der Text darunter.
- **V1.91 [Grok-Bot]** – V1.90 zurückgenommen: Beim automatischen Start wurde die MP3 nicht geladen. `app.js` ist wieder auf dem Stand von V1.89 (Kommentar oben ergänzt).
- **V1.90 [Grok-Bot]** – Unterbrechung durch andere Apps (z. B. WhatsApp-Video): Der Player startet nicht mehr sofort wieder und kämpft nicht mehr um den Ton. Ist die Seite im Hintergrund (oder wurde innerhalb von 15 s schon einmal automatisch neu gestartet), bleibt er pausiert und merkt die Stelle. Beim Zurückkehren zum Player geht es 3 s früher weiter. `app.js` (Pause-Handler, visibilitychange).
- **V1.89 [Grok-Bot]** – Fehler aus V1.88 behoben: Die Titelbild-Einblendung lag 4 s über der ganzen Seite und fing alle Taps ab, dadurch ließ sich in dieser Zeit kein anderer Vortrag starten. Jetzt gehen Taps durch (`#thumbOv.on` mit `pointer-events:none` in `index.html`).
- **V1.88 [Grok-Bot]** – Titelbild bei jedem Start eines Vortrags 4 s statt 5 s (vorher nur einmal pro Sitzung); nicht erneut bei Stream-Reparatur desselben Vortrags innerhalb 10 Min. `@yt`-Zeilen in `katalog.txt` (#36 = wobhNn2LqiY), `thumbs.js` um #36 ergänzt.
- **V1.87 [Grok-Bot]** – Zeitraum kommt bei jedem Aufruf aus `katalog.txt` (neu: 13.12.2025 – 27.09.2026). Die alten Dropbox-Abrufe in `app.js` (zeitraum.txt, katalog.json/.txt) scheitern still und werden von `katalog.js` überstimmt; sie können bei der nächsten Änderung an `app.js` entfernt werden. Kapitel bei 26 Einträgen in `lesungen.js` nach den Abschnittsnummern der Texte korrigiert (#36 vorläufig „10.2 ff.“). Kennzeichnung eingeführt (diese Datei).
- **V1.86 [Grok-Bot]** – #36 ergänzt; `katalog.txt` + `katalog.js` (neue MP3s erscheinen automatisch); `KATALOG.md`.
- **V1.85 [Grok-Bot]** – Excerpts 1–35 auf Überschrift/Autor/Text umgestellt; `excerpt-format.js`, `excerpt-tts.js`.
- **V1.84 [Grok-Bot]** – `list-marks.js`: ✓ und Position, Zahl aktiver Hörer, „N× gehört“.
- **V1.66 [Grok-Bot]** – `stats-daily.js`: Statistik aus Tageswerten.
- Frühere Versionen: nicht gekennzeichnet.

Von Grok-Bot stammen außerdem: `katalog.js`, `stats-daily.js`, `list-marks.js`, `excerpt-format.js`, `excerpt-tts.js`, `KATALOG.md`, diese Datei.
