/**
 * Detect vocal segment boundaries using audio energy analysis.
 * Returns timestamps where vocal phrases likely start.
 */
export function detectOnsets(audioData, sampleRate = 16000) {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const hopSize = Math.floor(windowSize / 2);

  // Step 1: Calculate RMS energy per window
  const energies = [];
  for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += audioData[i + j] ** 2;
    }
    energies.push(Math.sqrt(sum / windowSize));
  }

  // Step 2: Smooth energy (moving average, 300ms window)
  const smoothWindow = Math.floor(0.3 * sampleRate / hopSize);
  const smoothed = [];
  for (let i = 0; i < energies.length; i++) {
    const start = Math.max(0, i - Math.floor(smoothWindow / 2));
    const end = Math.min(energies.length, i + Math.floor(smoothWindow / 2));
    let sum = 0;
    for (let j = start; j < end; j++) sum += energies[j];
    smoothed.push(sum / (end - start));
  }

  // Step 3: Find adaptive threshold (median energy)
  const sorted = [...smoothed].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length * 0.4)];
  const threshold = median * 1.5;

  // Step 4: Find segments where energy is above threshold
  const segments = [];
  let inSegment = false;
  let segStart = 0;

  for (let i = 0; i < smoothed.length; i++) {
    const time = (i * hopSize) / sampleRate;

    if (!inSegment && smoothed[i] > threshold) {
      inSegment = true;
      segStart = time;
    } else if (inSegment && smoothed[i] <= threshold) {
      inSegment = false;
      const segEnd = time;
      // Only keep segments longer than 0.5s
      if (segEnd - segStart > 0.5) {
        segments.push({ start: segStart, end: segEnd });
      }
    }
  }

  // Close last segment if still in one
  if (inSegment) {
    const segEnd = (smoothed.length * hopSize) / sampleRate;
    if (segEnd - segStart > 0.5) {
      segments.push({ start: segStart, end: segEnd });
    }
  }

  // Step 5: Merge segments that are close together (< 0.8s gap)
  const merged = [];
  for (const seg of segments) {
    if (merged.length > 0 && seg.start - merged[merged.length - 1].end < 0.8) {
      merged[merged.length - 1].end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Split long segments to match expected line count.
 * If we have fewer segments than lines, subdivide the longest segments.
 */
export function matchSegmentsToLines(segments, lineCount) {
  if (segments.length === 0) return [];

  let result = [...segments];

  // Split segments until we have enough for all lines
  while (result.length < lineCount) {
    // Find the longest segment
    let longestIdx = 0;
    let longestDur = 0;
    for (let i = 0; i < result.length; i++) {
      const dur = result[i].end - result[i].start;
      if (dur > longestDur) {
        longestDur = dur;
        longestIdx = i;
      }
    }

    // Split it in half
    const seg = result[longestIdx];
    const mid = (seg.start + seg.end) / 2;
    result.splice(longestIdx, 1, { start: seg.start, end: mid }, { start: mid, end: seg.end });
  }

  // If we have more segments than lines, merge the shortest gaps
  while (result.length > lineCount) {
    let minGapIdx = 0;
    let minGap = Infinity;
    for (let i = 0; i < result.length - 1; i++) {
      const gap = result[i + 1].start - result[i].end;
      const combinedDur = result[i + 1].end - result[i].start;
      // Prefer merging segments with small gaps and short combined duration
      const score = gap + combinedDur * 0.1;
      if (score < minGap) {
        minGap = score;
        minGapIdx = i;
      }
    }
    result.splice(minGapIdx, 2, {
      start: result[minGapIdx].start,
      end: result[minGapIdx + 1].end,
    });
  }

  return result;
}
