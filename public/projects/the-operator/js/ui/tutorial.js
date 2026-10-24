import { drawRect, drawText, drawWrappedText } from '../draw.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';

export const TUTORIAL_KEY = 'the-operator:tutorial:v1';

function buildSteps(layout) {
  return [
    {
      highlight: layout.polygraph,
      titleKey: 'TUTORIAL_POLYGRAPH_TITLE',
      bodyKey: 'TUTORIAL_POLYGRAPH_BODY',
      captionSide: 'top',
    },
    {
      highlight: layout.dossierTab,
      pulseWidth: 32,
      titleKey: 'TUTORIAL_DOSSIER_TITLE',
      bodyKey: 'TUTORIAL_DOSSIER_BODY',
      captionSide: 'right',
    },
    {
      highlight: layout.logTab,
      pulseWidth: 32,
      titleKey: 'TUTORIAL_LOG_TITLE',
      bodyKey: 'TUTORIAL_LOG_BODY',
      captionSide: 'left',
    },
    {
      highlight: layout.modal,
      titleKey: 'TUTORIAL_CHOICES_TITLE',
      bodyKey: 'TUTORIAL_CHOICES_BODY',
      captionSide: 'top',
    },
  ];
}

function expandHighlight(rect, pulseWidth) {
  if (pulseWidth && rect.w < pulseWidth) {
    const extra = pulseWidth - rect.w;
    return {
      x: Math.max(0, rect.x - extra / 2),
      y: rect.y,
      w: rect.w + extra,
      h: rect.h,
    };
  }
  return rect;
}

function drawDimMask(ctx, hl) {
  const dim = 'rgba(4, 2, 1, 0.78)';
  drawRect(ctx, 0, 0, DESIGN_W, hl.y, dim);
  drawRect(ctx, 0, hl.y + hl.h, DESIGN_W, DESIGN_H - (hl.y + hl.h), dim);
  drawRect(ctx, 0, hl.y, hl.x, hl.h, dim);
  drawRect(ctx, hl.x + hl.w, hl.y, DESIGN_W - (hl.x + hl.w), hl.h, dim);
}

function drawHighlightBorder(ctx, hl, pulse) {
  const pad = 2;
  const x = hl.x - pad;
  const y = hl.y - pad;
  const w = hl.w + pad * 2;
  const h = hl.h + pad * 2;
  const alpha = 0.55 + 0.45 * pulse;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawRect(ctx, x, y, w, 1, COLORS.amberBright);
  drawRect(ctx, x, y + h - 1, w, 1, COLORS.amberBright);
  drawRect(ctx, x, y, 1, h, COLORS.amberBright);
  drawRect(ctx, x + w - 1, y, 1, h, COLORS.amberBright);
  ctx.restore();
}

function layoutCaption(hl, side) {
  const W = 260;
  const padding = 10;
  if (side === 'top') {
    const x = clampX(hl.x + hl.w / 2 - W / 2);
    const y = Math.max(4, hl.y - 4 - 72);
    return { x, y, w: W, padding, arrow: 'down', arrowX: hl.x + hl.w / 2 };
  }
  if (side === 'bottom') {
    const x = clampX(hl.x + hl.w / 2 - W / 2);
    const y = Math.min(DESIGN_H - 76, hl.y + hl.h + 4);
    return { x, y, w: W, padding, arrow: 'up', arrowX: hl.x + hl.w / 2 };
  }
  if (side === 'right') {
    const x = Math.min(DESIGN_W - W - 4, hl.x + hl.w + 8);
    const y = Math.max(4, Math.min(DESIGN_H - 76, hl.y + hl.h / 2 - 36));
    return { x, y, w: W, padding, arrow: 'left', arrowY: hl.y + hl.h / 2 };
  }
  const x = Math.max(4, hl.x - W - 8);
  const y = Math.max(4, Math.min(DESIGN_H - 76, hl.y + hl.h / 2 - 36));
  return { x, y, w: W, padding, arrow: 'right', arrowY: hl.y + hl.h / 2 };
}

function clampX(x) {
  return Math.max(4, Math.min(DESIGN_W - 264, x));
}

function drawCaption(ctx, caption, title, body, stepIdx, stepCount) {
  const H = 72;
  drawPanel(ctx, caption.x, caption.y, caption.w, H, {
    border: COLORS.amberBright,
    fill: 'rgba(18, 11, 6, 0.96)',
  });

  drawText(ctx, title, caption.x + caption.padding, caption.y + 12, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(
    ctx,
    `${t('TUTORIAL_STEP')} ${stepIdx + 1}${t('TUTORIAL_OF')}${stepCount}`,
    caption.x + caption.w - caption.padding,
    caption.y + 12,
    {
      size: 9,
      color: COLORS.creamDim,
      align: 'right',
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  drawWrappedText(
    ctx,
    body,
    caption.x + caption.padding,
    caption.y + 22,
    caption.w - caption.padding * 2,
    {
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 3,
      baseline: 'top',
    }
  );

  drawText(ctx, t('TUTORIAL_NEXT'), caption.x + caption.padding, caption.y + H - 8, {
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'alphabetic',
  });

  drawText(ctx, t('TUTORIAL_SKIP'), caption.x + caption.w - caption.padding, caption.y + H - 8, {
    size: 10,
    color: COLORS.creamDim,
    align: 'right',
    font: UI_FONT,
    baseline: 'alphabetic',
  });
}

export function drawTutorial(ctx, layout, stepIdx, pulse) {
  const steps = buildSteps(layout);
  if (stepIdx < 0 || stepIdx >= steps.length) return;
  const step = steps[stepIdx];
  const hl = expandHighlight(step.highlight, step.pulseWidth);
  drawDimMask(ctx, hl);
  drawHighlightBorder(ctx, hl, pulse);
  const caption = layoutCaption(hl, step.captionSide);
  const title = step.titleKey ? t(step.titleKey) : '';
  const body = step.body ?? t(step.bodyKey);
  drawCaption(ctx, caption, title, body, stepIdx, steps.length);
}

export function getTutorialStepCount(layout) {
  return buildSteps(layout).length;
}

export function isTutorialDone() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {}
}
