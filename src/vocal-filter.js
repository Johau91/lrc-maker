/**
 * Apply bandpass filter to isolate vocal frequencies.
 * Vocals typically sit in 200Hz - 4000Hz range.
 * This reduces instrumental interference before sending to Whisper.
 */
export async function isolateVocals(audioFile) {
  const audioContext = new OfflineAudioContext(1, 1, 16000);
  const arrayBuffer = await audioFile.arrayBuffer();

  // Need a new context with the correct length
  const tempCtx = new AudioContext({ sampleRate: 16000 });
  const decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
  await tempCtx.close();

  const duration = decoded.duration;
  const sampleRate = 16000;
  const length = Math.ceil(duration * sampleRate);

  const offlineCtx = new OfflineAudioContext(1, length, sampleRate);

  // Re-decode for offline context
  const arrayBuffer2 = await audioFile.arrayBuffer();
  const sourceBuffer = await offlineCtx.decodeAudioData(arrayBuffer2);
  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;

  // High-pass filter at 200Hz (removes bass, drums, bass guitar)
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 200;
  highpass.Q.value = 0.7;

  // Low-pass filter at 4000Hz (removes cymbals, high-freq instruments)
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 4000;
  lowpass.Q.value = 0.7;

  // Presence boost around 1000-3000Hz (where vocal formants are strongest)
  const presenceBoost = offlineCtx.createBiquadFilter();
  presenceBoost.type = "peaking";
  presenceBoost.frequency.value = 2000;
  presenceBoost.gain.value = 6;
  presenceBoost.Q.value = 0.5;

  // Connect: source → highpass → lowpass → presenceBoost → destination
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(presenceBoost);
  presenceBoost.connect(offlineCtx.destination);

  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Decode audio file to raw Float32Array at 16kHz (no filtering).
 */
export async function decodeAudioFile(file) {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  await audioContext.close();
  return channelData;
}
