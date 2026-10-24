import { drawRect, drawText } from './draw.js';

const state = {
  enabled: false,
  fps: 0,
  frameCounter: 0,
  elapsed: 0,
};

export function toggleDebug() {
  state.enabled = !state.enabled;
}

export function isDebugEnabled() {
  return state.enabled;
}

export function updateDebug(dt) {
  state.frameCounter += 1;
  state.elapsed += dt;

  if (state.elapsed >= 1) {
    state.fps = state.frameCounter;
    state.frameCounter = 0;
    state.elapsed = 0;
  }
}

export function drawFPS(ctx) {
  if (!state.enabled) {
    return;
  }

  drawRect(ctx, 8, 8, 120, 46, 'rgba(5, 8, 15, 0.75)');
  drawText(ctx, `FPS: ${state.fps}`, 16, 28, { size: 16, color: '#34d399' });
}

export function drawHitbox(ctx, entity, color = '#f43f5e') {
  if (!state.enabled || !entity) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(entity.x, entity.y, entity.w, entity.h);
  ctx.restore();
}
