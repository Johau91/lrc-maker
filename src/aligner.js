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
    return lines.map((text, i) => ({
      text,
      start: 0,
      end: 0,
      matched: false,
    }));
  }

  // Build word sequence with timestamps from whisper chunks
  const words = chunks.map((c) => ({
    text: c.text.trim(),
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
  }));

  let wordIndex = 0;
  const aligned = [];

  for (const line of lines) {
    const lineWords = normalize(line).split(" ").filter(Boolean);
    if (lineWords.length === 0) {
      aligned.push({ text: line, start: 0, end: 0, matched: false });
      continue;
    }

    // Find best matching position for first word of this line
    let bestScore = -1;
    let bestStart = wordIndex;

    const searchEnd = Math.min(wordIndex + 50, words.length);
    for (let i = wordIndex; i < searchEnd; i++) {
      const windowSize = Math.min(lineWords.length, words.length - i);
      const windowWords = words
        .slice(i, i + windowSize)
        .map((w) => w.text)
        .join(" ");
      const score = similarity(lineWords.join(" "), windowWords);

      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }

    const matchedWord = words[bestStart];
    const endWord = words[Math.min(bestStart + lineWords.length - 1, words.length - 1)];

    aligned.push({
      text: line,
      start: matchedWord?.start ?? 0,
      end: endWord?.end ?? matchedWord?.start ?? 0,
      matched: bestScore > 0.2,
    });

    if (bestScore > 0.2) {
      wordIndex = bestStart + lineWords.length;
    }
  }

  // Interpolate unmatched lines
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].matched) continue;

    const prevTime = i > 0 ? aligned[i - 1].start : 0;
    const nextIdx = aligned.findIndex((a, j) => j > i && a.matched);
    const nextTime =
      nextIdx >= 0
        ? aligned[nextIdx].start
        : words[words.length - 1]?.end ?? 0;

    const gap = nextIdx >= 0 ? nextIdx - i : aligned.length - i;
    const step = (nextTime - prevTime) / (gap + 1);
    aligned[i].start = parseFloat((prevTime + step * (i - (i > 0 ? i - 1 : 0) + (i > 0 ? 1 : 1))).toFixed(2));
    aligned[i].end = aligned[i].start + 2;
  }

  // Second pass: fix interpolation properly
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].matched) continue;

    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (aligned[j].matched) { prevIdx = j; break; }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < aligned.length; j++) {
      if (aligned[j].matched) { nextIdx = j; break; }
    }

    const prevTime = prevIdx >= 0 ? aligned[prevIdx].start : 0;
    const nextTime = nextIdx >= 0 ? aligned[nextIdx].start : (words[words.length - 1]?.end ?? prevTime + 10);
    const totalGap = (nextIdx >= 0 ? nextIdx : aligned.length) - (prevIdx >= 0 ? prevIdx : -1);
    const position = i - (prevIdx >= 0 ? prevIdx : -1);

    aligned[i].start = parseFloat((prevTime + (nextTime - prevTime) * (position / totalGap)).toFixed(2));
    aligned[i].end = aligned[i].start + 2;
  }

  return aligned;
}
