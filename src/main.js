import "./style.css";
import { loadWhisperModel, transcribeAudio } from "./whisper.js";
import { isolateVocals, decodeAudioFile } from "./vocal-filter.js";
import { alignLyrics } from "./aligner.js";
import { generateLRC, downloadLRC, formatTimestamp } from "./lrc.js";
import { initPlayer, playPause, seekTo, getCurrentTime, isPlaying, onTimeUpdate } from "./player.js";

let audioFile = null;
let alignedLines = [];
let selectedLineIdx = -1;

// DOM elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileName = document.getElementById("file-name");
const lyricsInput = document.getElementById("lyrics-input");
const titleInput = document.getElementById("title-input");
const artistInput = document.getElementById("artist-input");
const generateBtn = document.getElementById("generate-btn");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const resultSection = document.getElementById("result-section");
const waveformContainer = document.getElementById("waveform");
const playBtn = document.getElementById("play-btn");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const linesContainer = document.getElementById("lines-container");
const captureBtn = document.getElementById("capture-btn");
const downloadBtn = document.getElementById("download-btn");
const inputSection = document.getElementById("input-section");
const languageSelect = document.getElementById("language-select");

// File drop handling
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("audio/")) {
    setAudioFile(file);
  }
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) setAudioFile(file);
});

function setAudioFile(file) {
  audioFile = file;
  fileName.textContent = file.name;
  fileName.classList.remove("hidden");
  dropZone.querySelector("p").textContent = "File selected";

  // Auto-fill title from filename
  const name = file.name.replace(/\.[^.]+$/, "");
  if (!titleInput.value) {
    titleInput.value = name;
  }
}

// Generate LRC
generateBtn.addEventListener("click", async () => {
  if (!audioFile) {
    alert("Please upload an audio file.");
    return;
  }

  const lyrics = lyricsInput.value.trim();
  if (!lyrics) {
    alert("Please enter lyrics.");
    return;
  }

  try {
    generateBtn.disabled = true;
    inputSection.classList.add("opacity-50", "pointer-events-none");
    progressSection.classList.remove("hidden");
    resultSection.classList.add("hidden");

    // Step 1: Load model
    progressText.textContent = "Loading Whisper model (first time may take a while)...";
    progressBar.style.width = "0%";

    await loadWhisperModel((p) => {
      progressBar.style.width = `${Math.min(p.percent, 100)}%`;
      const mb = (p.loaded / 1024 / 1024).toFixed(0);
      const totalMb = (p.total / 1024 / 1024).toFixed(0);
      progressText.textContent = `Downloading model... ${mb}MB / ${totalMb}MB`;
    });

    // Step 2: Isolate vocals (bandpass filter)
    progressText.textContent = "Isolating vocals...";
    progressBar.style.width = "40%";

    const rawAudioData = await decodeAudioFile(audioFile);
    let vocalAudioData;
    try {
      vocalAudioData = await isolateVocals(audioFile);
      console.log("Vocal isolation complete");
    } catch (e) {
      console.warn("Vocal isolation failed, using raw audio:", e);
      vocalAudioData = rawAudioData;
    }

    // Step 3: Transcribe isolated vocals
    const audioDurationSec = Math.round(rawAudioData.length / 16000);
    progressText.textContent = `Transcribing ${audioDurationSec}s of audio...`;
    progressBar.style.width = "60%";
    progressBar.classList.add("animate-pulse");

    const transcribeStart = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - transcribeStart) / 1000);
      progressText.textContent = `Transcribing audio... ${elapsed}s elapsed`;
    }, 1000);

    const language = languageSelect.value === "auto" ? null : languageSelect.value;
    const result = await transcribeAudio(vocalAudioData, lyrics, language);
    clearInterval(timerInterval);
    progressBar.classList.remove("animate-pulse");
    console.log("Whisper result:", JSON.stringify(result, null, 2));

    // Step 4: Align
    progressText.textContent = "Aligning lyrics...";
    progressBar.style.width = "90%";

    const audioDuration = rawAudioData.length / 16000;
    alignedLines = alignLyrics(result, lyrics, audioDuration, rawAudioData);

    // Step 5: Show results
    progressBar.style.width = "100%";
    progressText.textContent = "Done!";

    setTimeout(() => {
      progressSection.classList.add("hidden");
      showResults();
    }, 500);
  } catch (err) {
    console.error(err);
    progressText.textContent = `Error: ${err.message}`;
    progressBar.style.width = "0%";
  } finally {
    generateBtn.disabled = false;
    inputSection.classList.remove("opacity-50", "pointer-events-none");
  }
});

function showResults() {
  resultSection.classList.remove("hidden");

  // Init waveform player
  const ws = initPlayer(waveformContainer, audioFile);

  ws.on("ready", () => {
    durationEl.textContent = formatTimestamp(ws.getDuration());
  });

  onTimeUpdate((time) => {
    currentTimeEl.textContent = formatTimestamp(time);
    highlightCurrentLine(time);
  });

  renderLines();
}

function renderLines() {
  linesContainer.innerHTML = "";

  alignedLines.forEach((line, i) => {
    const row = document.createElement("div");
    row.className = "lyrics-line flex items-center gap-2 px-3 py-2 rounded-lg";
    row.dataset.index = i;

    row.innerHTML = `
      <input type="text"
        class="timestamp-input w-20 bg-transparent text-indigo-400 font-mono text-sm border border-transparent rounded px-1 py-0.5 focus:border-indigo-500 focus:outline-none text-center"
        value="${formatTimestamp(line.start)}"
        data-index="${i}"
      />
      <span class="flex-1 text-sm">${escapeHtml(line.text)}</span>
      <div class="flex gap-1">
        <button class="adj-btn text-xs px-1.5 py-0.5 rounded bg-surface hover:bg-surface-hover text-text-dim" data-index="${i}" data-delta="-0.1">-0.1</button>
        <button class="adj-btn text-xs px-1.5 py-0.5 rounded bg-surface hover:bg-surface-hover text-text-dim" data-index="${i}" data-delta="0.1">+0.1</button>
      </div>
    `;

    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
      selectedLineIdx = i;
      seekTo(line.start);
      updateSelectedLine();
    });

    linesContainer.appendChild(row);
  });

  // Timestamp edit handlers
  linesContainer.querySelectorAll(".timestamp-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.index);
      const parsed = parseTimestamp(e.target.value);
      if (parsed !== null) {
        alignedLines[idx].start = parsed;
        e.target.value = formatTimestamp(parsed);
      }
    });
  });

  // Adjust buttons
  linesContainer.querySelectorAll(".adj-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.index);
      const delta = parseFloat(e.target.dataset.delta);
      alignedLines[idx].start = Math.max(0, parseFloat((alignedLines[idx].start + delta).toFixed(2)));

      const input = linesContainer.querySelector(`.timestamp-input[data-index="${idx}"]`);
      if (input) input.value = formatTimestamp(alignedLines[idx].start);
    });
  });
}

function highlightCurrentLine(time) {
  let activeIdx = -1;
  for (let i = alignedLines.length - 1; i >= 0; i--) {
    if (time >= alignedLines[i].start) {
      activeIdx = i;
      break;
    }
  }

  const rows = linesContainer.querySelectorAll(".lyrics-line");
  rows.forEach((row, i) => {
    row.classList.toggle("active", i === activeIdx);
  });

  // Auto-scroll to active line
  if (activeIdx >= 0) {
    const activeRow = rows[activeIdx];
    if (activeRow) {
      activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}

function updateSelectedLine() {
  const rows = linesContainer.querySelectorAll(".lyrics-line");
  rows.forEach((row, i) => {
    row.style.outline = i === selectedLineIdx ? "1px solid var(--color-accent)" : "";
  });
}

function parseTimestamp(str) {
  const match = str.match(/^(\d{1,2}):(\d{2}(?:\.\d{1,2})?)$/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Capture button - set current playback time to selected line
captureBtn.addEventListener("click", () => {
  if (selectedLineIdx < 0) {
    alert("Click a lyrics line first to select it.");
    return;
  }
  const time = getCurrentTime();
  alignedLines[selectedLineIdx].start = parseFloat(time.toFixed(2));

  const input = linesContainer.querySelector(`.timestamp-input[data-index="${selectedLineIdx}"]`);
  if (input) input.value = formatTimestamp(alignedLines[selectedLineIdx].start);
});

// Play/Pause
playBtn.addEventListener("click", () => {
  playPause();
  playBtn.textContent = isPlaying() ? "Pause" : "Play";
});

// Download LRC
downloadBtn.addEventListener("click", () => {
  const lrc = generateLRC(alignedLines, {
    title: titleInput.value,
    artist: artistInput.value,
  });

  const name = titleInput.value || "lyrics";
  downloadLRC(lrc, `${name}.lrc`);
});
