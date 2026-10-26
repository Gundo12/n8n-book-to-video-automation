import "./index.css";
import { Composition, staticFile, type AnyZodObject } from "remotion";
import {
  getTranscriptAlignment,
  TikTokVideo,
  type ElevenLabsTranscriptInput,
  type TikTokVideoProps,
} from "./TikTokVideo";

const fps = 30;
const emptyTranscript: ElevenLabsTranscriptInput = {
  alignment: {
    characters: [],
    character_start_times_seconds: [],
    character_end_times_seconds: [],
  },
};

type RemotionTikTokVideoProps = TikTokVideoProps & {
  voiceoverAudioPath: string;
  transcriptPath: string;
  imagePaths: string[];
  backgroundMusicPath: string;
} & Record<string, unknown>;

const loadTranscript = async (
  transcriptionPath: string,
): Promise<ElevenLabsTranscriptInput> => {
  if (!transcriptionPath) {
    return emptyTranscript;
  }

  const response = await fetch(staticFile(transcriptionPath));

  if (!response.ok) {
    throw new Error(
      `Could not load transcript from ${transcriptionPath}: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

const getLastFiniteNumber = (
  values: Array<number | string> | undefined,
): number => {
  if (!values) {
    return 0;
  }

  for (let index = values.length - 1; index >= 0; index--) {
    const rawValue = values[index];
    const value =
      typeof rawValue === "number"
        ? rawValue
        : Number.parseFloat(rawValue ?? "");

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<AnyZodObject, RemotionTikTokVideoProps>
        id="TikTokVideo"
        component={TikTokVideo}
        durationInFrames={fps}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{
          images: [],
          imagePaths: [],
          voiceoverAudioPath: "",
          transcriptPath: "",
          backgroundMusicPath: "",
          voiceoverAudio: "",
          transcript: emptyTranscript,
          backgroundMusic: undefined,
          musicVolume: 0.2,
          voiceoverVolume: 1.0,
          imageDurationFrames: 90,
          fontFamily: "'Quintessential', cursive",
          fontSize: 80,
          textColor: "#fff",
          overlayOpacity: 0.4,
        }}
        calculateMetadata={async ({ props }) => {
          const transcript = await loadTranscript(props.transcriptPath);
          const alignment = getTranscriptAlignment(transcript);
          const lastCharacterEndSeconds = getLastFiniteNumber(
            alignment?.character_end_times_seconds,
          );

          return {
            durationInFrames:
              Math.ceil(lastCharacterEndSeconds * fps) + fps,
            props: {
              ...props,
              images: props.imagePaths.map((imagePath) =>
                staticFile(imagePath),
              ),
              backgroundMusic: props.backgroundMusicPath
                ? staticFile(props.backgroundMusicPath)
                : undefined,
              voiceoverAudio: props.voiceoverAudioPath
                ? staticFile(props.voiceoverAudioPath)
                : "",
              transcript,
            },
          };
        }}
      />
    </>
  );
};
