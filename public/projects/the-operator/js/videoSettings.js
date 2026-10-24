const CRT_STRENGTH_KEY = 'the-operator:crt-strength:v1';

function clamp100(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

let crtStrength = 40;

try {
  const raw = localStorage.getItem(CRT_STRENGTH_KEY);
  if (raw != null && String(raw).trim() !== '') {
    crtStrength = clamp100(raw);
  }
} catch {}

export function getCrtStrength() {
  return crtStrength;
}

export function setCrtStrength(next) {
  crtStrength = clamp100(next);
  try {
    localStorage.setItem(CRT_STRENGTH_KEY, String(crtStrength));
  } catch {}
}
