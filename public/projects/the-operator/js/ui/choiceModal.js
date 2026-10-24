import { drawText, drawRect, wrapTextLines } from '../draw.js';
import { clamp } from '../math.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';
import { playTypewriterKey } from '../audio.js';

let lastChoiceTypeChars = [];

function playTypewriterForRange(text, startIndex, endIndex, volume = 1) {
  if (!text || endIndex <= startIndex) {
    return;
  }

  for (let i = startIndex; i < endIndex; i += 1) {
    const ch = text[i];
    if (ch && ch !== ' ' && ch !== '\n' && ch !== '\t') {
      playTypewriterKey(volume);
    }
  }
}

function pointInRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function drawChoiceModal(
  ctx,
  { x, y, w, h, choices, mouse, animProgress = 1, scrollOffset = 0, title = null }
) {
  const fontSize = 12;
  const lineH = 12;
  const gap = 3;
  const btnPadY = 4;
  const headerH = 22;
  const scrollbarW = 3;
  const stagger = 0.18;
  const slideDuration = 0.4;
  const slideDistance = 10;
  const typeStart = 0.12;
  const typeCps = 70;

  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  if (lastChoiceTypeChars.length !== choices.length || animProgress <= typeStart + 0.001) {
    lastChoiceTypeChars = new Array(choices.length).fill(0);
  }

  drawText(ctx, `[ ${title ?? t('CHOICE_MODAL_TITLE')} ]`, x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  // Pre-calculate all choice sizes
  const choiceData = choices.map((choice, i) => {
    const text = `${i + 1}. ${choice.question}`;
    const lines = wrapTextLines(ctx, text, w - 20 - scrollbarW - 4, fontSize, UI_FONT);
    const btnH = Math.max(22, lines.length * lineH + btnPadY * 2);
    return { lines, btnH };
  });

  const totalContentH = choiceData.reduce(
    (sum, d, i) => sum + d.btnH + (i < choiceData.length - 1 ? gap : 0),
    0
  );
  const bodyY = y + headerH;
  const bodyH = h - headerH - 4;
  const maxScroll = Math.max(0, totalContentH - bodyH);
  const clamped = Math.min(Math.max(0, scrollOffset), maxScroll);

  const rects = [];
  let contentY = bodyY - clamped;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, bodyY, w - 2, bodyH);
  ctx.clip();

  for (let i = 0; i < choiceData.length; i += 1) {
    const { lines, btnH } = choiceData[i];
    const choiceY = contentY;
    contentY += btnH + gap;

    if (choiceY + btnH <= bodyY || choiceY >= bodyY + bodyH) {
      continue;
    }

    const rect = { x: x + 6, y: choiceY, w: w - 12 - scrollbarW - 2, h: btnH, index: i };
    rects.push(rect);

    const local = animProgress - i * stagger;
    const slideLocal = clamp(local / slideDuration, 0, 1);
    const slideEase = easeOutCubic(slideLocal);
    const alpha = slideEase;
    const yOffset = (1 - slideEase) * slideDistance;

    if (alpha <= 0.01) {
      continue;
    }

    const typeElapsed = Math.max(0, local - typeStart);
    const totalChars = lines.reduce((acc, line) => acc + line.length, 0);
    const charsToShow = Math.min(totalChars, Math.floor(typeElapsed * typeCps));
    const prevChars = lastChoiceTypeChars[i] || 0;
    if (charsToShow > prevChars) {
      const fullText = lines.join('');
      playTypewriterForRange(fullText, prevChars, charsToShow, 0.7);
    }
    lastChoiceTypeChars[i] = charsToShow;

    const drawY = rect.y + yOffset;
    const interactive = slideEase > 0.6;
    const hovered = interactive && pointInRect(mouse, rect);

    ctx.save();
    ctx.globalAlpha = alpha;

    drawPanel(ctx, rect.x, drawY, rect.w, rect.h, {
      border: hovered ? COLORS.amberBright : COLORS.amberDim,
      fill: hovered ? 'rgba(70, 42, 16, 0.75)' : COLORS.panelFillLight,
    });

    let remaining = charsToShow;
    for (let j = 0; j < lines.length; j += 1) {
      if (remaining <= 0) break;
      const slice = lines[j].slice(0, remaining);
      drawText(ctx, slice, rect.x + 6, drawY + btnPadY + 6 + j * lineH, {
        size: fontSize,
        color: hovered ? COLORS.amberBright : COLORS.cream,
        font: UI_FONT,
        baseline: 'middle',
      });
      remaining -= lines[j].length;
    }

    ctx.restore();
  }

  ctx.restore();

  // Scrollbar
  if (maxScroll > 0) {
    const trackX = x + w - scrollbarW - 2;
    drawRect(ctx, trackX, bodyY, scrollbarW, bodyH, COLORS.amberDim);
    const thumbH = Math.max(10, bodyH * (bodyH / totalContentH));
    const thumbRatio = clamped / maxScroll;
    const thumbY = bodyY + (bodyH - thumbH) * thumbRatio;
    drawRect(ctx, trackX, thumbY, scrollbarW, thumbH, COLORS.amberBright);
  }

  return { rects, clampedScroll: clamped, maxScroll };
}
