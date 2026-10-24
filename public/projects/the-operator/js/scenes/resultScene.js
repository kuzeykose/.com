import { drawText, drawWrappedText } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { wasKeyPressed } from '../input.js';
import { state } from '../game/state.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';

function verdictLabel(verdict) {
  if (verdict === 'GUILTY') return t('VERDICT_LABEL_GUILTY');
  if (verdict === 'NOT_GUILTY') return t('VERDICT_LABEL_NOT_GUILTY');
  return '-';
}

function drawResultScene(ctx) {
  drawSceneBackground(ctx);

  const correct = state.verdict && state.trueVerdict && state.verdict === state.trueVerdict;
  const border = correct ? COLORS.success : COLORS.fail;

  const panelX = 40;
  const panelY = 40;
  const panelW = DESIGN_W - 80;
  const panelH = DESIGN_H - 80;

  drawPanel(ctx, panelX, panelY, panelW, panelH, { border });

  drawText(ctx, correct ? t('RESULT_CORRECT') : t('RESULT_WRONG'), DESIGN_W / 2, panelY + 16, {
    align: 'center',
    size: 12,
    color: correct ? COLORS.success : COLORS.fail,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(
    ctx,
    `${t('RESULT_YOUR_VERDICT')} ${verdictLabel(state.verdict)}`,
    DESIGN_W / 2,
    panelY + 36,
    {
      align: 'center',
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  drawText(
    ctx,
    `${t('RESULT_TRUE_VERDICT')} ${verdictLabel(state.trueVerdict)}`,
    DESIGN_W / 2,
    panelY + 52,
    {
      align: 'center',
      size: 11,
      color: correct ? COLORS.success : COLORS.fail,
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  const truthText = state.gameData?.verdict_truth_text || '';
  if (truthText) {
    drawText(ctx, t('RESULT_TRUTH_STORY'), DESIGN_W / 2, panelY + 76, {
      align: 'center',
      size: 11,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    drawWrappedText(ctx, truthText, panelX + 20, panelY + 92, panelW - 40, {
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 6,
      baseline: 'top',
    });
  }

  const outcome = state.interrogationOutcome;
  if (outcome) {
    drawText(ctx, t('RESULT_INTERROGATION_RESULT'), DESIGN_W / 2, panelY + 180, {
      align: 'center',
      size: 11,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    drawWrappedText(ctx, outcome.resultText, panelX + 20, panelY + 196, panelW - 40, {
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 6,
      baseline: 'top',
    });
  }

  drawText(ctx, t('RESULT_INSTRUCTIONS'), DESIGN_W / 2, panelY + panelH - 14, {
    align: 'center',
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawErrorScene(ctx) {
  drawSceneBackground(ctx);
  drawPanel(ctx, 60, 140, DESIGN_W - 120, 120, { border: COLORS.fail });
  drawText(ctx, t('RESULT_ERROR'), DESIGN_W / 2, 164, {
    align: 'center',
    size: 18,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawWrappedText(ctx, state.error, DESIGN_W / 2, 196, DESIGN_W - 160, {
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 12,
    maxLines: 4,
    align: 'center',
  });
}

export function registerResultScene(_canvas, ctx) {
  registerScene('result', {
    enter() {
      const correct = state.verdict && state.trueVerdict && state.verdict === state.trueVerdict;
      applyAmbientProfile(correct ? 'result-good' : 'result-bad');
    },
    update() {
      if (wasKeyPressed('r')) {
        setScene('play');
        return;
      }
      if (wasKeyPressed('escape')) {
        setScene('menu');
      }
    },
    render() {
      if (state.error) {
        drawErrorScene(ctx);
        return;
      }
      drawResultScene(ctx);
    },
  });
}
