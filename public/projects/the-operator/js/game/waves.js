import { clamp } from '../math.js';

const WINDOW_SECONDS = 8;
const SAMPLE_RATE = {
  heartRate: 256,
  gsr: 64,
  breathing: 32,
};

const BREATHING_PROFILES = {
  BASELINE: { rpm: 14, amp: 0.42, style: 'sine', jitter: 0.04 },
  DEEP: { rpm: 8, amp: 0.92, style: 'sine', jitter: 0.02 },
  SHALLOW: { rpm: 28, amp: 0.16, style: 'sine', jitter: 0.06 },
  UNEVEN: { rpm: 20, amp: 0.5, style: 'uneven', jitter: 0.22 },
  HOLDING_BREATH: { rpm: 6, amp: 0.2, style: 'hold', jitter: 0.02 },
  HYPERVENTILATION: { rpm: 48, amp: 0.34, style: 'sine', jitter: 0.1 },
  CRYING: { rpm: 22, amp: 0.58, style: 'cry', jitter: 0.35 },
};

const RELAX_BASELINE = {
  arousal: 0.24,
  cognitiveLoad: 0.26,
  painManipulation: 0.04,
  fatigue: 0.18,
  control: 0.58,
};

const METRIC_TO_DELTA = {
  BASELINE: { arousal: -0.06, cognitive: -0.04, pain: -0.1, control: 0.06, fatigue: 0.01 },
  DROP: { arousal: -0.2, cognitive: -0.08, pain: -0.1, control: 0.1, fatigue: 0.02 },
  DECREASE: { arousal: -0.14, cognitive: -0.06, pain: -0.08, control: 0.07, fatigue: 0.02 },
  INCREASE: { arousal: 0.16, cognitive: 0.14, pain: 0.05, control: -0.08, fatigue: 0.02 },
  SPIKE: { arousal: 0.28, cognitive: 0.18, pain: 0.1, control: -0.14, fatigue: 0.03 },
  ERRATIC: { arousal: 0.36, cognitive: 0.28, pain: 0.16, control: -0.22, fatigue: 0.04 },
  MAX_SPIKE: { arousal: 0.5, cognitive: 0.24, pain: 0.24, control: -0.28, fatigue: 0.05 },
  MAX: { arousal: 0.55, cognitive: 0.2, pain: 0.34, control: -0.32, fatigue: 0.06 },
};

function createRingBuffer(rate) {
  const size = Math.floor(rate * WINDOW_SECONDS);
  return {
    data: new Float32Array(size),
    size,
    count: 0,
    head: 0,
  };
}

function pushRing(buffer, value) {
  buffer.data[buffer.head] = value;
  buffer.head = (buffer.head + 1) % buffer.size;
  buffer.count = Math.min(buffer.count + 1, buffer.size);
}

function ringAtOffset(buffer, offset) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const clamped = clamp(offset, 0, buffer.count - 1);
  const idx = (buffer.head - 1 - clamped + buffer.size * 4) % buffer.size;
  return buffer.data[idx];
}

function ringAtOffsetLerp(buffer, offsetFloat) {
  const lo = Math.floor(offsetFloat);
  const hi = Math.min(lo + 1, Math.max(0, buffer.count - 1));
  const t = offsetFloat - lo;
  const a = ringAtOffset(buffer, lo);
  const b = ringAtOffset(buffer, hi);
  return a + (b - a) * t;
}

function pseudoNoise(time, seed) {
  return (
    Math.sin(time * (1.17 + seed * 0.05) + seed * 7.3) * 0.57 +
    Math.sin(time * (2.51 + seed * 0.03) + seed * 4.1) * 0.29 +
    Math.sin(time * (6.23 + seed * 0.02) + seed * 2.7) * 0.14
  );
}

function gaussian(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function ecgTemplate(phase) {
  const p = 0.12 * gaussian(phase, 0.18, 0.03);
  const q = -0.2 * gaussian(phase, 0.34, 0.012);
  const r = 1.4 * gaussian(phase, 0.37, 0.008);
  const s = -0.3 * gaussian(phase, 0.4, 0.014);
  const t = 0.3 * gaussian(phase, 0.63, 0.06);
  return p + q + r + s + t;
}

const DEFAULT_MODIFIERS = {
  heart_rate_suppression: 0,
  heart_rate_baseline_shift: 0,
  gsr_sensitivity: 1,
  gsr_baseline_shift: 0,
  breathing_instability: 0,
};

function normalizeModifiers(raw) {
  const m = { ...DEFAULT_MODIFIERS };
  if (!raw || typeof raw !== 'object') {
    return m;
  }
  for (const key of Object.keys(DEFAULT_MODIFIERS)) {
    const num = toFiniteNumber(raw[key]);
    if (num !== null) {
      m[key] = num;
    }
  }
  m.heart_rate_suppression = clamp(m.heart_rate_suppression, 0, 0.9);
  m.gsr_sensitivity = clamp(m.gsr_sensitivity, 0.4, 2.2);
  m.breathing_instability = clamp(m.breathing_instability, 0, 0.6);
  return m;
}

function createBiometricState() {
  return {
    time: 0,
    modifiers: { ...DEFAULT_MODIFIERS },
    latent: {
      ...RELAX_BASELINE,
    },
    drive: {
      sympathetic: 0.26,
      parasympathetic: 0.54,
    },
    ecg: {
      bpm: 72,
      rr: 0.83,
      beatTime: 0,
      hrvLf: 0,
      hrvHf: 0,
      artifactBurst: 0,
      qrsGain: 1,
      twaveGain: 1,
    },
    gsr: {
      tonic: 0.26,
      events: [],
      eventCooldown: 0,
    },
    breathing: {
      state: 'BASELINE',
      phase: 0,
      rpm: 14,
      amp: 0.42,
      style: 'sine',
      jitter: 0.04,
      holdTimer: 0,
      gaspEnvelope: 0,
      cycleJitter: 0,
    },
    readout: {
      bpm: 72,
      gsrUs: 6.8,
      breathingRpm: 14,
    },
    baseline: {
      bpm: 72,
      gsrUs: 6.8,
      breathingRpm: 14,
    },
    buffers: {
      heartRate: createRingBuffer(SAMPLE_RATE.heartRate),
      gsr: createRingBuffer(SAMPLE_RATE.gsr),
      breathing: createRingBuffer(SAMPLE_RATE.breathing),
    },
    accum: {
      heart: 0,
      gsr: 0,
      breathing: 0,
    },
    transient: {
      heartExcite: 0,
    },
  };
}

function applyDelta(latent, delta, weight = 1) {
  if (!delta) {
    return;
  }
  latent.arousal = clamp(latent.arousal + (delta.arousal || 0) * weight, 0, 1);
  latent.cognitiveLoad = clamp(latent.cognitiveLoad + (delta.cognitive || 0) * weight, 0, 1);
  latent.painManipulation = clamp(latent.painManipulation + (delta.pain || 0) * weight, 0, 1);
  latent.control = clamp(latent.control + (delta.control || 0) * weight, 0, 1);
  latent.fatigue = clamp(latent.fatigue + (delta.fatigue || 0) * weight, 0, 1);
}

function applyMechanicMetric(latent, metricValue, weight = 1) {
  applyDelta(latent, METRIC_TO_DELTA[metricValue], weight);
}

function normalizedMetric(value) {
  if (typeof value !== 'string') {
    return 'BASELINE';
  }
  const key = value.trim().toUpperCase();
  return METRIC_TO_DELTA[key] ? key : 'BASELINE';
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function triggerGsrEvent(model, intensity = 0.5) {
  const sensitivity = model.modifiers?.gsr_sensitivity ?? 1;
  const delay = 0.7 + Math.random() * 1.3;
  model.gsr.events.push({
    start: model.time + delay,
    amp: clamp(0.03 + intensity * 0.15 * sensitivity, 0.02, 0.45),
    riseTau: 0.35,
    decayTau: 2.6,
  });
}

function updateLatentAndDrive(model, dt) {
  const { latent, drive } = model;

  const symTarget = clamp(
    0.08 +
      latent.arousal * 0.5 +
      latent.cognitiveLoad * 0.18 +
      latent.painManipulation * 0.24 -
      latent.control * 0.14,
    0,
    1
  );
  drive.sympathetic += (symTarget - drive.sympathetic) * Math.min(1, dt * 2.9);
  drive.parasympathetic += (1 - symTarget * 0.82 - drive.parasympathetic) * Math.min(1, dt * 1.8);

  latent.arousal += (RELAX_BASELINE.arousal - latent.arousal) * Math.min(1, dt * 0.2);
  latent.cognitiveLoad +=
    (RELAX_BASELINE.cognitiveLoad - latent.cognitiveLoad) * Math.min(1, dt * 0.17);
  latent.painManipulation +=
    (RELAX_BASELINE.painManipulation - latent.painManipulation) * Math.min(1, dt * 0.58);
  latent.fatigue += (RELAX_BASELINE.fatigue - latent.fatigue) * Math.min(1, dt * 0.1);
  latent.control += (RELAX_BASELINE.control - latent.control) * Math.min(1, dt * 0.26);

  model.transient.heartExcite = Math.max(0, model.transient.heartExcite - dt * 0.55);
}

function updateEcgParams(model, dt) {
  const { ecg, drive, latent, time } = model;
  const baseBpm = model.baseline?.bpm ?? 72;
  const bpmTarget = clamp(
    baseBpm +
      (drive.sympathetic - 0.28) * 52 -
      (drive.parasympathetic - 0.54) * 18 +
      latent.painManipulation * 14,
    48,
    162
  );
  ecg.bpm += (bpmTarget - ecg.bpm) * Math.min(1, dt * 3.2);

  ecg.hrvLf = Math.sin(time * Math.PI * 2 * 0.1) * (0.02 + drive.parasympathetic * 0.02);
  ecg.hrvHf = Math.sin(time * Math.PI * 2 * 0.26 + 1.2) * (0.01 + drive.parasympathetic * 0.018);
  ecg.rr = clamp(60 / Math.max(ecg.bpm, 45) + ecg.hrvLf + ecg.hrvHf, 0.36, 1.4);

  const qrsTarget = clamp(
    0.9 + drive.sympathetic * 0.6 + latent.painManipulation * 0.22 - drive.parasympathetic * 0.1,
    0.75,
    1.85
  );
  const twaveTarget = clamp(
    0.95 + drive.sympathetic * 0.2 - latent.painManipulation * 0.15,
    0.7,
    1.35
  );
  ecg.qrsGain += (qrsTarget - ecg.qrsGain) * Math.min(1, dt * 2.6);
  ecg.twaveGain += (twaveTarget - ecg.twaveGain) * Math.min(1, dt * 2.2);

  if (latent.painManipulation > 0.4 && Math.random() < dt * 0.9) {
    ecg.artifactBurst = clamp(ecg.artifactBurst + 0.18, 0, 0.8);
  }
  ecg.artifactBurst = Math.max(0, ecg.artifactBurst - dt * 0.7);
}

function emitEcgSamples(model, dt) {
  model.accum.heart += dt;
  const step = 1 / SAMPLE_RATE.heartRate;
  let guard = 0;
  while (model.accum.heart >= step && guard < 1024) {
    guard += 1;
    model.accum.heart -= step;
    const t = model.time - model.accum.heart;

    model.ecg.beatTime += step;
    if (model.ecg.beatTime >= model.ecg.rr) {
      model.ecg.beatTime -= model.ecg.rr;
    }

    const phase = model.ecg.beatTime / model.ecg.rr;
    const base = ecgTemplate(phase);
    const shaped = base >= 0 ? base * model.ecg.qrsGain : base * (0.9 + model.ecg.qrsGain * 0.16);
    const baselineWander = Math.sin(t * Math.PI * 2 * 0.24) * 0.035;
    const emg = pseudoNoise(t * 7.3, 21) * (0.01 + model.latent.arousal * 0.02);
    const hum = Math.sin(t * Math.PI * 2 * 50) * 0.005;
    const motion = pseudoNoise(t * 3.2, 33) * model.ecg.artifactBurst * 0.06;
    const exciteGain = 1 + model.transient.heartExcite * 0.85;
    const sample = (shaped * exciteGain + baselineWander + emg + hum + motion) * 0.9;
    pushRing(model.buffers.heartRate, sample);
  }

  model.readout.bpm += (model.ecg.bpm - model.readout.bpm) * 0.22;
}

function emitGsrSamples(model, dt) {
  model.accum.gsr += dt;
  const step = 1 / SAMPLE_RATE.gsr;
  const stress = model.drive.sympathetic;
  const baseTonic = clamp(((model.baseline?.gsrUs ?? 6.8) - 2) / 13.5, 0.08, 1.1);
  const tonicTarget = clamp(
    baseTonic + (stress - 0.3) * 0.28 + model.latent.fatigue * 0.05,
    0.08,
    1.1
  );
  model.gsr.tonic += (tonicTarget - model.gsr.tonic) * Math.min(1, dt * 0.7);
  model.gsr.eventCooldown = Math.max(0, model.gsr.eventCooldown - dt);

  if (stress > 0.52 && model.gsr.eventCooldown <= 0 && Math.random() < dt * 0.8) {
    triggerGsrEvent(model, stress);
    model.gsr.eventCooldown = 0.65 + Math.random() * 1.2;
  }

  let guard = 0;
  while (model.accum.gsr >= step && guard < 512) {
    guard += 1;
    model.accum.gsr -= step;
    const tNow = model.time - model.accum.gsr;

    let phasic = 0;
    for (let i = model.gsr.events.length - 1; i >= 0; i -= 1) {
      const ev = model.gsr.events[i];
      const t = tNow - ev.start;
      if (t < 0) {
        continue;
      }
      const value = ev.amp * (Math.exp(-t / ev.decayTau) - Math.exp(-t / ev.riseTau));
      phasic += Math.max(0, value);
      if (t > 8) {
        model.gsr.events.splice(i, 1);
      }
    }

    const drift = pseudoNoise(tNow * 0.15, 73) * 0.008;
    const motion = pseudoNoise(tNow * 0.8, 89) * model.latent.painManipulation * 0.01;
    const sample = clamp(model.gsr.tonic + phasic + drift + motion, 0.02, 1.4);
    pushRing(model.buffers.gsr, sample);
  }

  const latest = ringAtOffset(model.buffers.gsr, 0);
  const us = clamp(2 + latest * 13.5, 1.5, 22);
  model.readout.gsrUs += (us - model.readout.gsrUs) * 0.16;
}

function emitBreathingSamples(model, dt) {
  model.accum.breathing += dt;
  const step = 1 / SAMPLE_RATE.breathing;
  const br = model.breathing;
  const profile = BREATHING_PROFILES[br.state] || BREATHING_PROFILES.BASELINE;

  br.rpm += (profile.rpm - br.rpm) * Math.min(1, dt * 1.4);
  br.amp += (profile.amp - br.amp) * Math.min(1, dt * 1.6);
  br.jitter += (profile.jitter - br.jitter) * Math.min(1, dt * 1.2);
  br.style = profile.style;

  let guard = 0;
  while (model.accum.breathing >= step && guard < 256) {
    guard += 1;
    model.accum.breathing -= step;
    const t = model.time - model.accum.breathing;
    const freq = br.rpm / 60;

    br.phase += freq * step * Math.PI * 2;
    if (br.phase > Math.PI * 2) br.phase -= Math.PI * 2;

    let sample = 0;
    if (br.style === 'sine') {
      sample = Math.sin(br.phase) * br.amp;
    } else if (br.style === 'uneven') {
      const skew = Math.sin(br.phase) + Math.sin(br.phase * 2.3 + 1.1) * 0.4;
      sample = skew * br.amp * 0.72;
    } else if (br.style === 'hold') {
      br.holdTimer += step;
      const cycle = 60 / Math.max(br.rpm, 1);
      if (br.holdTimer < cycle * 0.78) {
        sample = br.amp * 0.82;
        sample += (Math.random() - 0.5) * 0.02;
      } else {
        const gaspT = (br.holdTimer - cycle * 0.78) / Math.max(cycle * 0.22, 0.05);
        if (gaspT < 1) {
          sample = br.amp * (0.82 - gaspT * 2.2);
        } else {
          br.holdTimer = 0;
          sample = br.amp * 0.82;
        }
      }
    } else if (br.style === 'cry') {
      const base = Math.sin(br.phase) * br.amp;
      const tremor = Math.sin(br.phase * 7.3 + t * 11) * br.amp * 0.18;
      const hitch = Math.sin(br.phase * 3.1) > 0.6 ? pseudoNoise(t * 4.2, 19) * br.amp * 0.35 : 0;
      sample = base + tremor + hitch;
    }

    const instability = model.modifiers?.breathing_instability ?? 0;
    const jitter = (Math.random() - 0.5) * (br.jitter + instability * 0.4);
    pushRing(model.buffers.breathing, sample + jitter);
  }

  model.readout.breathingRpm += (br.rpm - model.readout.breathingRpm) * 0.18;
}

function syncLegacyWave(state) {
  const heart = Math.abs(ringAtOffset(state.biometric.buffers.heartRate, 0));
  const gsr = Math.abs(ringAtOffset(state.biometric.buffers.gsr, 0));

  state.wave.heartRate.amp = clamp(0.05 + heart * 0.82, 0.02, 1);
  state.wave.gsr.amp = clamp(0.04 + gsr * 0.45, 0.02, 1);

  state.wave.heartRate.freq = clamp(state.biometric.readout.bpm / 55, 0.6, 3.8);
  state.wave.gsr.freq = clamp(0.35 + state.biometric.drive.sympathetic * 0.8, 0.35, 1.8);

  state.wave.heartRate.noise = clamp(
    0.015 + state.biometric.latent.painManipulation * 0.12,
    0.01,
    0.2
  );
  state.wave.gsr.noise = clamp(0.006 + state.biometric.latent.painManipulation * 0.04, 0.005, 0.09);
}

function warmupModel(model, seconds = 4) {
  const dt = 1 / 60;
  const steps = Math.floor(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    model.time += dt;
    updateLatentAndDrive(model, dt);
    updateEcgParams(model, dt);
    emitEcgSamples(model, dt);
    emitGsrSamples(model, dt);
    emitBreathingSamples(model, dt);
  }
}

function applyBaselineMetricsToModel(model, baseline = {}) {
  const latent = model.latent;
  const hrShift = model.modifiers?.heart_rate_baseline_shift ?? 0;
  const gsrShift = model.modifiers?.gsr_baseline_shift ?? 0;

  const heartRaw = toFiniteNumber(baseline.heartRate);
  const gsrRaw = toFiniteNumber(baseline.gsr);
  const heartNumeric = heartRaw !== null ? heartRaw + hrShift : null;
  const gsrNumeric = gsrRaw !== null ? gsrRaw + gsrShift : null;

  if (heartNumeric !== null || gsrNumeric !== null) {
    const bpm = clamp(heartNumeric ?? 72, 48, 170);
    const gsrUs = clamp(gsrNumeric ?? 6.8, 1.5, 25);

    model.ecg.bpm = bpm;
    model.ecg.rr = clamp(60 / bpm, 0.36, 1.4);
    model.readout.bpm = bpm;
    model.baseline.bpm = bpm;

    const gsrNorm = (gsrUs - 1.5) / (25 - 1.5);
    model.gsr.tonic = clamp((gsrUs - 2) / 13.5, 0.08, 1.1);
    model.readout.gsrUs = gsrUs;
    model.baseline.gsrUs = gsrUs;

    latent.arousal = clamp(0.16 + gsrNorm * 0.52 + (bpm - 55) / 140, 0, 1);
    latent.cognitiveLoad = clamp(0.2 + gsrNorm * 0.28, 0, 1);
    latent.painManipulation = clamp(0.02 + gsrNorm * 0.08, 0, 1);
    latent.control = clamp(0.7 - gsrNorm * 0.18, 0, 1);
    latent.fatigue = clamp(0.1 + (1 - gsrNorm) * 0.18, 0, 1);
  } else {
    const heart = normalizedMetric(baseline.heartRate);
    const gsr = normalizedMetric(baseline.gsr);
    applyMechanicMetric(latent, heart, 0.6);
    applyMechanicMetric(latent, gsr, 0.54);
    model.baseline.bpm = model.readout.bpm;
    model.baseline.gsrUs = model.readout.gsrUs;
  }

  for (let i = 0; i < 180; i += 1) {
    const dt = 1 / 60;
    model.time += dt;
    updateLatentAndDrive(model, dt);
    updateEcgParams(model, dt);
    emitEcgSamples(model, dt);
    emitGsrSamples(model, dt);
    emitBreathingSamples(model, dt);
  }
}

export function initBiometricsOnState(state, baseline, modifiers) {
  state.biometric = createBiometricState();
  state.biometric.modifiers = normalizeModifiers(modifiers);
  warmupModel(state.biometric, 4);
  applyBaselineMetricsToModel(state.biometric, baseline);
}

export function resetBiometricsOnState(state, baseline, modifiers) {
  state.biometric = createBiometricState();
  state.biometric.modifiers = normalizeModifiers(modifiers);
  warmupModel(state.biometric, 4);
  applyBaselineMetricsToModel(state.biometric, baseline);
  syncLegacyWave(state);
}

export function settleBiometricsForNextQuestion(state) {
  if (!state.biometric) {
    return;
  }

  const model = state.biometric;

  model.latent.arousal = RELAX_BASELINE.arousal;
  model.latent.cognitiveLoad = RELAX_BASELINE.cognitiveLoad;
  model.latent.painManipulation = RELAX_BASELINE.painManipulation;
  model.latent.fatigue = RELAX_BASELINE.fatigue;
  model.latent.control = RELAX_BASELINE.control;

  model.drive.sympathetic = 0.26;
  model.drive.parasympathetic = 0.54;

  model.transient.heartExcite = 0;
  model.ecg.artifactBurst = 0;

  model.gsr.events = [];
  model.gsr.eventCooldown = 0;

  model.breathing.state = 'BASELINE';
  const baseBreathing = BREATHING_PROFILES.BASELINE;
  model.breathing.rpm = baseBreathing.rpm;
  model.breathing.amp = baseBreathing.amp;
  model.breathing.style = baseBreathing.style;
  model.breathing.jitter = baseBreathing.jitter;
  model.breathing.phase = 0;
  model.breathing.holdTimer = 0;
  model.breathing.gaspEnvelope = 0;
  model.breathing.cycleJitter = 0;

  model.readout.breathingRpm = baseBreathing.rpm;

  model.accum.breathing = 0;
}

export function applyMechanicsToBiometrics(state, mechanics) {
  if (!state.biometric) {
    state.biometric = createBiometricState();
    warmupModel(state.biometric, 2);
  }

  const latent = state.biometric.latent;
  applyMechanicMetric(latent, mechanics.heart_rate, 0.84);
  applyMechanicMetric(latent, mechanics.gsr, 0.72);

  const heartExciteMap = {
    DROP: 0,
    DECREASE: 0.08,
    BASELINE: 0.12,
    INCREASE: 0.35,
    SPIKE: 0.62,
    ERRATIC: 0.78,
    MAX_SPIKE: 0.95,
    MAX: 1,
  };
  const heartSuppress = state.biometric.modifiers?.heart_rate_suppression ?? 0;
  const heartExciteRaw = heartExciteMap[mechanics.heart_rate] ?? 0.2;
  state.biometric.transient.heartExcite = Math.max(
    state.biometric.transient.heartExcite,
    heartExciteRaw * (1 - heartSuppress)
  );

  const breathingMap = {
    BASELINE: { arousal: -0.03, control: 0.03 },
    DEEP: { arousal: -0.17, control: 0.15, cognitive: -0.05 },
    SHALLOW: { arousal: 0.16, control: -0.08, cognitive: 0.06 },
    HOLDING_BREATH: { arousal: 0.2, pain: 0.2, control: -0.08 },
    HYPERVENTILATION: { arousal: 0.32, cognitive: 0.12, control: -0.18 },
    CRYING: { arousal: 0.2, control: -0.24, fatigue: 0.08, cognitive: -0.05 },
  };
  applyDelta(latent, breathingMap[mechanics.breathing], 1);
  if (mechanics.breathing && BREATHING_PROFILES[mechanics.breathing]) {
    state.biometric.breathing.state = mechanics.breathing;
    state.biometric.breathing.holdTimer = 0;
  }

  const cctvMap = {
    EYE_DART: { arousal: 0.19, cognitive: 0.22, control: -0.11 },
    LOOK_DOWN: { arousal: 0.11, control: -0.11, fatigue: 0.05 },
    RELIEVED_EXHALE: { arousal: -0.18, control: 0.16 },
    HAND_PINCH_UNDER_TABLE: { pain: 0.38, arousal: 0.16, cognitive: 0.05 },
    DEFENSIVE_CROSS_ARMS: { control: 0.18, cognitive: -0.12, arousal: -0.05 },
    BREAKDOWN: { control: -0.35, arousal: 0.22, fatigue: 0.13 },
    STONE_FACE: { control: 0.23, cognitive: -0.14, arousal: -0.04 },
    EMPTY_STARE: { control: -0.18, cognitive: -0.3, fatigue: 0.18 },
    JAW_TIGHTEN: { arousal: 0.18, pain: 0.07, control: -0.06 },
    RELEASED_SHOULDERS: { arousal: -0.22, control: 0.19, cognitive: -0.08 },
    LIP_PRESS: { arousal: 0.12, cognitive: 0.16, control: -0.1 },
    TEAR_POOLING: { control: -0.22, fatigue: 0.11, arousal: 0.14 },
  };
  applyDelta(latent, cctvMap[mechanics.cctv_visual], 1);

  triggerGsrEvent(
    state.biometric,
    clamp(0.25 + latent.arousal * 0.55 + latent.cognitiveLoad * 0.38, 0.1, 1)
  );
  if (latent.painManipulation > 0.36) {
    state.biometric.ecg.artifactBurst = clamp(state.biometric.ecg.artifactBurst + 0.2, 0, 0.9);
  }
}

export function updateWave(state, dt) {
  if (!state.biometric) {
    initBiometricsOnState(state);
  }

  const model = state.biometric;
  model.time += dt;
  updateLatentAndDrive(model, dt);
  updateEcgParams(model, dt);
  emitEcgSamples(model, dt);
  emitGsrSamples(model, dt);
  emitBreathingSamples(model, dt);
  syncLegacyWave(state);
}

export function getBiometricDrawData(state) {
  if (!state.biometric) {
    initBiometricsOnState(state);
  }
  return {
    sampleRate: SAMPLE_RATE,
    buffers: state.biometric.buffers,
    readout: state.biometric.readout,
    sampleAt: (metric, offsetFloat) =>
      ringAtOffsetLerp(state.biometric.buffers[metric], offsetFloat),
  };
}
