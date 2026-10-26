# Import und Konfiguration

Die Workflow-Dateien sind für eine sichere Veröffentlichung bereinigt. Nach dem
Import müssen Ressourcen und Credentials in der eigenen n8n-Instanz erneut
zugeordnet werden.

## 1. Workflows importieren

Die empfohlene Reihenfolge ist:

1. `04-download-assets.json`
2. `03-generate-video-subworkflow.json`
3. `01-process-book-after-upload.json`
4. `02-generate-video-schedule.json`

Nach dem Import müssen die beiden Execute-Workflow Nodes erneut mit den
importierten Subworkflows verknüpft werden. Die Exporte enthalten dafür den
Platzhalter `REPLACE_WITH_N8N_WORKFLOW_ID`.

## 2. Credentials zuordnen

Folgende Verbindungen werden benötigt:

| Dienst | Verwendung |
| --- | --- |
| Google Drive OAuth2 | Trigger, Suche, Download, Verschieben, Löschen und Erstellen von Dateien |
| Google Sheets OAuth2 | Lesen und Aktualisieren des Upload-Zählers |
| OpenAI | Skripterstellung und Reviewer-Modell |
| Telegram Bot | Freigabe des generierten Skripts |
| ElevenLabs | Sprachsynthese mit Timestamps |

## 3. Ressourcen ersetzen

In den Nodes müssen alle Werte mit dem Präfix `REPLACE_WITH_` ersetzt werden:

- Google-Drive-Ordner für Rohbücher, generierte Skripte, Bilder, Musik und
  abgeschlossene Ergebnisse
- Google-Sheet-ID für den Upload-Tracker
- IDs der importierten Subworkflows
- Telegram-Chat-ID
- ElevenLabs-Voice-ID

Das Google Sheet benötigt in Zeile 2 eine Spalte `Uploads` mit einem numerischen
Startwert von `0`.

## 4. Video-API konfigurieren

Der Portfolio-Export verwendet als neutrale interne Adresse:

```text
http://video-renderer:3000/video
```

Die Adresse muss an die eigene Docker- oder VPS-Umgebung angepasst werden. Der
Endpunkt erwartet einen Multipart Request mit `voice_over`, `transcription`,
`background_music` und sechs Feldern namens `images`.

## 5. Zeitzone und Aktivierung

Der Scheduler startet um 17 Uhr in der Zeitzone der n8n-Instanz. Vor der
Aktivierung sollten deshalb Zeitzone, Zielordner, API-Adresse und Tageszähler
geprüft werden.

Die Workflows erst aktivieren, wenn alle Nodes ohne Warnsymbol konfiguriert sind
und ein vollständiger Testlauf mit nicht sensiblen Beispieldaten erfolgreich
war.

