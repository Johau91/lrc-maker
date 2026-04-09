import WaveSurfer from "wavesurfer.js";

let wavesurfer = null;
let onTimeUpdateCallback = null;

export function initPlayer(container, audioFile) {
  if (wavesurfer) {
    wavesurfer.destroy();
  }

  wavesurfer = WaveSurfer.create({
    container,
    waveColor: "#94a3b8",
    progressColor: "#6366f1",
    cursorColor: "#818cf8",
    height: 80,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: true,
  });

  const objectUrl = URL.createObjectURL(audioFile);
  wavesurfer.load(objectUrl);

  wavesurfer.on("audioprocess", () => {
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(wavesurfer.getCurrentTime());
    }
  });

  wavesurfer.on("seeking", () => {
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(wavesurfer.getCurrentTime());
    }
  });

  return wavesurfer;
}

export function playPause() {
  if (!wavesurfer) return;
  wavesurfer.playPause();
}

export function seekTo(seconds) {
  if (!wavesurfer) return;
  const duration = wavesurfer.getDuration();
  if (duration > 0) {
    wavesurfer.seekTo(seconds / duration);
  }
}

export function getCurrentTime() {
  if (!wavesurfer) return 0;
  return wavesurfer.getCurrentTime();
}

export function isPlaying() {
  if (!wavesurfer) return false;
  return wavesurfer.isPlaying();
}

export function onTimeUpdate(callback) {
  onTimeUpdateCallback = callback;
}

export function getDuration() {
  if (!wavesurfer) return 0;
  return wavesurfer.getDuration();
}
