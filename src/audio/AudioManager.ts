// Simple synthesized audio system using Web Audio API
// No external audio files needed

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentBgm: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;
let masterVolume = 0.5;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
  }
  // Browsers may hand us a suspended context (autoplay policy); without resuming,
  // the whole game would stay silent.
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

export function setMasterVolume(vol: number) {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (masterGain) masterGain.gain.value = masterVolume;
}

// ===================== Sound Effects =====================

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(getMaster());
  const t = ctx.currentTime + delay;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', vol = 0.08) {
  for (const f of freqs) playTone(f, duration, type, vol);
}

// Jump sound - quick rising tone
export function playJump() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(getMaster());
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

// Land sound - soft thud
export function playLand() {
  playTone(120, 0.15, 'triangle', 0.1);
  playTone(80, 0.1, 'sine', 0.08);
}

// Collect coin/item - happy chime
export function playCollect() {
  const ctx = getCtx();
  const notes = [523, 659, 784]; // C5, E5, G5
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(getMaster());
    const t = ctx.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}

// Golden egg collect - magical sparkle
export function playMagic() {
  const ctx = getCtx();
  const notes = [523, 659, 784, 1047, 1319]; // C5 E5 G5 C6 E6
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(getMaster());
    const t = ctx.currentTime + i * 0.1;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

// Treasure chest open - ascending arpeggio
export function playChestOpen() {
  const ctx = getCtx();
  const notes = [262, 330, 392, 523, 659]; // C4 E4 G4 C5 E5
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(getMaster());
    const t = ctx.currentTime + i * 0.06;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

// Purchase success - cash register ding
export function playPurchase() {
  playTone(1200, 0.15, 'sine', 0.12);
  playTone(1600, 0.2, 'sine', 0.1, 0.1);
}

// Greeting / NPC interaction - friendly two-note
export function playGreeting() {
  playTone(440, 0.15, 'sine', 0.1);
  playTone(554, 0.2, 'sine', 0.1, 0.12);
}

// ===================== Voice (speech synthesis) =====================
// NPCs actually talk using the browser's built-in TTS — no audio files to ship,
// and the voice follows the same master volume as the rest of the game.

let preferredVoice: SpeechSynthesisVoice | null = null;

function pickChineseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer mainland Mandarin, then any Chinese voice.
  return (
    voices.find((v) => /^zh[-_]CN/i.test(v.lang)) ??
    voices.find((v) => /^zh/i.test(v.lang)) ??
    null
  );
}

function initVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  preferredVoice = pickChineseVoice();
  // Chrome/Edge fill the voice list asynchronously, so re-pick once it lands.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    preferredVoice = pickChineseVoice();
  });
}
initVoices();

/** Speak a line out loud, interrupting anything still being said. */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  // A cancelled queue can stay paused in Chromium, which silences the next line.
  synth.cancel();
  synth.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.pitch = 1.5; // squeaky, to match the egg characters
  utterance.rate = 1.05;
  utterance.volume = masterVolume;

  // Chromium sometimes drops an utterance spoken in the same tick as cancel().
  window.setTimeout(() => synth.speak(utterance), 0);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// Water splash
export function playSplash() {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  gain.gain.value = 0.15;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  source.start();
}

// Wing flap - short airy whoosh
export function playFlap() {
  const ctx = getCtx();
  const bufferSize = Math.floor(ctx.sampleRate * 0.18);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.08));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(700, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(1700, ctx.currentTime + 0.12);
  filter.Q.value = 1.1;

  const gain = ctx.createGain();
  gain.gain.value = 0.12;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  source.start();
}

// Swing push sound - whoosh
export function playSwingPush() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(getMaster());
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

// Trampoline bounce
export function playBounce() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(getMaster());
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ===================== BGM =====================

// Simple looping ambient melody using sine waves
let bgmStarted = false;

export function startBGM() {
  if (bgmStarted) return;
  bgmStarted = true;
  const ctx = getCtx();

  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.04;
  bgmGain.connect(getMaster());

  // Pentatonic melody notes (C major pentatonic, spread across octaves)
  const notes = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
  let noteIndex = 0;

  function playNextNote() {
    if (!bgmStarted || !bgmGain) return;
    const ctx = getCtx();
    const freq = notes[noteIndex % notes.length];
    noteIndex++;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(bgmGain!);

    const t = ctx.currentTime;
    const dur = 0.8 + Math.random() * 1.2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.05);
    gain.gain.setValueAtTime(0.6, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);

    // Schedule next note
    setTimeout(playNextNote, dur * 600 + Math.random() * 400);
  }

  // Start after a short delay
  setTimeout(playNextNote, 1000);
}

export function stopBGM() {
  bgmStarted = false;
  if (bgmGain) {
    bgmGain.gain.value = 0;
    bgmGain = null;
  }
}

export function setBGMVolume(vol: number) {
  if (bgmGain) bgmGain.gain.value = vol * 0.06;
}

// ===================== Ambient bed (wind / water / birds) =====================
// Requirement 9: looping ambience whose volume falls off with distance.

let ambienceStarted = false;
let windGain: GainNode | null = null;
let waterGain: GainNode | null = null;
let birdGain: GainNode | null = null;

/** Two seconds of white noise, looped and filtered to make wind and water. */
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeNoiseBed(
  ctx: AudioContext,
  buffer: AudioBuffer,
  type: BiquadFilterType,
  frequency: number,
  q: number,
): GainNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  source.start();
  return gain;
}

export function startAmbience() {
  if (ambienceStarted) return;
  ambienceStarted = true;
  const ctx = getCtx();
  const noise = createNoiseBuffer(ctx);

  // Wind is always present, just very quiet
  windGain = makeNoiseBed(ctx, noise, 'lowpass', 420, 0.7);
  windGain.gain.value = 0.05;

  // Water sits in a brighter band; its level follows the player's distance from the lake
  waterGain = makeNoiseBed(ctx, noise, 'bandpass', 900, 0.8);

  // Bird song is injected as short chirps, gated by tree proximity
  birdGain = ctx.createGain();
  birdGain.gain.value = 0;
  birdGain.connect(getMaster());
  scheduleChirp();

  // Slow swell so the wind does not sound like static
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoDepth.gain.value = 0.02;
  lfo.connect(lfoDepth);
  lfoDepth.connect(windGain.gain);
  lfo.start();

  // Water laps a little faster than the wind swells
  const waterLfo = ctx.createOscillator();
  const waterDepth = ctx.createGain();
  waterLfo.frequency.value = 0.35;
  waterDepth.gain.value = 0.05;
  waterLfo.connect(waterDepth);
  waterDepth.connect(waterGain.gain);
  waterLfo.start();
}

function scheduleChirp() {
  if (!ambienceStarted || !birdGain) return;
  const ctx = getCtx();
  const chirpCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chirpCount; i++) {
    const t = ctx.currentTime + i * 0.12 + Math.random() * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 1800 + Math.random() * 1200;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.05);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(birdGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }
  setTimeout(scheduleChirp, 2500 + Math.random() * 6000);
}

export function stopAmbience() {
  ambienceStarted = false;
  if (windGain) windGain.gain.value = 0;
  if (waterGain) waterGain.gain.value = 0;
  if (birdGain) birdGain.gain.value = 0;
  windGain = waterGain = birdGain = null;
}

/** Levels are 0..1, derived by the caller from the player's position. */
export function setAmbientGains(water: number, birds: number) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  if (waterGain) waterGain.gain.value = 0.16 * clamp01(water);
  if (birdGain) birdGain.gain.value = 0.5 * clamp01(birds);
}
