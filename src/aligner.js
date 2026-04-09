function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  // Character-level overlap for Korean (word splitting is unreliable)
  const setA = new Set(na.replace(/\s/g, "").split(""));
  const setB = new Set(nb.replace(/\s/g, "").split(""));
  let overlap = 0;
  for (const ch of setA) {
    if (setB.has(ch)) overlap++;
  }
  return overlap / Math.max(setA.size, setB.size);
}

export function alignLyrics(whisperResult, lyricsText, audioDuration = 0) {
  const chunks = whisperResult.chunks || [];

  // Use the user's original line breaks
  const lines = lyricsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (chunks.length === 0) {
    return distributeEvenly(lines, audioDuration);
  }

  // Build a flat timeline of whisper text with timestamps
  const segments = chunks.map((c) => ({
    text: c.text.trim(),
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
  }));

  const totalDuration = Math.max(
    audioDuration,
    ...segments.map((s) => s.end),
  );

  // Concatenate all whisper text, tracking character positions → timestamps
  const charTimeline = [];
  for (const seg of segments) {
    const chars = seg.text.split("");
    for (let i = 0; i < chars.length; i++) {
      const t = seg.start + ((seg.end - seg.start) * i) / Math.max(chars.length, 1);
      charTimeline.push({ char: chars[i], time: t });
    }
    // Add space between segments
    charTimeline.push({ char: " ", time: seg.end });
  }

  // Full whisper text (normalized)
  const whisperFull = normalize(
    segments.map((s) => s.text).join(" "),
  );

  // Flatten user lyrics into one normalized string
  const userFull = normalize(lines.join(" "));

  // Map each user line to a position in the whisper text proportionally
  const aligned = [];
  let userCharPos = 0;

  for (const line of lines) {
    const normalizedLine = normalize(line);
    if (!normalizedLine) {
      aligned.push({ text: line, start: 0, end: 0, matched: false });
      continue;
    }

    // This line's proportion in the total user text
    const lineStartRatio = userCharPos / Math.max(userFull.length, 1);
    const lineEndRatio = (userCharPos + normalizedLine.length) / Math.max(userFull.length, 1);

    // Map to whisper character timeline
    const timelineStart = Math.floor(lineStartRatio * charTimeline.length);
    const timelineEnd = Math.floor(lineEndRatio * charTimeline.length);

    const startTime = charTimeline[Math.min(timelineStart, charTimeline.length - 1)]?.time ?? 0;
    const endTime = charTimeline[Math.min(timelineEnd, charTimeline.length - 1)]?.time ?? startTime + 2;

    aligned.push({
      text: line,
      start: parseFloat(startTime.toFixed(2)),
      end: parseFloat(endTime.toFixed(2)),
      matched: true,
    });

    userCharPos += normalizedLine.length + 1; // +1 for space between lines
  }

  console.log(`Aligned ${aligned.length} lines across ${totalDuration.toFixed(1)}s`);
  return aligned;
}

function distributeEvenly(lines, duration) {
  const gap = duration / (lines.length + 1);
  return lines.map((text, i) => ({
    text,
    start: parseFloat((gap * (i + 1)).toFixed(2)),
    end: parseFloat((gap * (i + 1) + gap * 0.8).toFixed(2)),
    matched: false,
  }));
}
