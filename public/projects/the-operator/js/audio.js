import { getAudio } from './assets.js';
import { getAmbientVolume } from './interrogationAudio.js';

const GLOBAL_VOLUME_MAX = 0.09;
const GLOBAL_VOLUME_LOG_STRENGTH = 3;

let currentMusic = null;
let currentMusicBaseVolume = 0.6;
let audioCtx = null;
let lastTypewriterKeyAt = 0;
let volumeListenerInstalled = false;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function getMasterVolumeScale() {
  const normalized = clamp01(getAmbientVolume() / 100);
  const curved =
    Math.log1p(normalized * GLOBAL_VOLUME_LOG_STRENGTH) / Math.log1p(GLOBAL_VOLUME_LOG_STRENGTH);
  return clamp01(curved * GLOBAL_VOLUME_MAX);
}

function applyCurrentMusicVolume() {
  if (!currentMusic) {
    return;
  }
  currentMusic.volume = clamp01(currentMusicBaseVolume * getMasterVolumeScale());
}

function installVolumeListener() {
  if (volumeListenerInstalled || typeof window === 'undefined') {
    return;
  }
  volumeListenerInstalled = true;
  window.addEventListener('master-volume-changed', applyCurrentMusicVolume);
}

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window['webkitAudioContext'];
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

let distortionCurve = null;
function makeDistortionCurve(amount = 60) {
  const n = 1024;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function makeNoiseBuffer(ctx, durationSec) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playLightBuzz(durationMs = 80, intensity = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const masterScale = getMasterVolumeScale();
  if (masterScale <= 0) return;

  const now = ctx.currentTime;
  const dur = Math.max(0.03, durationMs / 1000);

  const gain = ctx.createGain();
  const peak = (0.05 + intensity * 0.07) * masterScale;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110 + Math.random() * 10, now);
  osc.frequency.linearRampToValueAtTime(92 + Math.random() * 8, now + dur);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(220 + Math.random() * 20, now);
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.35;

  const preGain = ctx.createGain();
  preGain.gain.value = 3 + intensity * 4;

  if (!distortionCurve) distortionCurve = makeDistortionCurve(80);
  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve;
  shaper.oversample = '4x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 480;
  filter.Q.value = 5;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur + 0.05);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.12 * intensity * masterScale;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 900;

  osc.connect(preGain);
  osc2.connect(gain2).connect(preGain);
  preGain.connect(shaper).connect(filter).connect(gain);
  noise.connect(noiseFilter).connect(noiseGain).connect(gain);
  gain.connect(ctx.destination);

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.14 + Math.random() * 0.04;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.55;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 1800;
  const wet = ctx.createGain();
  wet.gain.value = 0.45 * masterScale;

  gain.connect(delay);
  delay.connect(damp).connect(feedback).connect(delay);
  delay.connect(wet).connect(ctx.destination);

  const tail = 1.6;
  wet.gain.setValueAtTime(0.45 * masterScale, now + dur);
  wet.gain.exponentialRampToValueAtTime(0.0001, now + dur + tail);

  osc.start(now);
  osc2.start(now);
  noise.start(now);
  osc.stop(now + dur + 0.02);
  osc2.stop(now + dur + 0.02);
  noise.stop(now + dur + 0.05);
}

export function playTypewriterKey(volume = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const masterScale = getMasterVolumeScale();
  if (masterScale <= 0) return;

  const now = ctx.currentTime;
  if (now - lastTypewriterKeyAt < 0.012) {
    return;
  }
  lastTypewriterKeyAt = now;

  const v = clamp01(volume) * masterScale;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 120 + Math.random() * 40;

  gain.gain.setValueAtTime(0.0077 + 0.055 * v, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);

  const noiseLen = Math.max(64, Math.floor(ctx.sampleRate * 0.045));
  const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.2;
  }

  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0.0044 + 0.0242 * v, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.05);
}

export function playCaseCloseHit(intensity = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const masterScale = getMasterVolumeScale();
  if (masterScale <= 0) return;

  const now = ctx.currentTime;
  const k = Math.max(0.8, Math.min(2, intensity));

  const master = ctx.createGain();
  master.gain.value = 0.88 * masterScale;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30;
  comp.knee.value = 18;
  comp.ratio.value = 9;
  comp.attack.value = 0.001;
  comp.release.value = 0.16;

  const finalLp = ctx.createBiquadFilter();
  finalLp.type = 'lowpass';
  finalLp.frequency.value = 5200;

  master.connect(comp);
  comp.connect(finalLp);
  finalLp.connect(ctx.destination);

  const latch = ctx.createBufferSource();
  latch.buffer = makeNoiseBuffer(ctx, 0.03);
  const latchHp = ctx.createBiquadFilter();
  latchHp.type = 'highpass';
  latchHp.frequency.value = 3200;
  const latchPk = ctx.createBiquadFilter();
  latchPk.type = 'peaking';
  latchPk.frequency.value = 2200;
  latchPk.Q.value = 1.8;
  latchPk.gain.value = 5;
  const latchGain = ctx.createGain();
  latchGain.gain.setValueAtTime(0.0001, now);
  latchGain.gain.exponentialRampToValueAtTime(0.35 * k, now + 0.0009);
  latchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
  latch.connect(latchHp).connect(latchPk).connect(latchGain).connect(master);
  latch.start(now);
  latch.stop(now + 0.013);

  const shove = ctx.createBufferSource();
  shove.buffer = makeNoiseBuffer(ctx, 0.08);
  const shoveBp = ctx.createBiquadFilter();
  shoveBp.type = 'bandpass';
  shoveBp.frequency.value = 900;
  shoveBp.Q.value = 0.75;
  const shoveGain = ctx.createGain();
  shoveGain.gain.setValueAtTime(0.0001, now + 0.002);
  shoveGain.gain.exponentialRampToValueAtTime(0.26 * k, now + 0.014);
  shoveGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  shove.connect(shoveBp).connect(shoveGain).connect(master);
  shove.start(now + 0.002);
  shove.stop(now + 0.062);

  const slam = ctx.createBufferSource();
  slam.buffer = makeNoiseBuffer(ctx, 0.2);
  const slamLp = ctx.createBiquadFilter();
  slamLp.type = 'lowpass';
  slamLp.frequency.value = 2200;
  const slamHp = ctx.createBiquadFilter();
  slamHp.type = 'highpass';
  slamHp.frequency.value = 80;
  const slamPk = ctx.createBiquadFilter();
  slamPk.type = 'peaking';
  slamPk.frequency.value = 520;
  slamPk.Q.value = 0.9;
  slamPk.gain.value = 6;
  const slamGain = ctx.createGain();
  slamGain.gain.setValueAtTime(0.0001, now + 0.012);
  slamGain.gain.exponentialRampToValueAtTime(1.08 * k, now + 0.02);
  slamGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  slam.connect(slamLp).connect(slamHp).connect(slamPk).connect(slamGain).connect(master);
  slam.start(now + 0.012);
  slam.stop(now + 0.132);

  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(78, now + 0.013);
  thud.frequency.exponentialRampToValueAtTime(45, now + 0.12);
  const thudHp = ctx.createBiquadFilter();
  thudHp.type = 'highpass';
  thudHp.frequency.value = 62;
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.0001, now + 0.013);
  thudGain.gain.exponentialRampToValueAtTime(0.45 * k, now + 0.022);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  thud.connect(thudHp).connect(thudGain).connect(master);
  thud.start(now + 0.013);
  thud.stop(now + 0.145);

  const panel1 = ctx.createOscillator();
  panel1.type = 'triangle';
  panel1.frequency.setValueAtTime(260, now + 0.018);
  panel1.frequency.exponentialRampToValueAtTime(185, now + 0.09);
  const panel1Gain = ctx.createGain();
  panel1Gain.gain.setValueAtTime(0.0001, now + 0.018);
  panel1Gain.gain.exponentialRampToValueAtTime(0.33 * k, now + 0.028);
  panel1Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  panel1.connect(panel1Gain).connect(master);
  panel1.start(now + 0.018);
  panel1.stop(now + 0.112);

  const panel2 = ctx.createOscillator();
  panel2.type = 'triangle';
  panel2.frequency.setValueAtTime(430, now + 0.02);
  panel2.frequency.exponentialRampToValueAtTime(300, now + 0.08);
  const panel2Gain = ctx.createGain();
  panel2Gain.gain.setValueAtTime(0.0001, now + 0.02);
  panel2Gain.gain.exponentialRampToValueAtTime(0.23 * k, now + 0.028);
  panel2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
  panel2.connect(panel2Gain).connect(master);
  panel2.start(now + 0.02);
  panel2.stop(now + 0.097);

  const frameRattle = ctx.createBufferSource();
  frameRattle.buffer = makeNoiseBuffer(ctx, 0.14);
  const frameHp = ctx.createBiquadFilter();
  frameHp.type = 'highpass';
  frameHp.frequency.value = 1700;
  const frameGain = ctx.createGain();
  frameGain.gain.setValueAtTime(0.0001, now + 0.048);
  frameGain.gain.exponentialRampToValueAtTime(0.2 * k, now + 0.058);
  frameGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  frameRattle.connect(frameHp).connect(frameGain).connect(master);
  frameRattle.start(now + 0.048);
  frameRattle.stop(now + 0.142);
}

export function playCaseCloseSlam(intensity = 1) {
  const sample = getAudio('case-slam');
  if (sample) {
    playSfx('case-slam', Math.max(0, Math.min(1, 0.9 * intensity)));
    return;
  }
  playCaseCloseHit(intensity);
}

export function playSfx(name, volume = 1) {
  const source = getAudio(name);
  if (!source) {
    return;
  }

  const sound = source.cloneNode();
  sound.volume = clamp01(volume) * getMasterVolumeScale();
  sound.play().catch(() => {});
}

export function playMusic(name, loop = true, volume = 0.6) {
  installVolumeListener();

  const music = getAudio(name);
  if (!music) {
    return;
  }

  if (currentMusic && currentMusic !== music) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }

  currentMusic = music;
  currentMusic.loop = loop;
  currentMusicBaseVolume = clamp01(volume);
  applyCurrentMusicVolume();
  currentMusic.play().catch(() => {});
}

export function stopMusic() {
  if (!currentMusic) {
    return;
  }

  currentMusic.pause();
  currentMusic.currentTime = 0;
  currentMusic = null;
}
