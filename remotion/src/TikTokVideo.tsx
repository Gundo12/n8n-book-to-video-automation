import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: Array<number | string>;
  character_end_times_seconds: Array<number | string>;
}

export interface ElevenLabsTranscript {
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
}

export type ElevenLabsTranscriptInput =
  | ElevenLabsTranscript
  | ElevenLabsTranscript[];

export interface TikTokVideoProps {
  // Required
  images: string[];                      // Array of image paths
  voiceoverAudio: string;                // Path to voiceover MP3
  transcript: ElevenLabsTranscriptInput; // ElevenLabs character alignment
  
  // Optional with defaults
  backgroundMusic?: string;             // Path to background music
  musicVolume?: number;                   // Default: 0.2
  voiceoverVolume?: number;               // Default: 1.0
  imageDurationFrames?: number;           // Default: 90 (3 seconds)
  fontFamily?: string;                    // Default: 'Quintessential, cursive'
  fontSize?: number;                      // Default: 80
  textColor?: string;                   // Default: '#fff'
  overlayOpacity?: number;               // Default: 0.4
}

export const getTranscriptAlignment = (
  transcript: ElevenLabsTranscriptInput,
): ElevenLabsAlignment | null => {
  const transcriptObject = Array.isArray(transcript)
    ? transcript[0]
    : transcript;

  return (
    transcriptObject?.normalized_alignment ??
    transcriptObject?.alignment ??
    null
  );
};

const toSeconds = (value: number | string | undefined): number | null => {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "");

  return Number.isFinite(numberValue) ? numberValue : null;
};

type ActiveWord = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

const emptyActiveWord: ActiveWord = {
  text: "",
  startSeconds: 0,
  endSeconds: 0,
};

const transitionFrames = 18;

const getWrappedImageIndex = (index: number, imageCount: number): number => {
  return ((index % imageCount) + imageCount) % imageCount;
};

const getKenBurnsStyle = ({
  imageIndex,
  frameInImage,
  imageDurationFrames,
}: {
  imageIndex: number;
  frameInImage: number;
  imageDurationFrames: number;
}) => {
  const progress = interpolate(
    frameInImage,
    [0, imageDurationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );

  const scale = interpolate(progress, [0, 1], [1.03, 1.09]);
  const driftXOptions = [-2.5, 2, -1.25, 2.75];
  const driftYOptions = [1.5, -2, 2.25, -1.25];
  const direction = imageIndex % 2 === 0 ? 1 : -1;
  const driftX = driftXOptions[imageIndex % driftXOptions.length] * progress;
  const driftY = driftYOptions[imageIndex % driftYOptions.length] * progress;

  return {
    transform: `scale(${scale}) translate(${driftX * direction}%, ${
      driftY * direction
    }%)`,
  };
};

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  images,
  voiceoverAudio,
  transcript,
  backgroundMusic,
  musicVolume = 0.2,
  voiceoverVolume = 1.0,
  imageDurationFrames = 90,
  fontFamily = "'Quintessential', cursive",
  fontSize = 80,
  textColor = "#fff",
  overlayOpacity = 0.4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current time in seconds
  const currentTimeSeconds = frame / fps;

  // Find current word from ElevenLabs character alignment synchronously
  const activeWord = useMemo<ActiveWord>(() => {
    const alignment = getTranscriptAlignment(transcript);

    if (!alignment) {
      return emptyActiveWord;
    }

    const { characters, character_start_times_seconds, character_end_times_seconds } =
      alignment;
    const currentCharacterIndex = characters.findIndex((_, index) => {
      const startSeconds = toSeconds(character_start_times_seconds[index]);
      const endSeconds = toSeconds(character_end_times_seconds[index]);

      if (startSeconds === null || endSeconds === null) {
        return false;
      }

      return (
        currentTimeSeconds >= startSeconds &&
        currentTimeSeconds < endSeconds
      );
    });

    if (
      currentCharacterIndex === -1 ||
      characters[currentCharacterIndex].trim() === ""
    ) {
      return emptyActiveWord;
    }

    let wordStartIndex = currentCharacterIndex;
    let wordEndIndex = currentCharacterIndex;

    while (
      wordStartIndex > 0 &&
      characters[wordStartIndex - 1].trim() !== ""
    ) {
      wordStartIndex--;
    }

    while (
      wordEndIndex < characters.length - 1 &&
      characters[wordEndIndex + 1].trim() !== ""
    ) {
      wordEndIndex++;
    }

    const wordStartSeconds = toSeconds(
      character_start_times_seconds[wordStartIndex],
    );
    const wordEndSeconds = toSeconds(character_end_times_seconds[wordEndIndex]);

    if (wordStartSeconds === null || wordEndSeconds === null) {
      return emptyActiveWord;
    }

    return {
      text: characters.slice(wordStartIndex, wordEndIndex + 1).join("").trim(),
      startSeconds: wordStartSeconds,
      endSeconds: wordEndSeconds,
    };
  }, [currentTimeSeconds, transcript]);

  // Calculate which image to show
  const imageFrameDuration = Math.max(1, imageDurationFrames);
  const activeTransitionFrames = Math.min(
    transitionFrames,
    Math.max(1, imageFrameDuration - 1),
  );
  const imageIndex =
    images.length > 0 ? Math.floor(frame / imageFrameDuration) % images.length : 0;
  const imageSegmentIndex =
    images.length > 0 ? Math.floor(frame / imageFrameDuration) : 0;
  const frameInImage = frame % imageFrameDuration;
  const previousImageIndex =
    images.length > 0
      ? getWrappedImageIndex(imageSegmentIndex - 1, images.length)
      : 0;
  const currentImage = images[imageIndex];
  const previousImage = images[previousImageIndex];
  const currentImageOpacity =
    frameInImage < activeTransitionFrames && images.length > 1
      ? interpolate(frameInImage, [0, activeTransitionFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        })
      : 1;
  const wordFrame = Math.max(0, frame - activeWord.startSeconds * fps);
  const wordSpring = spring({
    frame: wordFrame,
    fps,
    config: {
      damping: 24,
      stiffness: 180,
      mass: 0.7,
    },
  });
  const wordOpacity = activeWord.text
    ? interpolate(wordFrame, [0, 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      })
    : 0;
  const wordTranslateY = interpolate(wordFrame, [0, 10], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const wordBlur = interpolate(wordFrame, [0, 10], [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordScale = interpolate(wordSpring, [0, 1], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Previous background frame for cinematic crossfades */}
      {previousImage && images.length > 1 && frameInImage < activeTransitionFrames && (
        <Img
          src={previousImage}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 1 - currentImageOpacity,
            ...getKenBurnsStyle({
              imageIndex: previousImageIndex,
              frameInImage:
                imageFrameDuration - activeTransitionFrames + frameInImage,
              imageDurationFrames: imageFrameDuration,
            }),
          }}
        />
      )}

      {/* Current background image with subtle Ken Burns motion */}
      {currentImage && (
        <Img
          src={currentImage}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: currentImageOpacity,
            ...getKenBurnsStyle({
              imageIndex,
              frameInImage,
              imageDurationFrames: imageFrameDuration,
            }),
          }}
        />
      )}

      {/* Dark overlay for better text readability */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
        }}
      />

      {/* Soft vignette for cinematic depth and caption contrast */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.34) 100%)",
        }}
      />

      {/* Current Word Caption - centered, no background */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize,
            fontWeight: 400,
            color: textColor,
            textShadow:
              "0 5px 18px rgba(0,0,0,0.82), 0 0 34px rgba(0,0,0,0.58)",
            fontFamily,
            padding: "20px 40px",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: wordOpacity,
            filter: `blur(${wordBlur}px)`,
            transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
          }}
        >
          {activeWord.text}
        </div>
      </div>

      {/* Voiceover Audio */}
      {voiceoverAudio && (
        <Audio
          src={voiceoverAudio}
          volume={voiceoverVolume}
        />
      )}

      {/* Background Music (if provided) */}
      {backgroundMusic && (
        <Audio
          src={backgroundMusic}
          volume={musicVolume}
        />
      )}
    </AbsoluteFill>
  );
};

// Default export for easier importing
export default TikTokVideo;
