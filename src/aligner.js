import { detectOnsets, matchSegmentsToLines } from "./onset.js";

export function alignLyrics(whisperResult, lyricsText, audioDuration = 0, audioData = null) {
  const lines = lyricsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Primary: use audio energy onset detection
  if (audioData) {
    const segments = detectOnsets(audioData, 16000);
    console.log(`Detected ${segments.length} vocal segments:`, segments);

    const matched = matchSegmentsToLines(segments, lines.length);
    console.log(`Matched to ${matched.length} lines:`, matched);

    if (matched.length === lines.length) {
      return lines.map((text, i) => ({
        text,
        start: parseFloat(matched[i].start.toFixed(2)),
        end: parseFloat(matched[i].end.toFixed(2)),
        matched: true,
      }));
    }
  }

  // Fallback: use Whisper segments with proportional mapping
  const chunks = whisperResult?.chunks || [];

  if (chunks.length > 0) {
    const segments = chunks.map((c) => ({
      text: c.text.trim(),
      start: c.timestamp?.[0] ?? 0,
      end: c.timestamp?.[1] ?? 0,
    }));

    const totalDuration = Math.max(audioDuration, ...segments.map((s) => s.end));
    const charTimeline = [];

    for (const seg of segments) {
      const chars = seg.text.split("");
      for (let i = 0; i < chars.length; i++) {
        const t = seg.start + ((seg.end - seg.start) * i) / Math.max(chars.length, 1);
        charTimeline.push({ time: t });
      }
      charTimeline.push({ time: seg.end });
    }

    const userFull = lines.join(" ").replace(/\s+/g, " ");
    let userCharPos = 0;

    return lines.map((text) => {
      const normalizedLine = text.replace(/\s+/g, " ").trim();
      const lineStartRatio = userCharPos / Math.max(userFull.length, 1);
      const lineEndRatio = (userCharPos + normalizedLine.length) / Math.max(userFull.length, 1);

      const timelineStart = Math.floor(lineStartRatio * charTimeline.length);
      const timelineEnd = Math.floor(lineEndRatio * charTimeline.length);

      const startTime = charTimeline[Math.min(timelineStart, charTimeline.length - 1)]?.time ?? 0;
      const endTime = charTimeline[Math.min(timelineEnd, charTimeline.length - 1)]?.time ?? startTime + 2;

      userCharPos += normalizedLine.length + 1;

      return {
        text,
        start: parseFloat(startTime.toFixed(2)),
        end: parseFloat(endTime.toFixed(2)),
        matched: true,
      };
    });
  }

  // Last fallback: even distribution
  const gap = audioDuration / (lines.length + 1);
  return lines.map((text, i) => ({
    text,
    start: parseFloat((gap * (i + 1)).toFixed(2)),
    end: parseFloat((gap * (i + 1) + gap * 0.8).toFixed(2)),
    matched: false,
  }));
}
