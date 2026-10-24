const CCTV_STYLES = {
  TENSE: [
    'JAW_TIGHTEN',
    'MICRO_TWITCH',
    'LIP_PRESS',
    'EYE_DART',
    'HAND_PINCH_UNDER_TABLE',
    'SWALLOW_HARD',
    'BRIEF_EYE_GLASS',
  ],
  CONTROLLED: [
    'FROZEN',
    'STONE_FACE',
    'EMPTY_STARE',
    'STEADY_GAZE',
    'PROFESSIONAL_COMPOSURE',
    'REHEARSED_SOFTENING',
  ],
  BREAKDOWN: ['BREAKDOWN', 'TEAR_POOLING', 'CRYING'],
  DEFENSIVE: ['DEFENSIVE_CROSS_ARMS', 'LOOK_DOWN', 'AVOIDANCE', 'PROTECTIVE_LEAN'],
  RELIEVED: ['RELIEVED_EXHALE', 'RELEASED_SHOULDERS'],
};

const STYLE_KEYWORDS = {
  BREAKDOWN: ['BREAKDOWN', 'TEAR', 'CRY', 'SOB'],
  DEFENSIVE: ['DEFENSIVE', 'CROSS_ARMS', 'AVOID', 'LOOK_DOWN', 'PROTECTIVE'],
  TENSE: ['JAW', 'MICRO', 'TWITCH', 'EYE_DART', 'SWALLOW', 'LIP_PRESS', 'GLASS'],
  RELIEVED: ['RELIEVED', 'RELEASED', 'EXHALE', 'SMILE'],
  CONTROLLED: [
    'STONE_FACE',
    'FROZEN',
    'EMPTY_STARE',
    'STEADY_GAZE',
    'CONTROLLED',
    'COMPOSED',
    'PROFESSIONAL',
    'REHEARSED',
    'NOD',
    'EYE_CONTACT',
  ],
};

const STYLE_PRIORITY = ['BREAKDOWN', 'DEFENSIVE', 'TENSE', 'RELIEVED', 'CONTROLLED'];

export function classifyCctv(cue) {
  if (!cue) {
    return 'NEUTRAL';
  }

  const normalized = String(cue).toUpperCase();

  for (const style of Object.keys(CCTV_STYLES)) {
    if (CCTV_STYLES[style].includes(normalized)) {
      return style;
    }
  }

  let bestStyle = 'NEUTRAL';
  let bestScore = 0;
  for (const style of STYLE_PRIORITY) {
    const keywords = STYLE_KEYWORDS[style] || [];
    let score = 0;
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  }

  if (bestScore > 0) {
    return bestStyle;
  }

  return 'NEUTRAL';
}

// pseudo-random but deterministic per time for stable visuals
function nz(t, seed = 0) {
  const s = Math.sin((t + seed) * 91.73) * 43758.5453;
  return s - Math.floor(s);
}

export function getCctvOffset(style, intensity, time) {
  if (!style || intensity <= 0) {
    return { dx: 0, dy: 0 };
  }
  const k = intensity;
  switch (style) {
    case 'TENSE': {
      const jx = (nz(time * 18, 1) - 0.5) * 2.4 * k;
      const jy = (nz(time * 21, 2) - 0.5) * 1.6 * k;
      return { dx: jx, dy: jy };
    }
    case 'BREAKDOWN': {
      const tremor = Math.sin(time * 11) * 1.2 * k + (nz(time * 9, 3) - 0.5) * 2 * k;
      const sag = 1.5 * k + Math.sin(time * 1.3) * 0.6 * k;
      return { dx: tremor, dy: sag };
    }
    case 'DEFENSIVE': {
      const sway = Math.sin(time * 2.4) * 0.8 * k;
      return { dx: sway, dy: 2.2 * k };
    }
    case 'CONTROLLED':
      return { dx: 0, dy: 0 };
    case 'RELIEVED': {
      const drift = Math.sin(time * 1.5) * 0.5 * k;
      return { dx: drift, dy: -0.8 * k };
    }
    default:
      return { dx: 0, dy: 0 };
  }
}

export function getCctvTint(style, intensity, time) {
  if (!style || intensity <= 0) {
    return null;
  }
  const k = intensity;
  switch (style) {
    case 'TENSE': {
      const pulse = 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(time * 6));
      return { color: '224,72,72', alpha: pulse * k };
    }
    case 'BREAKDOWN': {
      const pulse = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(time * 3));
      return { color: '255,93,115', alpha: pulse * k };
    }
    case 'CONTROLLED':
      return { color: '120,140,160', alpha: 0.28 * k };
    case 'DEFENSIVE':
      return { color: '40,30,60', alpha: 0.35 * k };
    case 'RELIEVED':
      return { color: '255,181,90', alpha: 0.25 * k };
    default:
      return null;
  }
}

export function getCctvScanlineAlpha(style, intensity, time) {
  if (!style || intensity <= 0) {
    return 0;
  }
  switch (style) {
    case 'TENSE':
      return (0.25 + 0.15 * (0.5 + 0.5 * Math.sin(time * 23))) * intensity;
    case 'BREAKDOWN':
      return (0.35 + 0.2 * (0.5 + 0.5 * Math.sin(time * 14))) * intensity;
    case 'CONTROLLED':
      return 0.12 * intensity;
    case 'DEFENSIVE':
      return 0.18 * intensity;
    case 'RELIEVED':
      return 0.08 * intensity;
    default:
      return 0;
  }
}
