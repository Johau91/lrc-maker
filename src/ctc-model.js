import { AutoProcessor, AutoModelForCTC } from "@huggingface/transformers";

let processor = null;
let model = null;

/**
 * Load wav2vec2 CTC model for frame-level speech probability extraction.
 * Uses the model's blank token probabilities to detect vocal activity.
 */
export async function loadCTCModel(onProgress) {
  if (model && processor) return { model, processor };

  processor = await AutoProcessor.from_pretrained(
    "Xenova/wav2vec2-base-960h",
    {
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

  model = await AutoModelForCTC.from_pretrained("Xenova/wav2vec2-base-960h", {
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
  });

  return { model, processor };
}

/**
 * Run audio through wav2vec2 and extract speech activity per frame.
 * Returns array of { time, speechProb } for each 20ms frame.
 */
export async function extractSpeechFrames(audioData) {
  if (!model || !processor) {
    throw new Error("CTC model not loaded");
  }

  const inputs = await processor(audioData, {
    sampling_rate: 16000,
    return_tensors: "pt",
  });

  const output = await model(inputs);
  const logits = output.logits;

  // Get dimensions
  const [, numFrames, vocabSize] = logits.dims;
  const data = logits.data; // Float32Array

  // Frame duration: wav2vec2-base outputs 1 frame per ~20ms of audio
  const frameDuration = audioData.length / 16000 / numFrames;

  const frames = [];
  for (let t = 0; t < numFrames; t++) {
    const offset = t * vocabSize;

    // Compute softmax for this frame
    let maxVal = -Infinity;
    for (let c = 0; c < vocabSize; c++) {
      if (data[offset + c] > maxVal) maxVal = data[offset + c];
    }

    let sumExp = 0;
    for (let c = 0; c < vocabSize; c++) {
      sumExp += Math.exp(data[offset + c] - maxVal);
    }

    // Blank token is index 0 in wav2vec2 CTC
    const blankProb = Math.exp(data[offset + 0] - maxVal) / sumExp;
    const speechProb = 1 - blankProb;

    frames.push({
      time: t * frameDuration,
      speechProb,
    });
  }

  return frames;
}

/**
 * Detect vocal segments from speech probability frames.
 * Returns array of { start, end } for each vocal segment.
 */
export function detectVocalSegments(frames, threshold = 0.5, minDuration = 0.3, minGap = 0.3) {
  const segments = [];
  let inSpeech = false;
  let segStart = 0;

  for (const frame of frames) {
    if (!inSpeech && frame.speechProb > threshold) {
      inSpeech = true;
      segStart = frame.time;
    } else if (inSpeech && frame.speechProb <= threshold) {
      inSpeech = false;
      if (frame.time - segStart >= minDuration) {
        segments.push({ start: segStart, end: frame.time });
      }
    }
  }

  if (inSpeech) {
    const lastTime = frames[frames.length - 1].time;
    if (lastTime - segStart >= minDuration) {
      segments.push({ start: segStart, end: lastTime });
    }
  }

  // Merge segments with small gaps
  const merged = [];
  for (const seg of segments) {
    if (merged.length > 0 && seg.start - merged[merged.length - 1].end < minGap) {
      merged[merged.length - 1].end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
