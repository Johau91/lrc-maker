# LRC Maker

Browser-based auto lyrics sync tool. Generates LRC files from audio + lyrics.

## Tech Stack

- **Frontend**: Vanilla JS + Tailwind CSS v4
- **Audio**: WaveSurfer.js (waveform + playback)
- **AI**: Transformers.js + Whisper (speech recognition, runs in browser via WASM)
- **Build**: Vite
- **Deploy**: GitHub Pages (static site)

## Architecture

100% client-side. No server, no API keys. All processing in user's browser.

```
index.html            # Main page, Vite entry
src/
  main.js             # App entry, UI events, orchestration
  whisper.js          # Whisper model load + transcription
  aligner.js          # Lyrics <-> Whisper segment alignment
  lrc.js              # LRC format generation + download
  player.js           # WaveSurfer.js waveform + playback control
  style.css           # Tailwind CSS styles
```

## Key Patterns

### Audio Processing Flow
1. User uploads audio file
2. `decodeAudioFile()` → AudioContext → Float32Array (16kHz mono)
3. `transcribeAudio()` → Whisper via Transformers.js → segments with timestamps
4. `alignLyrics()` → proportional character-position mapping
5. User fine-tunes timestamps in UI
6. `generateLRC()` → LRC format → download

### Whisper Configuration
- Model: `onnx-community/whisper-base` (fp32, WASM)
- Supports language selection (auto, Korean, English, Japanese, etc.)
- Lyrics passed as `initial_prompt` for better recognition
- First load downloads ~150MB model, cached in IndexedDB

### Alignment Algorithm
- Builds character-level timeline from Whisper segments
- Maps user lyrics proportionally to timeline
- Preserves user's original line breaks
- Falls back to even distribution if no segments

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Build for production (dist/)
npm run preview   # Preview production build
```

## Deployment

GitHub Pages via GitHub Actions. Push to `main` triggers auto-deploy.
- Repo: https://github.com/Johau91/lrc-maker
- Live: https://johau91.github.io/lrc-maker/
- `vite.config.js` has `base: "/lrc-maker/"` for GitHub Pages path

## Rules

- No server-side code. Everything runs in browser.
- Whisper model choice must support `return_timestamps: true`
- Audio decoded to 16kHz mono Float32Array for Whisper
- LRC format: `[mm:ss.xx]lyrics text`
- Keep UI simple. Single page, no routing.
