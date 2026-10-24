import { drawText } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { wasAnyKeyPressed, wasMousePressed } from '../input.js';
import { clamp } from '../math.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { hasSeenBriefing } from '../game/onboarding.js';

let anim = 0;
let armed = false;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function drawTitleScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 40;
  const panelY = 36;
  const panelW = DESIGN_W - 80;
  const panelH = DESIGN_H - 72;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  const titleP = smoothstep(clamp(anim / 0.6, 0, 1));
  ctx.save();
  ctx.globalAlpha = titleP;
  const titleY = DESIGN_H / 2 - 38 + (1 - titleP) * 10;
  drawText(ctx, t('APP_TITLE'), DESIGN_W / 2, titleY, {
    align: 'center',
    size: 36,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });
  ctx.restore();

  const subP = smoothstep(clamp((anim - 0.4) / 0.5, 0, 1));
  if (subP > 0.01) {
    ctx.save();
    ctx.globalAlpha = subP;
    drawText(ctx, t('GAME_SUBTITLE'), DESIGN_W / 2, DESIGN_H / 2 - 4, {
      align: 'center',
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
    drawText(ctx, t('GAME_TAGLINE'), DESIGN_W / 2, DESIGN_H / 2 + 12, {
      align: 'center',
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }

  const promptP = smoothstep(clamp((anim - 1.0) / 0.4, 0, 1));
  if (promptP > 0.01) {
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(anim * 2.4));
    ctx.save();
    ctx.globalAlpha = promptP * blink;
    drawText(ctx, t('PRESS_ANY_KEY'), DESIGN_W / 2, DESIGN_H - 60, {
      align: 'center',
      size: 12,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }
}

export function registerTitleScene(_canvas, ctx) {
  registerScene('title', {
    enter() {
      anim = 0;
      armed = false;
      applyAmbientProfile('title');
    },
    update(dt) {
      anim += dt;
      if (!armed && anim > 1.1) {
        armed = true;
      }
      if (!armed) return;
      if (wasAnyKeyPressed() || wasMousePressed(0)) {
        setScene(hasSeenBriefing() ? 'menu' : 'briefing');
      }
    },
    render() {
      drawTitleScene(ctx);
    },
  });
}
