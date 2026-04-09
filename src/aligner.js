import { extractSpeechFrames, detectVocalSegments } from "./ctc-model.js";
import { alignLinesToSegments } from "./forced-aligner.js";

export async function alignLyrics(audioData, lyricsText, audioDuration) {
  const lines = lyricsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Step 1: Get speech probabilities from wav2vec2 CTC model
  const frames = await extractSpeechFrames(audioData);
  console.log(`Extracted ${frames.length} speech frames`);

  // Step 2: Detect vocal segments
  const segments = detectVocalSegments(frames, 0.5, 0.3, 0.4);
  console.log(`Detected ${segments.length} vocal segments:`, segments);

  // Step 3: Align lyrics lines to vocal segments
  const aligned = alignLinesToSegments(segments, lines, audioDuration);
  console.log(`Aligned ${aligned.length} lines`);

  return aligned;
}
