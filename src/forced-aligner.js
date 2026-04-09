/**
 * Align lyrics lines to detected vocal segments.
 *
 * Strategy:
 * 1. Detect vocal segments from CTC speech probabilities
 * 2. Split/merge segments to match number of lyrics lines
 * 3. Assign each line to a segment's start time
 */

export function alignLinesToSegments(segments, lines, audioDuration) {
  if (lines.length === 0) return [];
  if (segments.length === 0) return distributeEvenly(lines, audioDuration);

  let result = [...segments];

  // If more segments than lines, merge shortest-gap adjacent segments
  while (result.length > lines.length) {
    let minScore = Infinity;
    let mergeIdx = 0;

    for (let i = 0; i < result.length - 1; i++) {
      const gap = result[i + 1].start - result[i].end;
      const combinedDur = result[i + 1].end - result[i].start;
      const score = gap + combinedDur * 0.05; // Prefer merging segments with small gaps
      if (score < minScore) {
        minScore = score;
        mergeIdx = i;
      }
    }

    result.splice(mergeIdx, 2, {
      start: result[mergeIdx].start,
      end: result[mergeIdx + 1].end,
    });
  }

  // If fewer segments than lines, split the longest segments
  while (result.length < lines.length) {
    let longestIdx = 0;
    let longestDur = 0;

    for (let i = 0; i < result.length; i++) {
      const dur = result[i].end - result[i].start;
      if (dur > longestDur) {
        longestDur = dur;
        longestIdx = i;
      }
    }

    const seg = result[longestIdx];
    const mid = (seg.start + seg.end) / 2;
    result.splice(longestIdx, 1, { start: seg.start, end: mid }, { start: mid, end: seg.end });
  }

  // Map lines to segments
  return lines.map((text, i) => ({
    text,
    start: parseFloat(result[i].start.toFixed(2)),
    end: parseFloat(result[i].end.toFixed(2)),
    matched: true,
  }));
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
