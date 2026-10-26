# HTTP-API des Remotion-Renderers

## 1. Endpunkt

```text
POST http://localhost:3000/video
Content-Type: multipart/form-data
```

Der Endpunkt nimmt alle Medien eines Videos in einem Request entgegen und gibt
nach abgeschlossenem Rendering direkt die MP4-Datei zurück.

## 2. Request-Felder

| Feld | Typ | Erforderlich | Begrenzung | Inhalt |
| --- | --- | ---: | --- | --- |
| `voice_over` | Datei | ja | eine Datei | gesprochenes Skript, üblicherweise als MP3 |
| `transcription` | Datei | ja | eine Datei | ElevenLabs-Transkript als JSON |
| `images` | Datei | ja | 1 bis 30 Dateien | Hintergrundbilder des Videos |
| `background_music` | Datei | ja | eine Datei | Musik für den Hintergrund |
| `keepFiles` | Textfeld | nein | `true` oder `1` | temporäre Dateien nach dem Request behalten |

`keepFiles` sollte nur bei der lokalen Fehlersuche verwendet werden.

## 3. Beispiel

```bash
curl \
  -F "voice_over=@voice.mp3" \
  -F "transcription=@transcript.json" \
  -F "images=@image-01.jpg" \
  -F "images=@image-02.jpg" \
  -F "background_music=@music.mp3" \
  http://localhost:3000/video \
  --output video.mp4
```

Mehrere Bilder werden als wiederholte Felder mit demselben Namen `images`
übertragen. Genau so stellt der n8n-Workflow den Multipart Request zusammen.

## 4. Erfolgreiche Antwort

```text
HTTP 200
Content-Type: video/mp4
Content-Disposition: attachment; filename="<voice-over-name>.mp4"
```

Der Response-Body enthält die Binärdaten des fertigen Videos. Zusätzlich setzt
die API folgende Diagnose-Header:

| Header | Bedeutung |
| --- | --- |
| `X-Voiceover-Audio-Path` | intern verwendeter Pfad des Voice-overs |
| `X-Transcript-Path` | intern verwendeter Pfad des Transkripts |
| `X-Image-Count` | Anzahl der verwendeten Bilder |
| `X-Background-Music-Path` | intern verwendeter Pfad der Musikdatei |

## 5. Fehlerantworten

### 5.1 Unvollständiger Request

Wenn mindestens ein Pflichtfeld fehlt, antwortet die API mit:

```text
HTTP 400 Bad Request
```

Die Textantwort nennt die benötigten Felder. Bereits hochgeladene Dateien
werden anschließend entfernt, sofern `keepFiles` nicht aktiviert wurde.

### 5.2 Renderfehler

Falls Remotion das Video nicht erstellen kann:

```json
{
  "message": "Video konnte nicht gerendert werden.",
  "error": "Beschreibung des Renderfehlers"
}
```

Der HTTP-Status ist `500 Internal Server Error`. Auch in diesem Fall bereinigt
die API die temporären Dateien standardmäßig.

## 6. Transkriptformat

Das Transkript verwendet das Alignment-Format von ElevenLabs:

```json
{
  "alignment": {
    "characters": ["H", "e", "l", "l", "o"],
    "character_start_times_seconds": [0, 0.05, 0.1, 0.15, 0.2],
    "character_end_times_seconds": [0.05, 0.1, 0.15, 0.2, 0.25]
  },
  "normalized_alignment": {
    "characters": ["H", "e", "l", "l", "o"],
    "character_start_times_seconds": [0, 0.05, 0.1, 0.15, 0.2],
    "character_end_times_seconds": [0.05, 0.1, 0.15, 0.2, 0.25]
  }
}
```

Die drei Arrays eines Alignments müssen dieselbe Reihenfolge und Länge haben.
Zeitwerte dürfen als Zahlen oder numerische Strings vorliegen. Wenn beide
Alignments enthalten sind, bevorzugt der Renderer `normalized_alignment`.

## 7. Verwendung durch n8n

Der Workflow konsolidiert Voice-over, Transkript, Bilder und Musik vor dem
Aufruf in einem Item. Der HTTP-Request-Node sendet die Dateien als
`multipart/form-data` an die interne Adresse des Renderers, beispielsweise:

```text
http://video-renderer:3000/video
```

Die MP4-Antwort wird von n8n als Binärdatei entgegengenommen und anschließend
in Google Drive gespeichert. Die genaue Einbindung ist in der
[n8n-Architekturdokumentation](../../n8n/docs/ARCHITEKTUR.md) beschrieben.
