# Installation und Betrieb

## 1. Voraussetzungen

Für den lokalen Betrieb werden benötigt:

- Node.js 22 oder eine kompatible aktuelle Node.js-Version
- npm
- Chromium beziehungsweise der von Remotion verwaltete Browser
- ausreichend Arbeitsspeicher und freier Speicherplatz für das Rendering

## 2. Lokale Installation

Im Remotion-Unterordner die Abhängigkeiten und den Browser installieren:

```bash
cd remotion
npm ci
npx remotion browser ensure
```

Anschließend die API starten:

```bash
node src/api.js
```

Der Dienst lauscht aktuell fest auf Port `3000`:

```text
http://localhost:3000/video
```

Ein vollständiger Testrequest ist in [API.md](API.md) beschrieben.

## 3. Remotion Studio

Für die visuelle Entwicklung der Composition kann das Remotion Studio gestartet
werden:

```bash
npm run dev
```

Die produktiven Medien werden normalerweise über die API bereitgestellt. Für
eine Vorschau im Studio müssen deshalb passende Props und lokale Testdateien
verwendet werden.

## 4. Entwicklungsbefehle

| Befehl | Aufgabe |
| --- | --- |
| `npm run dev` | Remotion Studio für die visuelle Vorschau starten |
| `npm run build` | Browser-Bundle der Remotion-Anwendung erzeugen |
| `npm run render` | manuellen Render über die Remotion CLI starten |
| `npm run lint` | ESLint und TypeScript-Prüfung ausführen |

Zur Vermeidung großer Commits dürfen generierte Videos, Uploads und temporäre
Props nicht in Git aufgenommen werden.

## 5. Docker

Das Dockerfile verwendet Node.js 22, installiert die Chromium-Abhängigkeiten
und lädt den von Remotion benötigten Browser.

Image erstellen:

```bash
cd remotion
docker build -t tiktok-video-generator .
```

Container starten:

```bash
docker run --rm -p 3000:3000 tiktok-video-generator
```

Die API ist danach ebenfalls unter `http://localhost:3000/video` erreichbar.

## 6. Verbindung mit n8n

Wenn n8n und Renderer als Container laufen, sollten beide demselben
Docker-Netzwerk angehören. n8n kann die API dann über den Container- oder
Servicenamen ansprechen:

```text
http://video-renderer:3000/video
```

Im n8n-Workflow muss der HTTP-Request-Node diese Adresse verwenden und die
Felder `voice_over`, `transcription`, `images` und `background_music` als
Multipart-Daten übertragen.

## 7. Temporäre Verzeichnisse

Die API legt benötigte Verzeichnisse beim Start automatisch an:

| Pfad | Zweck |
| --- | --- |
| `public/uploads/` | hochgeladene Eingabedateien |
| `.render-props/` | Props für die Remotion CLI |
| System-Tempordner `tiktok-pipeline-renders/` | temporäre MP4-Ausgaben |

Standardmäßig werden die Dateien nach jedem Request entfernt. Bei der
Fehlersuche kann das Request-Feld `keepFiles=true` verwendet werden.

## 8. Hinweise für den produktiven Betrieb

Die aktuelle Implementierung ist für ein internes, nicht öffentlich
erreichbares Netzwerk gedacht. Vor einer öffentlichen Bereitstellung sollten
mindestens folgende Punkte ergänzt werden:

- Authentifizierung für den API-Endpunkt
- Reverse Proxy mit TLS
- Begrenzung von Request- und Dateigrößen
- Prüfung erlaubter MIME-Types
- Ressourcenlimits für den Container
- Warteschlange oder Parallelitätsbegrenzung
- Monitoring und Health Check

Außerdem sollten Schreibrechte für die temporären Verzeichnisse und ausreichend
Speicherplatz für parallele Uploads und Renderprozesse vorhanden sein.
