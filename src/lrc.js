export function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = secs.toFixed(2).padStart(5, "0");
  return `${mm}:${ss}`;
}

export function generateLRC(lines, metadata = {}) {
  const parts = [];

  if (metadata.title) {
    parts.push(`[ti:${metadata.title}]`);
  }
  if (metadata.artist) {
    parts.push(`[ar:${metadata.artist}]`);
  }
  parts.push("[by:LRC Maker]");
  parts.push("");

  for (const line of lines) {
    const ts = formatTimestamp(line.start);
    parts.push(`[${ts}]${line.text}`);
  }

  return parts.join("\n");
}

export function downloadLRC(content, filename = "lyrics.lrc") {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
