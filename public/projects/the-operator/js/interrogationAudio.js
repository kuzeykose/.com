import './interrogationSound.js';

const AMBIENT_VOLUME_KEY = 'the-operator:ambient-volume:v1';
const AMBIENT_VOLUME_MAX = 9;
const AMBIENT_VOLUME_LOG_STRENGTH = 3;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function clamp100(v) {
  return Math.max(0, Math.min(100, v));
}

function getEngineVolumePercent(uiVolume) {
  const normalized = clamp01(uiVolume / 100);
  const curved =
    Math.log1p(normalized * AMBIENT_VOLUME_LOG_STRENGTH) / Math.log1p(AMBIENT_VOLUME_LOG_STRENGTH);
  return clamp100(curved * AMBIENT_VOLUME_MAX);
}

function blend(from, to, amount = 0.35) {
  return from + (to - from) * amount;
}

function mapMechanicLevel(value, table) {
  return table[String(value || '').toUpperCase()] || 0;
}

function stressFromEvidence(evidence) {
  const hr = mapMechanicLevel(evidence.heartRate, {
    STABLE: 0,
    BASELINE: 0,
    RISE: 0.22,
    INCREASE: 0.28,
    SPIKE: 0.5,
    MAX_SPIKE: 0.75,
    DROP: -0.18,
  });
  const gsr = mapMechanicLevel(evidence.gsr, {
    BASELINE: 0,
    DECREASE: -0.18,
    INCREASE: 0.24,
    SPIKE: 0.44,
    SURGE: 0.58,
    MAX: 0.72,
  });
  const breathing = mapMechanicLevel(evidence.breathing, {
    BASELINE: 0,
    CALM: -0.05,
    DEEP: -0.08,
    SHALLOW: 0.18,
    UNEVEN: 0.26,
    HOLDING_BREATH: 0.45,
    HYPERVENTILATION: 0.6,
    CRYING: 0.55,
  });
  return clamp01(0.45 * hr + 0.3 * gsr + 0.25 * breathing + 0.25);
}

const TYPE_SIGNAL = {
  EMPATHIC: { fear: 0.08, excitement: 0.3 },
  ANALYTICAL: { fear: 0.14, excitement: 0.1 },
  EVIDENCE: { fear: 0.34, excitement: 0.18 },
  FORENSIC_CALL_OUT: { fear: 0.42, excitement: 0.22 },
  NARROW_TARGET: { fear: 0.4, excitement: 0.2 },
  TRAP: { fear: 0.48, excitement: 0.22 },
  AGGRESSIVE: { fear: 0.36, excitement: 0.16 },
  PRESSURE: { fear: 0.44, excitement: 0.2 },
  LEGAL_THREAT: { fear: 0.5, excitement: 0.08 },
  MORAL_PRESSURE: { fear: 0.32, excitement: 0.28 },
  STRATEGIC: { fear: 0.26, excitement: 0.18 },
  SYSTEMIC_READ: { fear: 0.28, excitement: 0.12 },
  GULLIBLE: { fear: 0.02, excitement: 0.06 },
};

function parseDialogueSignals(evidence) {
  const type = String(evidence.choiceType || '').toUpperCase();
  const base = TYPE_SIGNAL[type] || { fear: 0.12, excitement: 0.1 };

  let fear = base.fear;
  let excitement = base.excitement;

  fear += mapMechanicLevel(evidence.heartRate, {
    BASELINE: 0,
    STABLE: -0.04,
    RISE: 0.1,
    INCREASE: 0.12,
    SPIKE: 0.22,
    MAX_SPIKE: 0.3,
    DROP: -0.08,
  });
  fear += mapMechanicLevel(evidence.gsr, {
    BASELINE: 0,
    DECREASE: -0.1,
    INCREASE: 0.12,
    SPIKE: 0.2,
    SURGE: 0.28,
    MAX: 0.34,
  });
  fear += mapMechanicLevel(evidence.breathing, {
    BASELINE: 0,
    CALM: -0.04,
    DEEP: -0.06,
    SHALLOW: 0.08,
    UNEVEN: 0.14,
    HOLDING_BREATH: 0.22,
    HYPERVENTILATION: 0.28,
    CRYING: 0.24,
  });

  excitement += mapMechanicLevel(evidence.heartRate, {
    BASELINE: 0,
    STABLE: -0.04,
    RISE: 0.06,
    INCREASE: 0.08,
    SPIKE: 0.12,
    MAX_SPIKE: 0.16,
    DROP: -0.08,
  });
  excitement += mapMechanicLevel(evidence.breathing, {
    CALM: -0.04,
    DEEP: -0.02,
    SHALLOW: 0.06,
    UNEVEN: 0.1,
    HOLDING_BREATH: 0.12,
    HYPERVENTILATION: 0.16,
    CRYING: 0.04,
  });

  if ((evidence.fearDelta || 0) > 18) fear += 0.18;
  if ((evidence.fearDelta || 0) < -8) {
    fear -= 0.18;
    excitement -= 0.1;
  }

  return {
    fear: clamp01(fear),
    excitement: clamp01(excitement),
  };
}

function scoreChoiceStress(choice) {
  const mechanics = choice?.mechanics || {};
  const fearDelta = Number(mechanics.korku_bari_delta || 0);
  const type = String(choice?.type || '').toUpperCase();

  const stress = clamp01(
    0.4 *
      mapMechanicLevel(mechanics.heart_rate, {
        BASELINE: 0,
        STABLE: -0.06,
        RISE: 0.16,
        INCREASE: 0.22,
        SPIKE: 0.45,
        MAX_SPIKE: 0.62,
        DROP: -0.2,
      }) +
      0.35 *
        mapMechanicLevel(mechanics.gsr, {
          BASELINE: 0,
          DECREASE: -0.18,
          INCREASE: 0.24,
          SPIKE: 0.44,
          SURGE: 0.58,
          MAX: 0.72,
        }) +
      0.25 *
        mapMechanicLevel(mechanics.breathing, {
          BASELINE: 0,
          CALM: -0.04,
          DEEP: -0.06,
          SHALLOW: 0.16,
          UNEVEN: 0.28,
          HOLDING_BREATH: 0.48,
          HYPERVENTILATION: 0.58,
          CRYING: 0.42,
        }) +
      (fearDelta / 100) * 0.3 +
      mapMechanicLevel(type, {
        EMPATHIC: -0.08,
        ANALYTICAL: -0.04,
        GULLIBLE: -0.12,
        STRATEGIC: 0.08,
        EVIDENCE: 0.14,
        NARROW_TARGET: 0.2,
        FORENSIC_CALL_OUT: 0.22,
        MORAL_PRESSURE: 0.18,
        AGGRESSIVE: 0.2,
        PRESSURE: 0.22,
        TRAP: 0.26,
        LEGAL_THREAT: 0.3,
        SYSTEMIC_READ: 0.12,
      })
  );

  return stress;
}

function nodeAtmosphereFromMarkers(node, nodeId = '') {
  if (!node) {
    return { mood: 'tense', tension: 18, mod: 'calm', intensity: 0 };
  }

  if (node.is_end_state) {
    const id = String(nodeId || '').toLowerCase();
    if (id.includes('success')) {
      return { mood: 'reveal', tension: 30, mod: 'excited', intensity: 22 };
    }
    if (id.includes('fail')) {
      return { mood: 'silent', tension: 14, mod: 'afraid', intensity: 18 };
    }
    return { mood: 'reveal', tension: 24, mod: 'calm', intensity: 8 };
  }

  const choices = Array.isArray(node.choices) ? node.choices : [];
  if (choices.length === 0) {
    return { mood: 'tense', tension: 22, mod: 'calm', intensity: 0 };
  }

  let sum = 0;
  let peak = 0;
  let countEscalating = 0;
  for (const choice of choices) {
    const stress = scoreChoiceStress(choice);
    sum += stress;
    peak = Math.max(peak, stress);
    if (stress >= 0.55) {
      countEscalating += 1;
    }
  }
  const avg = sum / choices.length;
  const escalateRatio = countEscalating / choices.length;

  if (avg < 0.18 && peak < 0.35) {
    return { mood: 'cold', tension: 12, mod: 'calm', intensity: 0 };
  }
  if (avg > 0.55 || peak > 0.78 || escalateRatio > 0.45) {
    return { mood: 'breaking', tension: 54, mod: 'both', intensity: 34 };
  }
  if (avg > 0.34) {
    return { mood: 'tense', tension: 34, mod: 'afraid', intensity: 16 };
  }
  return { mood: 'tense', tension: 22, mod: 'calm', intensity: 6 };
}

let scene = null;
let available = true;
let activeProfile = 'title';
let autoplayUnlockInstalled = false;
let ambientVolume = 50;
const runtimeMix = {
  mod: 'calm',
  modIntensity: 0,
  tension: 10,
  room: 42,
  rain: 12,
  drone: 48,
  rumble: 28,
};

const triggerCooldownAt = new Map();

try {
  const raw = localStorage.getItem(AMBIENT_VOLUME_KEY);
  const saved = raw == null || String(raw).trim() === '' ? NaN : Number(raw);
  if (Number.isFinite(saved)) {
    ambientVolume = clamp100(saved);
  }
} catch {}

function triggerWithCooldown(s, id, cooldownMs = 800) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = triggerCooldownAt.get(id) || 0;
  if (now - last < cooldownMs) {
    return;
  }
  triggerCooldownAt.set(id, now);
  s.trigger(id);
}

function applyModSmooth(s, nextMod, targetIntensity, amount = 0.35) {
  const smoothedIntensity = clamp100(blend(runtimeMix.modIntensity, targetIntensity, amount));
  if (runtimeMix.mod !== nextMod) {
    runtimeMix.mod = nextMod;
    runtimeMix.modIntensity = smoothedIntensity;
    s.setMod(nextMod, smoothedIntensity);
    return;
  }
  runtimeMix.modIntensity = smoothedIntensity;
  s.setModIntensity(smoothedIntensity);
}

function setDynamicLayerSmooth(s, key, target, amount = 0.35) {
  const next = clamp100(blend(runtimeMix[key], target, amount));
  runtimeMix[key] = next;
  s.setLayer(key, next);
}

function shouldAllowHeartPulseLayers() {
  return activeProfile === 'play';
}

function shouldTriggerDeskSlam(evidence, pressure, fearScore, intensity) {
  if (!shouldAllowHeartPulseLayers()) return false;

  const type = String(evidence.choiceType || '').toUpperCase();
  const isCorneringType =
    type === 'TRAP' ||
    type === 'FORENSIC_CALL_OUT' ||
    type === 'NARROW_TARGET' ||
    type === 'LEGAL_THREAT' ||
    type === 'PRESSURE';

  const isCornered =
    (evidence.fearDelta || 0) >= 18 || pressure >= 0.68 || fearScore >= 0.7 || intensity >= 70;

  if (!isCornered) return false;

  const chance = isCorneringType ? 0.45 : 0.22;
  return Math.random() < chance;
}

function ensureScene() {
  if (!available) return null;
  if (scene) return scene;

  const Ctor = globalThis.InterrogationSound;
  if (!Ctor) {
    available = false;
    return null;
  }

  scene = new Ctor({
    volume: getEngineVolumePercent(ambientVolume) / 100,
    mood: 'tense',
    tension: 10,
    autoEvents: true,
    eventInterval: [3200, 8200],
  });

  scene.toggleLayer('air', false);
  scene.setLayer('room', 42);
  scene.setLayer('radio', 10);
  scene.setLayer('drone', 48);
  scene.setLayer('rumble', 28);
  scene.setLayer('pulse', 16);
  return scene;
}

export function getAmbientVolume() {
  return ambientVolume;
}

export function setAmbientVolume(nextVolume) {
  ambientVolume = clamp100(nextVolume);
  try {
    localStorage.setItem(AMBIENT_VOLUME_KEY, String(ambientVolume));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('master-volume-changed'));
  }
  if (scene) {
    scene.setVolume(getEngineVolumePercent(ambientVolume));
  }
}

function installAutoplayUnlock() {
  if (autoplayUnlockInstalled || typeof window === 'undefined') return;
  autoplayUnlockInstalled = true;

  const unlock = () => {
    const s = ensureScene();
    if (!s) return;
    s.play();
    applyAmbientProfile(activeProfile);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

export function enterInterrogationAudio() {
  const s = ensureScene();
  if (!s) return;
  activeProfile = 'play';
  s.play();
  s.setMood('tense');
  s.setVolume(getEngineVolumePercent(ambientVolume));
  s.setMod('calm', 0);
  s.setTension(10);
  runtimeMix.mod = 'calm';
  runtimeMix.modIntensity = 0;
  runtimeMix.tension = 10;
}

export function stopInterrogationAudio() {
  if (!scene) return;
  scene.stop();
}

function seedTitleMusicalCue(s) {
  if (!s) return;
  triggerWithCooldown(s, 'piano', 0);
  setTimeout(() => triggerWithCooldown(s, 'piano', 0), 260);
  setTimeout(() => triggerWithCooldown(s, 'organ', 0), 520);
}

export function applyAmbientProfile(profile) {
  const s = ensureScene();
  if (!s) return;
  activeProfile = profile;
  s.play();
  installAutoplayUnlock();

  if (profile === 'title') {
    s.setMood('cold');
    s.setMod('calm', 0);
    s.setTension(6);
    s.setVolume(getEngineVolumePercent(ambientVolume));
    s.setLayer('room', 46);
    s.setLayer('rain', 16);
    s.setLayer('drone', 34);
    s.setLayer('organ', 26);
    s.setLayer('piano', 58);
    s.setLayer('cello', 20);
    s.setLayer('rumble', 8);
    s.setLayer('radio', 0);
    s.setLayer('clock', 0);
    s.setLayer('pulse', 0);
    s.toggleLayer('air', false);
    seedTitleMusicalCue(s);
    return;
  }

  if (profile === 'menu') {
    s.setMood('cold');
    s.setMod('calm', 0);
    s.setTension(12);
    s.setVolume(getEngineVolumePercent(ambientVolume));
    s.setLayer('room', 44);
    s.setLayer('rain', 14);
    s.setLayer('drone', 40);
    s.setLayer('organ', 28);
    s.setLayer('piano', 42);
    s.setLayer('cello', 16);
    s.setLayer('rumble', 12);
    s.setLayer('radio', 8);
    s.setLayer('clock', 0);
    s.setLayer('pulse', 0);
    s.toggleLayer('air', false);
    return;
  }

  if (profile === 'verdict') {
    s.setMood('breaking');
    s.setMod('both', 42);
    s.setTension(58);
    s.setVolume(getEngineVolumePercent(ambientVolume));
    s.setLayer('room', 28);
    s.setLayer('rain', 7);
    s.setLayer('drone', 68);
    s.setLayer('rumble', 62);
    s.setLayer('clock', 0);
    s.setLayer('pulse', 0);
    return;
  }

  if (profile === 'result-good') {
    s.setMood('reveal');
    s.setMod('excited', 20);
    s.setTension(24);
    s.setVolume(getEngineVolumePercent(ambientVolume));
    s.setLayer('piano', 72);
    s.setLayer('organ', 42);
    s.setLayer('room', 36);
    s.setLayer('rain', 10);
    s.setLayer('rumble', 18);
    s.setLayer('clock', 0);
    s.setLayer('pulse', 0);
    return;
  }

  if (profile === 'result-bad') {
    s.setMood('silent');
    s.setMod('afraid', 34);
    s.setTension(30);
    s.setVolume(getEngineVolumePercent(ambientVolume));
    s.setLayer('room', 54);
    s.setLayer('rain', 17);
    s.setLayer('drone', 44);
    s.setLayer('organ', 18);
    s.setLayer('piano', 20);
    s.setLayer('radio', 10);
    s.setLayer('clock', 0);
    s.setLayer('pulse', 0);
    s.trigger('metal');
  }
}

export function startBootAmbient() {
  applyAmbientProfile('title');
}

export function applyNodeAtmosphere(node, nodeId = '') {
  const s = ensureScene();
  if (!s || !node) return;

  const profile = nodeAtmosphereFromMarkers(node, nodeId);

  s.setMood(profile.mood);
  runtimeMix.tension = blend(runtimeMix.tension, profile.tension, 0.45);
  s.setTension(runtimeMix.tension);
  applyModSmooth(s, profile.mod, profile.intensity, 0.45);
}

export function applyDialogueAudio(evidence, fearBar, maxFearBar) {
  const s = ensureScene();
  if (!s || !evidence) return;

  const pressure = stressFromEvidence(evidence);
  const signal = parseDialogueSignals(evidence);
  const fearRatio = maxFearBar > 0 ? clamp01(fearBar / maxFearBar) : 0;

  const fearScore = clamp01(pressure * 0.62 + signal.fear * 0.38 + fearRatio * 0.2);
  const excitementScore = clamp01(
    pressure * 0.35 + signal.excitement * 0.65 + Math.max(0, evidence.fearDelta || 0) / 90
  );

  let mod = 'calm';
  if (fearScore > 0.55 && excitementScore > 0.45) mod = 'both';
  else if (fearScore > excitementScore + 0.08) mod = 'afraid';
  else if (excitementScore > 0.38) mod = 'excited';

  const intensity = clamp100(
    18 +
      fearRatio * 34 +
      pressure * 32 +
      Math.max(fearScore, excitementScore) * 26 +
      (evidence.fearDelta || 0) * 0.6
  );

  applyModSmooth(s, mod, intensity, 0.35);

  if (evidence.fearDelta >= 25 || pressure >= 0.72) {
    if (shouldTriggerDeskSlam(evidence, pressure, fearScore, intensity)) {
      triggerWithCooldown(s, 'slam', 2200);
    }
    triggerWithCooldown(s, 'metal', 900);
  } else if (evidence.fearDelta >= 14 || fearScore >= 0.62) {
    if (shouldTriggerDeskSlam(evidence, pressure, fearScore, intensity)) {
      triggerWithCooldown(s, 'slam', 2600);
    }
    triggerWithCooldown(s, 'chair', 850);
  }

  if (shouldAllowHeartPulseLayers() && excitementScore >= 0.58) {
    triggerWithCooldown(s, 'clock', 900);
    triggerWithCooldown(s, 'pulse', 900);
  }

  if (mod === 'both' && intensity > 74) {
    triggerWithCooldown(s, 'radio', 1200);
    setDynamicLayerSmooth(s, 'room', 26, 0.35);
    setDynamicLayerSmooth(s, 'rain', 6, 0.35);
    setDynamicLayerSmooth(s, 'drone', 74, 0.35);
    setDynamicLayerSmooth(s, 'rumble', 78, 0.35);
  } else {
    setDynamicLayerSmooth(s, 'room', 44 - fearRatio * 10, 0.35);
    setDynamicLayerSmooth(s, 'rain', 14 - fearRatio * 4, 0.35);
    setDynamicLayerSmooth(s, 'drone', 46 + fearRatio * 18, 0.35);
    setDynamicLayerSmooth(s, 'rumble', 26 + fearRatio * 20, 0.35);
  }
}
