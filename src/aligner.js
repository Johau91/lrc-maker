function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  return normalize(text).split(/\s+/).filter(Boolean).length;
}

export function alignLyrics(whisperResult, lyricsText, audioDuration = 0) {
  const chunks = whisperResult.chunks || [];

  if (chunks.length === 0) {
    const lines = lyricsText.split("\n").map((l) => l.trim()).filter(Boolean);
    return distributeEvenly(lines, audioDuration);
  }

  // Whisper segments with timestamps
  const segments = chunks.map((c) => ({
    text: c.text.trim(),
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
    wordCount: countWords(c.text),
  }));

  const totalDuration = Math.max(
    audioDuration,
    ...segments.map((s) => s.end),
  );

  // Flatten user lyrics into words
  const allWords = lyricsText
    .replace(/\n/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const totalUserWords = allWords.length;
  const totalWhisperWords = segments.reduce((sum, s) => sum + s.wordCount, 0);

  if (totalWhisperWords === 0 || totalUserWords === 0) {
    const lines = lyricsText.split("\n").map((l) => l.trim()).filter(Boolean);
    return distributeEvenly(lines, totalDuration);
  }

  // Distribute user lyrics words across segments proportionally
  const aligned = [];
  let wordIdx = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // How many user words correspond to this segment
    const ratio = seg.wordCount / totalWhisperWords;
    let wordsForSegment = Math.round(ratio * totalUserWords);

    // Last segment gets remaining words
    if (i === segments.length - 1) {
      wordsForSegment = totalUserWords - wordIdx;
    }

    // Ensure at least 1 word if words remain
    if (wordsForSegment <= 0 && wordIdx < totalUserWords) {
      wordsForSegment = 1;
    }

    if (wordsForSegment > 0 && wordIdx < totalUserWords) {
      const lineWords = allWords.slice(wordIdx, wordIdx + wordsForSegment);
      aligned.push({
        text: lineWords.join(" "),
        start: seg.start,
        end: seg.end,
        matched: true,
      });
      wordIdx += wordsForSegment;
    }
  }

  // If there are leftover words (more user words than whisper detected)
  if (wordIdx < totalUserWords) {
    const remaining = allWords.slice(wordIdx).join(" ");
    const lastEnd = segments[segments.length - 1]?.end ?? totalDuration;
    aligned.push({
      text: remaining,
      start: lastEnd,
      end: totalDuration,
      matched: false,
    });
  }

  console.log(`Aligned ${aligned.length} lines from ${segments.length} segments`);
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
