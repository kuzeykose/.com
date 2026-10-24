import { getImage } from '../assets.js';
import { playLightBuzz } from '../audio.js';
import { drawRect } from '../draw.js';
import { COLORS, DESIGN_H, DESIGN_W } from './theme.js';

const flicker = {
  intensity: 1,
  targetIntensity: 1,
  phaseEnd: 0,
  burstQueue: [],
  nextBurst: 0,
};

function scheduleBurst(now) {
  flicker.nextBurst = now + 8000 + Math.random() * 14000;
}

function buildBurst() {
  const count = 2 + Math.floor(Math.random() * 3);
  const queue = [];
  for (let i = 0; i < count; i++) {
    const dim = Math.random();
    let intensity;
    if (dim < 0.45) intensity = 0;
    else if (dim < 0.75) intensity = 0.15 + Math.random() * 0.25;
    else intensity = 0.5 + Math.random() * 0.3;
    queue.push({ intensity, duration: 25 + Math.random() * 90 });
    if (Math.random() < 0.7) {
      queue.push({ intensity: 0.95 + Math.random() * 0.05, duration: 20 + Math.random() * 80 });
    }
  }
  queue.push({ intensity: 1, duration: 0 });
  return queue;
}

function advancePhase(now) {
  if (flicker.burstQueue.length === 0) return;
  const next = flicker.burstQueue.shift();
  const dimming = next.intensity < flicker.targetIntensity - 0.1 && next.intensity < 0.85;
  flicker.targetIntensity = next.intensity;
  flicker.phaseEnd = now + next.duration;
  if (dimming && next.duration > 0) {
    playLightBuzz(next.duration + 40, 1 - next.intensity);
  }
}

function updateFlicker() {
  const now = performance.now();

  if (flicker.nextBurst === 0) {
    scheduleBurst(now);
  }

  if (flicker.burstQueue.length > 0 && now >= flicker.phaseEnd) {
    advancePhase(now);
  }

  if (flicker.burstQueue.length === 0 && now >= flicker.nextBurst) {
    flicker.burstQueue = buildBurst();
    advancePhase(now);
    scheduleBurst(now);
  }

  const delta = flicker.targetIntensity - flicker.intensity;
  const speed = delta < 0 ? 0.55 : 0.35;
  flicker.intensity += delta * speed;
  if (Math.abs(delta) < 0.005) flicker.intensity = flicker.targetIntensity;
}

export function drawSceneBackground(ctx, imageKey = 'background') {
  drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, COLORS.ink);

  if (imageKey === 'background') {
    updateFlicker();
    const dark = getImage('background-no-light');
    const lit = getImage('background');
    if (dark) ctx.drawImage(dark, 0, 0, DESIGN_W, DESIGN_H);
    if (lit) {
      ctx.globalAlpha = flicker.intensity;
      ctx.drawImage(lit, 0, 0, DESIGN_W, DESIGN_H);
      ctx.globalAlpha = 1;
    }
    const overlayAlpha = 0.25 + (1 - flicker.intensity) * 0.35;
    drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, `rgba(8, 5, 3, ${overlayAlpha.toFixed(3)})`);
  } else {
    const img = getImage(imageKey);
    if (img) {
      ctx.drawImage(img, 0, 0, DESIGN_W, DESIGN_H);
      drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, 'rgba(8, 5, 3, 0.25)');
    }
  }
}
