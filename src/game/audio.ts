let ctx: AudioContext | null = null;
let muted = false;
let rumbleStop: (() => void) | null = null;

function ac(): AudioContext | null {
  if (muted) return null;
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(next: boolean) {
  muted = next;
  if (next) stopRumble();
}

export function unlockAudio() {
  ac();
}

function envGain(audio: AudioContext, duration: number, peak: number) {
  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  gain.connect(audio.destination);
  return gain;
}

export function playChip() {
  const audio = ac();
  if (!audio) return;
  const osc = audio.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 740 + Math.random() * 80;
  const gain = envGain(audio, 0.07, 0.05);
  osc.connect(gain);
  osc.start();
  osc.stop(audio.currentTime + 0.08);
}

export function playClack(strength = 1) {
  const audio = ac();
  if (!audio) return;
  const length = Math.floor(audio.sampleRate * 0.045);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400 + Math.random() * 900;
  filter.Q.value = 0.7;
  const gain = envGain(audio, 0.05, 0.08 * Math.min(1.4, strength));
  src.connect(filter);
  filter.connect(gain);
  src.start();
}

export function playThud(strength = 1) {
  const audio = ac();
  if (!audio) return;
  const now = audio.currentTime;
  const body = 0.14 * Math.min(1.35, Math.max(0.35, strength));
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
  osc.frequency.exponentialRampToValueAtTime(62, now + 0.14);
  const low = audio.createGain();
  low.gain.setValueAtTime(0.0001, now);
  low.gain.exponentialRampToValueAtTime(body, now + 0.01);
  low.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(low);
  low.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  const length = Math.floor(audio.sampleRate * 0.05);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900 + Math.random() * 400;
  const tick = audio.createGain();
  tick.gain.setValueAtTime(0.0001, now);
  tick.gain.exponentialRampToValueAtTime(body * 0.7, now + 0.006);
  tick.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  src.connect(filter);
  filter.connect(tick);
  tick.connect(audio.destination);
  src.start(now);
}

export function playWin() {
  const audio = ac();
  if (!audio) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = audio.createGain();
    const t = audio.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

export function playLose() {
  const audio = ac();
  if (!audio) return;
  [220, 146].forEach((freq, i) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = audio.createGain();
    const t = audio.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

export function startRumble() {
  stopRumble();
  const audio = ac();
  if (!audio) return;
  const length = audio.sampleRate;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < length; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.96;
    data[i] = brown;
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  const gain = audio.createGain();
  gain.gain.value = 0.045;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  src.start();
  rumbleStop = () => {
    const now = audio.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    src.stop(now + 0.14);
    rumbleStop = null;
  };
}

export function stopRumble() {
  rumbleStop?.();
  rumbleStop = null;
}
