let voicerOverAudioPath = "uploads/elevenlabs_voiceover.mp3";
let transcriptionPath = "uploads/elevenlabs_transcript_words.json";

export function getAssetPaths() {
  return { voicerOverAudioPath, transcriptionPath };
}

export function setPaths(assetPaths: any) {
  voicerOverAudioPath = assetPaths["voice_over"] ?? voicerOverAudioPath;
  transcriptionPath =
    assetPaths["transcription"] ??
    assetPaths["transcriptions"] ??
    transcriptionPath;
}
