import { pipeline } from "@huggingface/transformers";

let transcriber = null;

export async function loadWhisperModel(onProgress) {
  if (transcriber) return transcriber;

  transcriber = await pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-small",
    {
      dtype: "fp32",
      device: "wasm",
      progress_callback: (progress) => {
        if (onProgress && progress.status === "progress") {
          onProgress({
            file: progress.file,
            loaded: progress.loaded,
            total: progress.total,
            percent: Math.round((progress.loaded / progress.total) * 100),
          });
        }
      },
    },
  );

  return transcriber;
}

export async function transcribeAudio(audioData, lyrics = "", language = null) {
  if (!transcriber) {
    throw new Error("Whisper model not loaded. Call loadWhisperModel first.");
  }

  const prompt = lyrics.replace(/\n/g, " ").slice(0, 200).trim();

  const result = await transcriber(audioData, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language,
    task: "transcribe",
    ...(prompt ? { initial_prompt: prompt } : {}),
  });

  return result;
}

// decodeAudioFile moved to vocal-filter.js
