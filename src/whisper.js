import { pipeline } from "@huggingface/transformers";

let transcriber = null;

export async function loadWhisperModel(onProgress) {
  if (transcriber) return transcriber;

  transcriber = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-base",
    {
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

export async function transcribeAudio(audioData, onProgress) {
  if (!transcriber) {
    throw new Error("Whisper model not loaded. Call loadWhisperModel first.");
  }

  const result = await transcriber(audioData, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language: null,
    task: "transcribe",
  });

  return result;
}

export async function decodeAudioFile(file) {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  await audioContext.close();

  return channelData;
}
