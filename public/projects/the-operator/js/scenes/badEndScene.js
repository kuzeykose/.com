import { drawRect, drawScrollableText, drawText } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import {
  getPlatformScrollDelta,
  toUnifiedScrollPixels,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import { getSelectedCaseDef, state } from '../game/state.js';
import { recordBadEnd } from '../game/caseStats.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { playCaseCloseSlam } from '../audio.js';
import {
  getScrollTarget,
  resetScroll,
  setScrollTarget,
  tickScrollOffset,
} from '../smoothScroll.js';

let anim = 0;
let textScrollOffset = 0;
let textMaxScroll = 0;
let recorded = false;

function drawBadEndScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 40;
  const panelY = 40;
  const panelW = DESIGN_W - 80;
  const panelH = DESIGN_H - 80;

  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.fail });

  drawText(ctx, t('BAD_END_TITLE'), DESIGN_W / 2, panelY + 16, {
    align: 'center',
    size: 12,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: 'middle',
  });

  const outcome = state.interrogationOutcome;
  const theme = outcome?.theme || '';

  if (theme) {
    drawText(ctx, theme.toUpperCase(), DESIGN_W / 2, panelY + 34, {
      align: 'center',
      size: 10,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  drawRect(ctx, panelX + 16, panelY + 46, panelW - 32, 1, COLORS.amberDim);

  const bodyX = panelX + 20;
  const bodyY = panelY + 54;
  const bodyW = panelW - 40;
  const footerH = 22;
  const bodyH = panelH - (bodyY - panelY) - footerH - 8;

  const resultText = outcome?.resultText || '';
  const descText = outcome?.description || '';
  const fullText = [descText, resultText].filter(Boolean).join('\n\n');

  const scroll = drawScrollableText(ctx, fullText, bodyX, bodyY, bodyW, bodyH, textScrollOffset, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 13,
    scrollbarTrackColor: COLORS.amberDim,
    scrollbarThumbColor: COLORS.fail,
  });
  textMaxScroll = scroll.maxScroll;

  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 2.2));
  ctx.save();
  ctx.globalAlpha = pulse;
  drawText(ctx, t('BAD_END_INSTRUCTIONS'), DESIGN_W / 2, panelY + panelH - 10, {
    align: 'center',
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });
  ctx.restore();
}

export function registerBadEndScene(_canvas, ctx) {
  registerScene('bad-end', {
    enter() {
      anim = 0;
      textScrollOffset = 0;
      textMaxScroll = 0;
      recorded = false;
      resetScroll('badEnd.text');

      applyAmbientProfile('result-bad');
      playCaseCloseSlam(0.8);

      if (!recorded) {
        const caseDef = getSelectedCaseDef();
        if (caseDef?.id) {
          recordBadEnd(caseDef.id);
        }
        recorded = true;
      }
    },
    update(dt) {
      anim += dt;

      textScrollOffset = tickScrollOffset('badEnd.text', dt, textMaxScroll);

      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        setScrollTarget(
          'badEnd.text',
          getScrollTarget('badEnd.text') + toUnifiedScrollPixels(wheel),
          textMaxScroll
        );
      }
      if (wasKeyPressed('arrowup')) {
        setScrollTarget('badEnd.text', getScrollTarget('badEnd.text') - 12, textMaxScroll);
      }
      if (wasKeyPressed('arrowdown')) {
        setScrollTarget('badEnd.text', getScrollTarget('badEnd.text') + 12, textMaxScroll);
      }

      if (wasKeyPressed('escape') || wasKeyPressed('enter') || wasMousePressed(0)) {
        setScene('menu');
      }
    },
    render() {
      drawBadEndScene(ctx);
    },
  });
}
