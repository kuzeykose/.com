import { drawScrollableText, drawText } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';

export function drawNarrationBox(ctx, x, y, w, h, title, body, scrollOffset = 0) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, `[ ${String(title || '').toUpperCase()} ]`, x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const bodyRect = {
    x: x + 8,
    y: y + 22,
    w: w - 16,
    h: Math.max(10, h - 24),
  };

  const scroll = drawScrollableText(
    ctx,
    body,
    bodyRect.x,
    bodyRect.y,
    bodyRect.w,
    bodyRect.h,
    scrollOffset,
    {
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 12,
      scrollbarTrackColor: COLORS.amberDim,
      scrollbarThumbColor: COLORS.amberBright,
    }
  );

  return {
    clampedScroll: scroll.clampedScroll,
    maxScroll: scroll.maxScroll,
    bodyRect,
  };
}
