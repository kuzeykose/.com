import { drawText, drawScrollableText } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';

export function drawDialogueModal(
  ctx,
  {
    x,
    y,
    w,
    h,
    question,
    answer,
    questionScrollOffset = 0,
    answerScrollOffset = 0,
    suspectLabel = t('DOSSIER_DEFAULT_NAME'),
  }
) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, t('DIALOGUE_ANSWER_HEADER'), x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const qStartY = y + 24;
  const qH = 24;
  const questionRect = { x: x + 8, y: qStartY, w: w - 16, h: qH };
  const questionScrollResult = drawScrollableText(
    ctx,
    `${t('DIALOGUE_YOU_PREFIX')}${question}`,
    questionRect.x,
    questionRect.y,
    questionRect.w,
    questionRect.h,
    questionScrollOffset,
    {
      size: 12,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 12,
      scrollbarTrackColor: COLORS.amberDim,
      scrollbarThumbColor: COLORS.amberBright,
    }
  );

  const footerH = 14;
  let scrollResult = { clampedScroll: 0, maxScroll: 0 };

  if (answer) {
    const aStartY = qStartY + qH + 6;
    const aH = y + h - footerH - aStartY;
    const answerRect = { x: x + 8, y: aStartY, w: w - 16, h: aH };
    scrollResult = drawScrollableText(
      ctx,
      `${suspectLabel}: ${answer}`,
      answerRect.x,
      answerRect.y,
      answerRect.w,
      answerRect.h,
      answerScrollOffset,
      {
        size: 12,
        color: COLORS.cream,
        font: UI_FONT,
        lineHeight: 12,
        scrollbarTrackColor: COLORS.amberDim,
        scrollbarThumbColor: COLORS.amberBright,
      }
    );

    scrollResult.answerRect = answerRect;
  }

  drawText(ctx, t('DIALOGUE_SKIP_HINT'), x + w - 8, y + h - 6, {
    size: 10,
    color: COLORS.creamDim,
    align: 'right',
    font: UI_FONT,
    baseline: 'alphabetic',
  });

  return {
    clampedScroll: scrollResult.clampedScroll,
    maxScroll: scrollResult.maxScroll,
    answerClampedScroll: scrollResult.clampedScroll,
    answerMaxScroll: scrollResult.maxScroll,
    answerRect: scrollResult.answerRect || null,
    questionClampedScroll: questionScrollResult.clampedScroll,
    questionMaxScroll: questionScrollResult.maxScroll,
    questionRect,
  };
}
