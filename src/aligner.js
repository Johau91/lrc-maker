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

export function alignLyrics(whisperResult, lyricsText, audioDuration = 0) {
  const chunks = whisperResult.chunks || [];
  const lines = lyricsText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // If no chunks at all, distribute evenly across audio duration
  if (chunks.length === 0) {
    return distributeEvenly(lines, audioDuration);
  }

  // Get total duration from chunks
  const totalDuration = Math.max(
    audioDuration,
    ...chunks.map((c) => c.timestamp?.[1] ?? 0),
  );

  // Whisper chunks: [{ text, timestamp: [start, end] }]
  const segments = chunks.map((c) => ({
    text: c.text.trim(),
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
  }));

  console.log("Segments:", segments);

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
      // Match against single segment
      const score = similarity(normalizedLine, segments[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }

      // Also try combining consecutive segments
      for (let j = i + 1; j < Math.min(i + 3, segments.length); j++) {
        const combined = segments
          .slice(i, j + 1)
          .map((s) => s.text)
          .join(" ");
        const combinedScore = similarity(normalizedLine, combined);
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
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

    if (bestScore > 0.15) {
      segIndex = bestIdx + 1;
    }
  }

  // Check if alignment worked at all
  const matchedCount = aligned.filter((a) => a.matched).length;
  console.log(`Matched ${matchedCount}/${aligned.length} lines`);

  // If no lines matched, fall back to even distribution
  if (matchedCount === 0) {
    return distributeEvenly(lines, totalDuration);
  }

  // Interpolate unmatched lines between matched anchors
  interpolateUnmatched(aligned, totalDuration);

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

function interpolateUnmatched(aligned, totalDuration) {
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
      nextIdx >= 0 ? aligned[nextIdx].start : totalDuration;
    const startPos = prevIdx >= 0 ? prevIdx : -1;
    const endPos = nextIdx >= 0 ? nextIdx : aligned.length;
    const totalGap = endPos - startPos;
    const position = i - startPos;

    aligned[i].start = parseFloat(
      (prevTime + ((nextTime - prevTime) * position) / totalGap).toFixed(2),
    );
    aligned[i].end = parseFloat((aligned[i].start + 2).toFixed(2));
  }
}
