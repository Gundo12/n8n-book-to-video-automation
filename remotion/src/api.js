const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const multer = require("multer");
const os = require("os");
const path = require("path");
const app = express();
const port = 3000;
const projectRoot = path.join(__dirname, "..");
const uploadDir = path.join(projectRoot, "public", "uploads");
const propsDir = path.join(projectRoot, ".render-props");
const tempRenderDir = path.join(os.tmpdir(), "tiktok-pipeline-renders");
const remotionCli = path.join(
  projectRoot,
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(propsDir, { recursive: true });
fs.mkdirSync(tempRenderDir, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const createRequestId = () => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const log = (requestId, message, details) => {
  const prefix = `[${new Date().toISOString()}] [${requestId}] ${message}`;

  if (details === undefined) {
    console.log(prefix);
    return;
  }

  console.log(prefix, details);
};

const logError = (requestId, message, error) => {
  console.error(`[${new Date().toISOString()}] [${requestId}] ${message}`, {
    message: error?.message,
    stack: error?.stack,
  });
};

const describeFile = (file) => {
  if (!file) {
    return null;
  }

  return {
    field: file.fieldname,
    name: file.originalname,
    savedAs: file.filename,
    size: file.size,
  };
};

// Konfiguration: Wo soll die Datei gespeichert werden?
// Konfiguration für Speicherort und Dateiname
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Ordner, wo die Datei gespeichert wird
  },
  filename: function (req, file, cb) {
    // Hier definierst du den Dateinamen
    // Beispiel: Originalname + Timestamp, um Kollisionen zu vermeiden
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const toUploadPath = (file) => {
  return path.posix.join("uploads", file.filename);
};

const cleanupFiles = (files) => {
  for (const file of files) {
    if (!file) {
      continue;
    }

    fs.rm(file, { force: true }, () => undefined);
  }
};

const shouldKeepFiles = (value) => {
  return value === true || value === "true" || value === "1";
};

const renderVideo = ({
  requestId,
  voiceoverAudioPath,
  transcriptPath,
  outputPath,
  propsPath,
}) => {
  return new Promise((resolve, reject) => {
    const command = process.execPath;
    const args = [
      remotionCli,
      "render",
      "src/index.ts",
      "TikTokVideo",
      outputPath,
      "--props",
      propsPath,
    ];

    log(requestId, "Starting Remotion render", {
      command,
      args,
      outputPath,
      propsPath,
    });

    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      log(requestId, "Remotion render process closed", {
        exitCode: code,
        stdoutTail: stdout.slice(-1000),
        stderrTail: stderr.slice(-1000),
      });

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Remotion render failed with exit code ${code} for ${voiceoverAudioPath} and ${transcriptPath}.\n${stderr || stdout}`,
        ),
      );
    });
  });
};

// Der Endpunkt: 'audio' ist der Name des Feldes im Frontend
app.post(
  "/video",
  upload.fields([
    { name: "voice_over", maxCount: 1 },
    { name: "transcription", maxCount: 1 },
    { name: "images", maxCount: 30 },
    { name: "background_music", maxCount: 1 },
  ]),
  async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const voiceoverFile = req.files?.voice_over?.[0];
    const transcriptFile = req.files?.transcription?.[0];
    const imageFiles = req.files?.images ?? [];
    const backgroundMusicFile = req.files?.background_music?.[0];
    const keepFiles = shouldKeepFiles(req.body?.keepFiles);

    log(requestId, "Received /video request", {
      keepFiles,
      fileCounts: {
        voice_over: voiceoverFile ? 1 : 0,
        transcription: transcriptFile ? 1 : 0,
        images: imageFiles.length,
        background_music: backgroundMusicFile ? 1 : 0,
      },
      files: {
        voice_over: describeFile(voiceoverFile),
        transcription: describeFile(transcriptFile),
        images: imageFiles.map(describeFile),
        background_music: describeFile(backgroundMusicFile),
      },
    });

    if (
      !voiceoverFile ||
      !transcriptFile ||
      imageFiles.length === 0 ||
      !backgroundMusicFile
    ) {
      log(requestId, "Request validation failed");

      if (!keepFiles) {
        log(requestId, "Cleaning up partial upload files");
        cleanupFiles([
          voiceoverFile?.path,
          transcriptFile?.path,
          ...imageFiles.map((file) => file.path),
          backgroundMusicFile?.path,
        ]);
      }

      return res
        .status(400)
        .send(
          "Bitte voice_over, transcription, mindestens ein image und background_music hochladen.",
        );
    }

    const voiceoverAudioPath = toUploadPath(voiceoverFile);
    const transcriptPath = toUploadPath(transcriptFile);
    const imagePaths = imageFiles.map(toUploadPath);
    const backgroundMusicPath = toUploadPath(backgroundMusicFile);
    const outputName = `${path.parse(voiceoverFile.filename).name}.mp4`;
    const outputPath = path.join(tempRenderDir, outputName);
    const propsPath = path.join(
      propsDir,
      `${path.parse(voiceoverFile.filename).name}.json`,
    );
    const cleanupTargets = [
      voiceoverFile.path,
      transcriptFile.path,
      ...imageFiles.map((file) => file.path),
      backgroundMusicFile.path,
      propsPath,
      outputPath,
    ];

    log(requestId, "Prepared render asset paths", {
      voiceoverAudioPath,
      transcriptPath,
      imageCount: imagePaths.length,
      backgroundMusicPath,
      outputPath,
      propsPath,
    });

    fs.writeFileSync(
      propsPath,
      JSON.stringify(
        {
          voiceoverAudioPath,
          transcriptPath,
          imagePaths,
          backgroundMusicPath,
        },
        null,
        2,
      ),
    );

    log(requestId, "Wrote Remotion props file");

    try {
      await renderVideo({
        requestId,
        voiceoverAudioPath,
        transcriptPath,
        outputPath,
        propsPath,
      });

      log(requestId, "Sending rendered MP4 response", {
        outputName,
        elapsedMs: Date.now() - startedAt,
      });

      return res.sendFile(
        outputPath,
        {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${outputName}"`,
            "X-Voiceover-Audio-Path": voiceoverAudioPath,
            "X-Transcript-Path": transcriptPath,
            "X-Image-Count": String(imagePaths.length),
            "X-Background-Music-Path": backgroundMusicPath,
          },
        },
        (sendError) => {
          if (sendError) {
            logError(requestId, "Failed to send rendered MP4", sendError);
          } else {
            log(requestId, "Rendered MP4 response sent", {
              elapsedMs: Date.now() - startedAt,
            });
          }

          if (!keepFiles) {
            log(requestId, "Cleaning up temporary files", {
              count: cleanupTargets.length,
            });
            cleanupFiles(cleanupTargets);
          } else {
            log(requestId, "Skipping cleanup because keepFiles=true");
          }

          if (sendError && !res.headersSent) {
            res.status(500).json({
              message:
                "Video wurde gerendert, konnte aber nicht gesendet werden.",
              error: sendError.message,
            });
          }
        },
      );
    } catch (error) {
      logError(requestId, "Render failed", error);

      if (!keepFiles) {
        log(requestId, "Cleaning up temporary files after failure", {
          count: cleanupTargets.length,
        });
        cleanupFiles(cleanupTargets);
      } else {
        log(requestId, "Skipping cleanup after failure because keepFiles=true");
      }

      res.status(500).json({
        message: "Video konnte nicht gerendert werden.",
        error: error.message,
      });
    }
  },
);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
