const scrolls = new Map();

const EASE_K = 9;
const SNAP_EPS = 0.25;
const MAX_DT = 1 / 30;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function getEntry(key) {
  let s = scrolls.get(key);
  if (!s) {
    s = { target: 0, current: 0 };
    scrolls.set(key, s);
  }
  return s;
}

export function getScrollTarget(key) {
  return getEntry(key).target;
}

export function setScrollTarget(key, target, max) {
  const s = getEntry(key);
  s.target = clamp(target, 0, Math.max(0, max));
}

export function tickScrollOffset(key, dt, max) {
  const s = getEntry(key);
  const hi = Math.max(0, max);
  s.target = clamp(s.target, 0, hi);
  s.current = clamp(s.current, 0, hi);
  const clampedDt = Math.min(MAX_DT, Math.max(0, dt));
  const alpha = 1 - Math.exp(-EASE_K * clampedDt);
  s.current += (s.target - s.current) * alpha;
  if (Math.abs(s.target - s.current) < SNAP_EPS) {
    s.current = s.target;
  }
  return s.current;
}

export function resetScroll(key) {
  const s = getEntry(key);
  s.target = 0;
  s.current = 0;
}
