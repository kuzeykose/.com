import { drawRect, drawText, wrapTextLines } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';

function colorForEntry(entry) {
  if (entry.startsWith('SEN:') || entry.startsWith('YOU:')) {
    return COLORS.creamDim;
  }
  return COLORS.amberBright;
}

function buildLines(ctx, log, textW, size) {
  const lines = [];
  for (const entry of log) {
    if (!entry) {
      continue;
    }
    const color = colorForEntry(entry);
    const wrapped = wrapTextLines(ctx, entry, textW, size, UI_FONT);
    for (const line of wrapped) {
      lines.push({ text: line, color });
    }
  }
  return lines;
}

function drawTabTexture(ctx, x, y, w, h) {
  for (let yy = y + 3; yy < y + h - 3; yy += 3) {
    for (let xx = x + 2; xx < x + w - 2; xx += 2) {
      const seed = (xx * 13 + yy * 7) % 11;
      if (seed < 3) {
        drawRect(ctx, xx, yy, 1, 1, 'rgba(255, 245, 220, 0.04)');
      } else if (seed > 8) {
        drawRect(ctx, xx, yy, 1, 1, 'rgba(12, 9, 7, 0.28)');
      }
    }
  }
}

export function drawLogTab(ctx, x, y, w, h, expanded, hovered = false) {
  if (hovered) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    drawRect(ctx, x - 1, y - 1, w + 2, h + 2, COLORS.amberBright);
    ctx.restore();
  }

  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amberDim,
    fill: hovered ? 'rgba(20, 14, 8, 0.95)' : 'rgba(14, 9, 6, 0.92)',
  });

  drawRect(
    ctx,
    x + 1,
    y + 1,
    w - 2,
    h - 2,
    hovered ? 'rgba(24, 18, 12, 0.42)' : 'rgba(18, 13, 9, 0.5)'
  );
  drawTabTexture(ctx, x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = 5;
  const arrow = expanded
    ? [
        [cx - size / 2, cy - size],
        [cx + size / 2, cy],
        [cx - size / 2, cy + size],
      ]
    : [
        [cx + size / 2, cy - size],
        [cx - size / 2, cy],
        [cx + size / 2, cy + size],
      ];

  ctx.save();
  ctx.fillStyle = 'rgba(130, 111, 82, 0.88)';
  ctx.beginPath();
  ctx.moveTo(arrow[0][0], arrow[0][1]);
  ctx.lineTo(arrow[1][0], arrow[1][1]);
  ctx.lineTo(arrow[2][0], arrow[2][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLogPanel(ctx, x, y, w, h, log, scrollOffset) {
  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amber,
    fill: 'rgba(14, 9, 6, 0.95)',
  });

  drawText(ctx, t('LOG_HEADER'), x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const textX = x + 8;
  const scrollbarW = 3;
  const textW = w - 16 - scrollbarW;
  const bodyTop = y + 22;
  const bodyHeight = h - 28;
  const size = 12;
  const lineH = 12;
  const maxLines = Math.max(1, Math.floor(bodyHeight / lineH));

  const allLines = buildLines(ctx, log, textW, size);
  const maxScroll = Math.max(0, allLines.length - maxLines);
  const clampedScroll = Math.min(Math.max(0, scrollOffset), maxScroll);
  const startIdx = Math.max(0, Math.floor(clampedScroll));
  const visible = allLines.slice(startIdx, startIdx + maxLines);

  for (let i = 0; i < visible.length; i += 1) {
    drawText(ctx, visible[i].text, textX, bodyTop + i * lineH + 3, {
      size,
      color: visible[i].color,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  if (maxScroll > 0) {
    const trackX = x + w - scrollbarW - 2;
    const trackY = bodyTop;
    const trackH = bodyHeight;
    drawRect(ctx, trackX, trackY, scrollbarW, trackH, COLORS.amberDim);
    const thumbH = Math.max(10, trackH * (maxLines / allLines.length));
    const thumbYRatio = maxScroll === 0 ? 0 : clampedScroll / maxScroll;
    const thumbY = trackY + (trackH - thumbH) * thumbYRatio;
    drawRect(ctx, trackX, thumbY, scrollbarW, thumbH, COLORS.amberBright);
  }

  return { clampedScroll, maxScroll };
}
