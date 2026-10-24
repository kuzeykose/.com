import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, wasKeyPressed, wasMousePressed } from '../input.js';
import { drawRect, drawText, wrapTextLines } from '../draw.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { drawPolygraph } from '../ui/polygraph.js';
import { drawPortraitBadge } from '../ui/portraitBadge.js';
import { classifyCctv } from '../ui/cctvEffect.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { t } from '../i18n/index.js';
import {
  applyMechanicsToBiometrics,
  getBiometricDrawData,
  resetBiometricsOnState,
  settleBiometricsForNextQuestion,
  updateWave,
} from '../game/waves.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { clamp } from '../math.js';
import { markBriefingSeen } from '../game/onboarding.js';

const sandbox = {
  biometric: null,
  wave: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  time: 0,
};

const SIGNAL_CYCLES = {
  pulse: [
    { mechanics: { heart_rate: 'BASELINE' } },
    { mechanics: { heart_rate: 'INCREASE' } },
    { mechanics: { heart_rate: 'SPIKE' } },
    { mechanics: { heart_rate: 'MAX_SPIKE' } },
  ],
  breathing: [
    { mechanics: { breathing: 'BASELINE' } },
    { mechanics: { breathing: 'SHALLOW' } },
    { mechanics: { breathing: 'HOLDING_BREATH' } },
    { mechanics: { breathing: 'HYPERVENTILATION' } },
    { mechanics: { breathing: 'CRYING' } },
  ],
  gsr: [
    { mechanics: { gsr: 'BASELINE' } },
    { mechanics: { gsr: 'INCREASE' } },
    { mechanics: { gsr: 'SPIKE' } },
    { mechanics: { gsr: 'SURGE' } },
    { mechanics: { gsr: 'MAX' } },
  ],
  fear: [{ fearDelta: 0 }, { fearDelta: 14 }, { fearDelta: 28 }, { fearDelta: -22 }],
  cctv: [
    { cue: 'STONE_FACE' },
    { cue: 'EYE_DART' },
    { cue: 'JAW_TIGHTEN' },
    { cue: 'DEFENSIVE_CROSS_ARMS' },
    { cue: 'BREAKDOWN' },
    { cue: 'TEAR_POOLING' },
    { cue: 'RELIEVED_EXHALE' },
  ],
};

const STEPS = ['intro', 'pulse', 'breathing', 'gsr', 'fear', 'cctv', 'modifiers', 'close'];

const CCTV_CUE_FALLBACK = {
  STONE_FACE: 'Stone face',
  EYE_DART: 'Eye dart',
  JAW_TIGHTEN: 'Jaw tighten',
  DEFENSIVE_CROSS_ARMS: 'Defensive posture',
  BREAKDOWN: 'Breakdown',
  TEAR_POOLING: 'Tear pooling',
  RELIEVED_EXHALE: 'Relief exhale',
};

let stepIndex = 0;
let cycleIndex = 0;
let demoFearBar = 20;
let demoFearDisplay = 20;
let demoFearFlash = 0;
let laneFlash = { heartRate: 0, breathing: 0, gsr: 0 };
let simPrevRect = null;
let simNextRect = null;
let simCenterRect = null;
let simControlY = DESIGN_H - 36;

function inRect(point, rect) {
  if (!point || !rect) return false;
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function resetSandbox() {
  resetBiometricsOnState(sandbox, { heartRate: 70, gsr: 6.5 }, null);
  sandbox.time = 0;
  demoFearBar = 20;
  demoFearDisplay = 20;
  demoFearFlash = 0;
  laneFlash.heartRate = 0;
  laneFlash.breathing = 0;
  laneFlash.gsr = 0;
}

function activeCycle() {
  return SIGNAL_CYCLES[STEPS[stepIndex]] || null;
}

function enterStep(idx) {
  stepIndex = clamp(idx, 0, STEPS.length - 1);
  cycleIndex = 0;
  resetSandbox();
  applyCurrentCycle(true);
}

function advanceCycle() {
  const cycle = activeCycle();
  if (!cycle) return;
  cycleIndex = (cycleIndex + 1) % cycle.length;
  applyCurrentCycle(false);
}

function retreatCycle() {
  const cycle = activeCycle();
  if (!cycle) return;
  cycleIndex = (cycleIndex - 1 + cycle.length) % cycle.length;
  applyCurrentCycle(false);
}

function applyCurrentCycle(isEnter) {
  const step = STEPS[stepIndex];
  const entry = currentCycleEntry();
  if (!entry) return;

  if (step === 'pulse') {
    settleBiometricsForNextQuestion(sandbox);
    applyMechanicsToBiometrics(sandbox, {
      heart_rate: entry.mechanics?.heart_rate || 'BASELINE',
      breathing: 'BASELINE',
      gsr: 'BASELINE',
      cctv_visual: 'NEUTRAL',
    });
    laneFlash.heartRate = 1;
  } else if (step === 'breathing') {
    settleBiometricsForNextQuestion(sandbox);
    applyMechanicsToBiometrics(sandbox, {
      heart_rate: 'BASELINE',
      breathing: entry.mechanics?.breathing || 'BASELINE',
      gsr: 'BASELINE',
      cctv_visual: 'NEUTRAL',
    });
    laneFlash.breathing = 1;
  } else if (step === 'gsr') {
    settleBiometricsForNextQuestion(sandbox);
    applyMechanicsToBiometrics(sandbox, {
      heart_rate: 'BASELINE',
      breathing: 'BASELINE',
      gsr: entry.mechanics?.gsr || 'BASELINE',
      cctv_visual: 'NEUTRAL',
    });
    laneFlash.gsr = 1;
  } else if (step === 'fear' && entry.fearDelta != null) {
    const prev = demoFearBar;
    if (isEnter) {
      demoFearBar = 20;
      demoFearDisplay = 20;
    } else {
      demoFearBar = clamp(demoFearBar + entry.fearDelta, 0, 100);
    }
    if (demoFearBar !== prev) demoFearFlash = 1;
  }
}

function currentCycleEntry() {
  const cycle = activeCycle();
  if (!cycle) return null;
  return cycle[cycleIndex];
}

function currentStateLabel() {
  const entry = currentCycleEntry();
  if (!entry) return '';
  if (entry.mechanics) {
    return entry.mechanics.heart_rate || entry.mechanics.breathing || entry.mechanics.gsr || '';
  }
  if (entry.cue) {
    return resolveCctvCueLabel(entry.cue);
  }
  if (entry.fearDelta != null) {
    return entry.fearDelta > 0 ? `+${entry.fearDelta}` : String(entry.fearDelta);
  }
  return '';
}

function stepKey(key) {
  const name = STEPS[stepIndex].toUpperCase();
  return t(`BRIEFING_${name}_${key}`);
}

function resolveCctvCueLabel(cue) {
  const i18nKey = `BRIEFING_CCTV_CUE_${cue}`;
  const localized = t(i18nKey);
  if (localized && localized !== i18nKey) {
    return localized;
  }
  return CCTV_CUE_FALLBACK[cue] || String(cue || '').replaceAll('_', ' ');
}

function drawHeader(ctx) {
  drawText(ctx, t('BRIEFING_TITLE'), DESIGN_W / 2, 22, {
    size: 18,
    color: COLORS.amberBright,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });

  const total = STEPS.length;
  const dotY = 38;
  const dotGap = 10;
  const totalW = (total - 1) * dotGap;
  const dotStartX = DESIGN_W / 2 - totalW / 2;
  for (let i = 0; i < total; i += 1) {
    const x = dotStartX + i * dotGap;
    const active = i === stepIndex;
    drawRect(ctx, x - 2, dotY - 2, 4, 4, active ? COLORS.amberBright : COLORS.amberDim);
  }
}

function drawTextPanel(ctx, y, h) {
  const panelX = 28;
  const panelW = DESIGN_W - 56;
  drawPanel(ctx, panelX, y, panelW, h, { border: COLORS.amberDim });

  drawText(ctx, stepKey('TITLE'), panelX + 14, y + 18, {
    size: 14,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, panelX + 12, y + 28, panelW - 24, 1, COLORS.amberDim);

  const bodyX = panelX + 14;
  const bodyY = y + 36;
  const bodyW = panelW - 28;
  const lineH = 13;
  const maxLines = Math.max(3, Math.floor((h - 46) / lineH));
  let lineCount = 0;
  const paragraphs = String(stepKey('BODY') || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (lineCount >= maxLines) break;

    const isBullet = paragraph.startsWith('- ');
    const text = isBullet ? paragraph.slice(2).trim() : paragraph;
    const textX = isBullet ? bodyX + 10 : bodyX;
    const textW = isBullet ? bodyW - 10 : bodyW;
    const lines = wrapTextLines(ctx, text, textW, 11, UI_FONT);

    for (let i = 0; i < lines.length; i += 1) {
      if (lineCount >= maxLines) break;
      const yPos = bodyY + lineCount * lineH;
      if (isBullet && i === 0) {
        drawRect(ctx, bodyX, yPos + 4, 4, 4, COLORS.amberBright);
      }
      drawText(ctx, lines[i], textX, yPos, {
        size: 11,
        color: isBullet ? COLORS.cream : COLORS.creamDim,
        font: UI_FONT,
        baseline: 'top',
      });
      lineCount += 1;
    }
  }

  const state = currentStateLabel();
  if (state) {
    const cycle = activeCycle();
    const suffix = cycle ? `  ${cycleIndex + 1}/${cycle.length}` : '';
    drawText(ctx, `${state}${suffix}`, panelX + panelW - 14, y + 18, {
      size: 12,
      color: COLORS.amberBright,
      align: 'right',
      font: UI_FONT,
      baseline: 'middle',
    });
  }
}

function drawPolygraphDemo(ctx) {
  drawPolygraph(ctx, 0, 290, 600, 110, {
    waves: sandbox.wave,
    time: sandbox.time,
    biometric: getBiometricDrawData(sandbox),
    fearBar: demoFearDisplay,
    maxFearBar: 100,
    fearFlash: demoFearFlash,
    laneFlash,
    markers: [],
    activeMarker: null,
  });
}

function drawCctvDemo(ctx) {
  const badgeW = 110;
  const badgeH = 96;
  const x = DESIGN_W / 2 - badgeW / 2;
  const y = 262;
  const entry = currentCycleEntry();
  const cue = entry?.cue || 'STONE_FACE';
  const style = classifyCctv(cue);
  const cueLabel = resolveCctvCueLabel(cue);
  drawPortraitBadge(ctx, x, y, badgeW, badgeH, 'defendant', cueLabel, {
    style,
    intensity: 1,
    time: sandbox.time,
  });
}

function drawFooter(ctx) {
  simPrevRect = null;
  simNextRect = null;
  simCenterRect = null;

  const cycle = activeCycle();
  if (cycle) {
    const barW = 232;
    const barH = 16;
    const barX = DESIGN_W / 2 - barW / 2;
    const barY = simControlY;
    const arrowW = 20;
    simPrevRect = { x: barX, y: barY, w: arrowW, h: barH };
    simNextRect = { x: barX + barW - arrowW, y: barY, w: arrowW, h: barH };
    simCenterRect = { x: barX + arrowW, y: barY, w: barW - arrowW * 2, h: barH };

    const mouse = getMousePos();
    const prevHover = inRect(mouse, simPrevRect);
    const centerHover = inRect(mouse, simCenterRect);
    const nextHover = inRect(mouse, simNextRect);
    const pulse = 0.78 + 0.22 * Math.abs(Math.sin(sandbox.time * 2.6));

    drawPanel(ctx, barX, barY, barW, barH, {
      border: COLORS.amberDim,
      fill: 'rgba(20, 14, 8, 0.68)',
    });

    drawRect(
      ctx,
      simPrevRect.x,
      simPrevRect.y,
      simPrevRect.w,
      simPrevRect.h,
      prevHover ? 'rgba(56, 34, 14, 0.82)' : 'rgba(0, 0, 0, 0)'
    );
    drawText(ctx, '<', simPrevRect.x + simPrevRect.w / 2, simPrevRect.y + simPrevRect.h / 2 + 1, {
      size: 12,
      color: prevHover ? COLORS.amberBright : COLORS.creamDim,
      align: 'center',
      font: UI_FONT,
      baseline: 'middle',
    });

    drawRect(
      ctx,
      simCenterRect.x,
      simCenterRect.y,
      simCenterRect.w,
      simCenterRect.h,
      centerHover ? 'rgba(44, 28, 12, 0.55)' : 'rgba(0, 0, 0, 0)'
    );
    drawText(
      ctx,
      `${t('BRIEFING_SIM_LABEL')}  ${cycleIndex + 1}/${cycle.length}  ·  ${t('BRIEFING_SIM_HINT')}`,
      simCenterRect.x + simCenterRect.w / 2,
      simCenterRect.y + simCenterRect.h / 2 + 1,
      {
        size: 9,
        color: COLORS.amberBright,
        align: 'center',
        font: UI_FONT,
        baseline: 'middle',
      }
    );

    ctx.save();
    ctx.globalAlpha = nextHover ? 1 : pulse;
    drawRect(
      ctx,
      simNextRect.x,
      simNextRect.y,
      simNextRect.w,
      simNextRect.h,
      nextHover ? 'rgba(56, 34, 14, 0.88)' : 'rgba(44, 28, 12, 0.36)'
    );
    ctx.restore();
    drawText(ctx, '>', simNextRect.x + simNextRect.w / 2, simNextRect.y + simNextRect.h / 2 + 1, {
      size: 10,
      color: COLORS.amberBright,
      align: 'center',
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const parts = [
    `${stepIndex + 1} / ${STEPS.length}`,
    t('BRIEFING_HINT_NEXT'),
    t('BRIEFING_HINT_BACK'),
  ];
  parts.push(t('BRIEFING_HINT_EXIT'));
  drawText(ctx, parts.join('  ·  '), DESIGN_W / 2, DESIGN_H - 12, {
    size: 10,
    color: COLORS.creamDim,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawBriefingScene(ctx) {
  drawSceneBackground(ctx);
  drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, 'rgba(0,0,0,0.55)');

  drawHeader(ctx);

  const step = STEPS[stepIndex];
  if (step === 'cctv') {
    drawTextPanel(ctx, 56, 136);
    simControlY = 228;
    drawCctvDemo(ctx);
  } else if (step === 'intro' || step === 'modifiers' || step === 'close') {
    simControlY = DESIGN_H - 36;
    drawTextPanel(ctx, 56, 240);
  } else {
    drawTextPanel(ctx, 56, 204);
    simControlY = 266;
    drawPolygraphDemo(ctx);
  }

  drawFooter(ctx);
}

export function registerBriefingScene(_canvas, ctx) {
  registerScene('briefing', {
    enter() {
      resetSandbox();
      stepIndex = 0;
      enterStep(0);
      simPrevRect = null;
      simNextRect = null;
      simCenterRect = null;
      simControlY = DESIGN_H - 36;
      applyAmbientProfile('menu');
    },
    update(dt) {
      sandbox.time += dt;
      updateWave(sandbox, dt);

      const fearDiff = demoFearBar - demoFearDisplay;
      demoFearDisplay += fearDiff * Math.min(1, dt * 6);
      demoFearFlash = Math.max(0, demoFearFlash - dt * 2);
      laneFlash.heartRate = Math.max(0, laneFlash.heartRate - dt * 1.8);
      laneFlash.breathing = Math.max(0, laneFlash.breathing - dt * 1.8);
      laneFlash.gsr = Math.max(0, laneFlash.gsr - dt * 1.8);

      if (wasKeyPressed('escape')) {
        markBriefingSeen();
        setScene('menu');
        return;
      }
      if (wasKeyPressed(' ')) {
        if (activeCycle()) {
          advanceCycle();
          return;
        }
      }
      if (wasKeyPressed('arrowup') && activeCycle()) {
        retreatCycle();
        return;
      }
      if (wasKeyPressed('arrowdown') && activeCycle()) {
        advanceCycle();
        return;
      }
      if (wasMousePressed(0) && activeCycle()) {
        const mouse = getMousePos();
        if (inRect(mouse, simPrevRect)) {
          retreatCycle();
          return;
        }
        if (inRect(mouse, simCenterRect)) {
          advanceCycle();
          return;
        }
        if (inRect(mouse, simNextRect)) {
          advanceCycle();
          return;
        }
      }
      if (
        wasKeyPressed('enter') ||
        wasKeyPressed('arrowright') ||
        wasKeyPressed('d') ||
        wasMousePressed(0)
      ) {
        if (stepIndex >= STEPS.length - 1) {
          markBriefingSeen();
          setScene('menu');
          return;
        }
        enterStep(stepIndex + 1);
        return;
      }
      if (wasKeyPressed('arrowleft') || wasKeyPressed('a')) {
        if (stepIndex > 0) {
          enterStep(stepIndex - 1);
        }
        return;
      }
    },
    render() {
      drawBriefingScene(ctx);
    },
  });
}
