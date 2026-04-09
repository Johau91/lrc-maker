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

  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  let matches = 0;
  for (const wa of wordsA) {
    if (wordsB.includes(wa)) matches++;
  }
  return matches / Math.max(wordsA.length, wordsB.length);
}

export function alignLyrics(whisperResult, lyricsText) {
  const chunks = whisperResult.chunks || [];
  const lines = lyricsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (chunks.length === 0) {
    return lines.map((text) => ({
      text,
      start: 0,
      end: 0,
      matched: false,
    }));
  }

  // Whisper chunks are sentence-level: [{ text, timestamp: [start, end] }]
  const segments = chunks.map((c) => ({
    text: c.text.trim(),
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
  }));

  let segIndex = 0;
  const aligned = [];

  for (const line of lines) {
    const normalizedLine = normalize(line);
    if (!normalizedLine) {
      aligned.push({ text: line, start: 0, end: 0, matched: false });
      continue;
    }

    // Search forward through segments for best match
    let bestScore = -1;
    let bestIdx = segIndex;

    const searchEnd = Math.min(segIndex + 20, segments.length);
    for (let i = segIndex; i < searchEnd; i++) {
      const score = similarity(normalizedLine, segments[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Also try combining consecutive segments (one line may span multiple chunks)
    for (let i = segIndex; i < searchEnd; i++) {
      for (let j = i; j < Math.min(i + 3, segments.length); j++) {
        const combined = segments
          .slice(i, j + 1)
          .map((s) => s.text)
          .join(" ");
        const score = similarity(normalizedLine, combined);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    const matchedSeg = segments[bestIdx];

    aligned.push({
      text: line,
      start: matchedSeg?.start ?? 0,
      end: matchedSeg?.end ?? 0,
      matched: bestScore > 0.15,
    });

    // Advance segment pointer if we got a decent match
    if (bestScore > 0.15) {
      segIndex = bestIdx + 1;
    }
  }

  // Interpolate unmatched lines between matched anchors
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].matched) continue;

    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (aligned[j].matched) {
        prevIdx = j;
        break;
      }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < aligned.length; j++) {
      if (aligned[j].matched) {
        nextIdx = j;
        break;
      }
    }

    const prevTime = prevIdx >= 0 ? aligned[prevIdx].start : 0;
    const nextTime =
      nextIdx >= 0
        ? aligned[nextIdx].start
        : segments[segments.length - 1]?.end ?? prevTime + 10;
    const totalGap =
      (nextIdx >= 0 ? nextIdx : aligned.length) -
      (prevIdx >= 0 ? prevIdx : -1);
    const position = i - (prevIdx >= 0 ? prevIdx : -1);

    aligned[i].start = parseFloat(
      (prevTime + ((nextTime - prevTime) * position) / totalGap).toFixed(2),
    );
    aligned[i].end = aligned[i].start + 2;
  }

  return aligned;
}
