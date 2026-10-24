import { drawRect, drawScrollableText, drawText, drawWrappedText, wrapTextLines } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import {
  getMousePos,
  getPlatformScrollDelta,
  toUnifiedScrollLines,
  toUnifiedScrollPixels,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import {
  finalizeCurrentMarkerCapture,
  getSelectedCaseDef,
  getSuspectLabel,
  state,
} from '../game/state.js';
import { recordAttempt } from '../game/caseStats.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { drawDossierPanel } from '../ui/dossierPanel.js';
import { t } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { playCaseCloseSlam } from '../audio.js';
import {
  getScrollTarget,
  resetScroll,
  setScrollTarget,
  tickScrollOffset,
} from '../smoothScroll.js';

const VERDICT_GUILTY = 'GUILTY';
const VERDICT_NOT_GUILTY = 'NOT_GUILTY';

let buttonRects = [];
let anim = 0;
let listScrollOffset = 0;
let listMaxScroll = 0;
let listViewportRect = null;
let dossierScrollOffset = 0;
let dossierMaxScroll = 0;
let dossierViewportRect = null;
let summaryScrollOffset = 0;
let summaryMaxScroll = 0;
let summaryViewportRect = null;
let pendingVerdict = null;
let confirmOkRect = null;
let confirmCancelRect = null;

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function drawMiniWave(ctx, x, y, w, h, samples, color, type) {
  drawRect(ctx, x, y, w, h, 'rgba(20, 12, 6, 0.55)');
  drawRect(ctx, x, y + h / 2, w, 1, 'rgba(70, 48, 22, 0.35)');
  if (!samples || samples.length < 2) {
    return;
  }

  const midY = y + h / 2;
  const gain = type === 'heart' ? h * 0.4 : type === 'breathing' ? h * 0.48 : h * 0.72;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const count = samples.length;
  for (let i = 0; i < w; i += 1) {
    const sampleIdx = Math.floor((i / Math.max(1, w - 1)) * Math.max(0, count - 1));
    const sample = samples[sampleIdx] || 0;
    const px = x + i;
    const py = Math.max(y + 1, Math.min(y + h - 1, midY - sample * gain));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMiniStressColumn(ctx, x, y, w, h, fearLevel = 0, maxFearBar = 100) {
  drawRect(ctx, x, y, w, h, COLORS.fearTrack);

  const safeMax = Math.max(1, Number(maxFearBar) || 100);
  const level = Math.max(0, Math.min(safeMax, Number(fearLevel) || 0));
  if (level > 0) {
    const ratio = level / safeMax;
    const fillH = Math.max(1, Math.floor(h * ratio));
    drawRect(ctx, x, y + h - fillH, w, fillH, COLORS.fear);
  }

  for (let i = 1; i < 4; i += 1) {
    const ty = y + Math.round((h * i) / 4);
    drawRect(ctx, x - 1, ty, 1, 1, COLORS.amberDim);
    drawRect(ctx, x + w, ty, 1, 1, COLORS.amberDim);
  }

  drawRect(ctx, x - 1, y, w + 2, 1, COLORS.amberDim);
  drawRect(ctx, x - 1, y + h - 1, w + 2, 1, COLORS.amberDim);
  drawRect(ctx, x - 1, y, 1, h, COLORS.amberDim);
  drawRect(ctx, x + w, y, 1, h, COLORS.amberDim);
}

const FIXED_ENTRY_H = 140;

function drawEvidenceEntry(ctx, x, y, w, h, index, evidence, marker, maxFearBar) {
  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amberDim,
    fill: 'rgba(14, 9, 6, 0.7)',
  });

  const padX = 6;
  const textW = w - padX * 2;
  const waveRowH = 10;
  const waveStackH = waveRowH * 3 + 14;
  const textAreaBottom = y + h - waveStackH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, textAreaBottom - y - 2);
  ctx.clip();

  drawText(ctx, `Q${index + 1}`, x + padX, y + 10, {
    size: 11,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const allQuestionLines = wrapTextLines(ctx, evidence.question, textW - 24, 11, UI_FONT);
  const qLines = allQuestionLines.slice(0, 3);
  if (qLines.length > 0 && allQuestionLines.length > 3) {
    qLines[qLines.length - 1] = `${qLines[qLines.length - 1]}...`;
  }
  for (let i = 0; i < qLines.length; i += 1) {
    drawText(ctx, qLines[i], x + padX + 24, y + 10 + i * 11, {
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const answerY = y + 10 + qLines.length * 11 + 6;
  drawText(ctx, `${getSuspectLabel()}:`, x + padX, answerY, {
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
  const answerLinesRoom = Math.max(1, Math.floor((textAreaBottom - (answerY + 11)) / 11));
  const allAnswerLines = wrapTextLines(ctx, evidence.answer || '', textW, 11, UI_FONT);
  const aLines = allAnswerLines.slice(0, answerLinesRoom);
  if (aLines.length > 0 && allAnswerLines.length > answerLinesRoom) {
    aLines[aLines.length - 1] = `${aLines[aLines.length - 1]}...`;
  }
  for (let i = 0; i < aLines.length; i += 1) {
    drawText(ctx, aLines[i], x + padX, answerY + (i + 1) * 11, {
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
  }
  ctx.restore();

  const waveLabelW = 22;
  const stressW = 8;
  const stressGap = 4;
  const waveX = x + padX + waveLabelW;
  const waveW = textW - waveLabelW - stressW - stressGap;
  const stressX = waveX + waveW + stressGap;
  const waveStartY = y + h - waveRowH * 3 - 4;
  const stressY = waveStartY;
  const stressH = waveRowH * 3;
  const samples = marker?.samples || { hr: [], breathing: [], gsr: [] };

  drawText(ctx, t('VERDICT_WAVE_HR'), x + padX, waveStartY + waveRowH / 2, {
    size: 9,
    color: COLORS.pulse,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(ctx, waveX, waveStartY, waveW, waveRowH, samples.hr, COLORS.pulse, 'heart');

  drawText(ctx, t('VERDICT_WAVE_BREATHING'), x + padX, waveStartY + waveRowH + waveRowH / 2, {
    size: 9,
    color: COLORS.breathing,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(
    ctx,
    waveX,
    waveStartY + waveRowH,
    waveW,
    waveRowH,
    samples.breathing,
    COLORS.breathing,
    'breathing'
  );

  drawText(ctx, t('VERDICT_WAVE_GSR'), x + padX, waveStartY + waveRowH * 2 + waveRowH / 2, {
    size: 9,
    color: COLORS.gsr,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(
    ctx,
    waveX,
    waveStartY + waveRowH * 2,
    waveW,
    waveRowH,
    samples.gsr,
    COLORS.gsr,
    'gsr'
  );

  drawText(ctx, t('VERDICT_WAVE_STRESS'), stressX + stressW / 2, waveStartY - 2, {
    size: 9,
    color: COLORS.fear,
    align: 'center',
    font: UI_FONT,
    baseline: 'bottom',
  });
  drawMiniStressColumn(ctx, stressX, stressY, stressW, stressH, evidence.fearLevel, maxFearBar);
}

function drawVerdictButton(ctx, rect, label, subtitle, hovered, accent) {
  const border = hovered ? accent : COLORS.amberDim;
  const fill = hovered ? 'rgba(60, 36, 14, 0.85)' : COLORS.panelFillLight;
  drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, { border, fill });
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + 14, {
    align: 'center',
    size: 14,
    color: hovered ? accent : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawText(ctx, subtitle, rect.x + rect.w / 2, rect.y + 30, {
    align: 'center',
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawConfirmOverlay(ctx, verdict) {
  drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, 'rgba(4, 2, 1, 0.72)');

  const w = 260;
  const h = 96;
  const x = (DESIGN_W - w) / 2;
  const y = (DESIGN_H - h) / 2;
  drawPanel(ctx, x, y, w, h, { border: COLORS.amberBright, fill: 'rgba(14, 9, 6, 0.96)' });

  const accent = verdict === VERDICT_GUILTY ? COLORS.fail : COLORS.success;
  drawText(ctx, t('VERDICT_CONFIRM_TITLE'), x + w / 2, y + 18, {
    align: 'center',
    size: 14,
    color: accent,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, t('VERDICT_CONFIRM_BODY'), x + w / 2, y + 40, {
    align: 'center',
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const btnY = y + h - 28;
  const btnW = 108;
  const btnH = 18;
  const gap = 8;
  const leftX = x + (w - (btnW * 2 + gap)) / 2;
  confirmCancelRect = { x: leftX, y: btnY, w: btnW, h: btnH };
  confirmOkRect = { x: leftX + btnW + gap, y: btnY, w: btnW, h: btnH };

  const mouse = getMousePos();
  const cancelHover = inRect(mouse, confirmCancelRect);
  const okHover = inRect(mouse, confirmOkRect);

  drawPanel(
    ctx,
    confirmCancelRect.x,
    confirmCancelRect.y,
    confirmCancelRect.w,
    confirmCancelRect.h,
    {
      border: cancelHover ? COLORS.amberBright : COLORS.amberDim,
      fill: cancelHover ? 'rgba(56, 34, 14, 0.84)' : COLORS.panelFillLight,
    }
  );
  drawText(
    ctx,
    t('VERDICT_CONFIRM_NO'),
    confirmCancelRect.x + confirmCancelRect.w / 2,
    confirmCancelRect.y + confirmCancelRect.h / 2,
    {
      align: 'center',
      size: 10,
      color: cancelHover ? COLORS.amberBright : COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  drawPanel(ctx, confirmOkRect.x, confirmOkRect.y, confirmOkRect.w, confirmOkRect.h, {
    border: okHover ? accent : COLORS.amberDim,
    fill: okHover ? 'rgba(56, 34, 14, 0.84)' : COLORS.panelFillLight,
  });
  drawText(
    ctx,
    t('VERDICT_CONFIRM_YES'),
    confirmOkRect.x + confirmOkRect.w / 2,
    confirmOkRect.y + confirmOkRect.h / 2,
    {
      align: 'center',
      size: 10,
      color: okHover ? accent : COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    }
  );
}

function drawVerdictScene(ctx) {
  drawSceneBackground(ctx);
  confirmOkRect = null;
  confirmCancelRect = null;

  const panelX = 16;
  const panelY = 12;
  const panelW = DESIGN_W - 32;
  const panelH = DESIGN_H - 24;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  drawText(ctx, t('VERDICT_TITLE'), DESIGN_W / 2, panelY + 12, {
    align: 'center',
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, `${t('VERDICT_SUSPECT_PREFIX')}${getSuspectLabel()}`, DESIGN_W / 2, panelY + 26, {
    align: 'center',
    size: 10,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const btnH = 42;
  const buttonAreaH = btnH + 18;
  const areaX = panelX + 10;
  const areaY = panelY + 38;
  const areaW = panelW - 20;
  const areaH = panelH - (areaY - panelY) - buttonAreaH - 6;

  const splitGap = 8;
  const baseLeftW = 184;
  const leftW = Math.floor(baseLeftW * 1.1);
  const leftX = areaX;
  const rightX = leftX + leftW + splitGap;
  const rightW = areaW - leftW - splitGap;
  const baseSummaryH = 96;
  const summaryH = Math.floor(baseSummaryH * 1.1);
  const dossierY = areaY + summaryH + 6;
  const dossierH = areaH - summaryH - 6;

  drawPanel(ctx, leftX, areaY, leftW, summaryH, {
    border: COLORS.amberDim,
    fill: 'rgba(10, 6, 3, 0.5)',
  });

  const summaryInnerX = leftX + 6;
  const summaryInnerW = leftW - 14;
  let summaryCursorY = areaY + 6;

  drawText(ctx, t('VERDICT_SUMMARY_HEADER'), summaryInnerX, summaryCursorY, {
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'top',
  });
  summaryCursorY += 12;

  const caseDef = getSelectedCaseDef();
  const caseLabel = (caseDef?.label || '').toUpperCase();
  const caseLabelLines = drawWrappedText(
    ctx,
    caseLabel,
    summaryInnerX,
    summaryCursorY,
    summaryInnerW,
    {
      size: 10,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 10,
      maxLines: 2,
      baseline: 'top',
    }
  );
  summaryCursorY += Math.max(10, caseLabelLines * 10) + 4;

  drawText(ctx, t('DOSSIER_CASE_SUMMARY'), summaryInnerX, summaryCursorY, {
    size: 9,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'top',
  });
  summaryCursorY += 12;

  summaryViewportRect = {
    x: summaryInnerX,
    y: summaryCursorY,
    w: summaryInnerW,
    h: Math.max(20, areaY + summaryH - 6 - summaryCursorY),
  };
  const summaryScroll = drawScrollableText(
    ctx,
    state.gameData?.context || '',
    summaryViewportRect.x,
    summaryViewportRect.y,
    summaryViewportRect.w,
    summaryViewportRect.h,
    summaryScrollOffset,
    {
      size: 10,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 11,
      scrollbarTrackColor: COLORS.amberDim,
      scrollbarThumbColor: COLORS.amberBright,
    }
  );
  summaryMaxScroll = summaryScroll.maxScroll;

  dossierViewportRect = { x: leftX, y: dossierY, w: leftW, h: dossierH };
  const dossierScroll = drawDossierPanel(
    ctx,
    dossierViewportRect.x,
    dossierViewportRect.y,
    dossierViewportRect.w,
    dossierViewportRect.h,
    state.gameData?.dossier,
    state.gameData?.suspect,
    dossierScrollOffset
  );
  dossierMaxScroll = dossierScroll.maxScroll;

  const listX = rightX;
  const listY = areaY;
  const listW = rightW;
  const listH = areaH;

  drawPanel(ctx, listX, listY, listW, listH, {
    border: COLORS.amberDim,
    fill: 'rgba(10, 6, 3, 0.5)',
  });
  drawText(ctx, t('VERDICT_EVIDENCE_HEADER'), listX + 6, listY + 10, {
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const listHeaderH = 16;
  const listBodyY = listY + listHeaderH;
  const listBodyH = listH - listHeaderH;
  listViewportRect = { x: listX, y: listBodyY, w: listW, h: listBodyH };

  const scrollbarPad = 10;
  const columns = 1;
  const colGap = 6;
  const entryGap = 4;
  const sidePad = 5;
  const innerListW = listW - scrollbarPad - sidePad * 2;
  const entryW = Math.floor((innerListW - colGap * (columns - 1)) / columns);
  const col0X = listX + sidePad;
  const colX = (col) => col0X + col * (entryW + colGap);
  const evidence = state.evidence;
  const markers = state.polygraphMarkers;

  const rowCount = Math.ceil(evidence.length / columns);
  const totalH = rowCount * FIXED_ENTRY_H + Math.max(0, rowCount - 1) * entryGap;
  listMaxScroll = Math.max(0, totalH - (listBodyH - 8));

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX + 2, listBodyY + 2, listW - 4, listBodyH - 4);
  ctx.clip();

  let cursorY = listBodyY + 4 - listScrollOffset;
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const idx = r * columns + c;
      if (idx >= evidence.length) break;
      if (cursorY + FIXED_ENTRY_H >= listBodyY && cursorY <= listBodyY + listBodyH) {
        drawEvidenceEntry(
          ctx,
          colX(c),
          cursorY,
          entryW,
          FIXED_ENTRY_H,
          idx,
          evidence[idx],
          markers[idx],
          state.maxFearBar
        );
      }
    }
    cursorY += FIXED_ENTRY_H + entryGap;
  }
  ctx.restore();

  if (listMaxScroll > 0 && totalH > 0) {
    const trackX = listX + listW - 5;
    const trackY = listBodyY + 2;
    const trackH = listBodyH - 4;
    drawRect(ctx, trackX, trackY, 3, trackH, COLORS.amberDim);
    const thumbH = Math.max(12, (trackH * listBodyH) / totalH);
    const thumbRatio = listMaxScroll === 0 ? 0 : listScrollOffset / listMaxScroll;
    const thumbY = trackY + (trackH - thumbH) * thumbRatio;
    drawRect(ctx, trackX, thumbY, 3, thumbH, COLORS.amberBright);
  }

  if (evidence.length === 0) {
    drawText(ctx, t('VERDICT_NO_RECORD'), listX + listW / 2, listBodyY + listBodyH / 2, {
      align: 'center',
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const btnW = 200;
  const btnY = panelY + panelH - btnH - 6;
  const guiltyRect = {
    x: DESIGN_W / 2 - btnW - 8,
    y: btnY,
    w: btnW,
    h: btnH,
    verdict: VERDICT_GUILTY,
  };
  const notGuiltyRect = {
    x: DESIGN_W / 2 + 8,
    y: btnY,
    w: btnW,
    h: btnH,
    verdict: VERDICT_NOT_GUILTY,
  };
  buttonRects = [guiltyRect, notGuiltyRect];

  const mouse = getMousePos();
  drawVerdictButton(
    ctx,
    guiltyRect,
    t('VERDICT_GUILTY_BTN'),
    t('VERDICT_GUILTY_SUB'),
    inRect(mouse, guiltyRect),
    COLORS.fail
  );
  drawVerdictButton(
    ctx,
    notGuiltyRect,
    t('VERDICT_NOT_GUILTY_BTN'),
    t('VERDICT_NOT_GUILTY_SUB'),
    inRect(mouse, notGuiltyRect),
    COLORS.success
  );

  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 2.4));
  ctx.save();
  ctx.globalAlpha = pulse;
  drawText(ctx, t('VERDICT_INSTRUCTIONS'), DESIGN_W / 2, btnY - 4, {
    align: 'center',
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });
  ctx.restore();

  if (pendingVerdict) {
    drawConfirmOverlay(ctx, pendingVerdict);
  }
}

function submitVerdict(verdict) {
  playCaseCloseSlam(verdict === VERDICT_GUILTY ? 1 : 0.92);
  state.verdict = verdict;
  const correct = Boolean(state.trueVerdict) && verdict === state.trueVerdict;
  const caseDef = getSelectedCaseDef();
  if (caseDef?.id) {
    recordAttempt(caseDef.id, correct);
  }
  setScene('result');
}

export function registerVerdictScene(_canvas, ctx) {
  registerScene('verdict', {
    enter() {
      finalizeCurrentMarkerCapture();
      anim = 0;
      buttonRects = [];
      listScrollOffset = 0;
      listMaxScroll = 0;
      listViewportRect = null;
      dossierScrollOffset = 0;
      dossierMaxScroll = 0;
      dossierViewportRect = null;
      summaryScrollOffset = 0;
      summaryMaxScroll = 0;
      summaryViewportRect = null;
      resetScroll('verdict.list');
      resetScroll('verdict.dossier');
      resetScroll('verdict.summary');
      pendingVerdict = null;
      confirmOkRect = null;
      confirmCancelRect = null;
      applyAmbientProfile('verdict');
    },
    update(dt) {
      anim += dt;

      listScrollOffset = tickScrollOffset('verdict.list', dt, listMaxScroll);
      dossierScrollOffset = tickScrollOffset('verdict.dossier', dt, dossierMaxScroll);
      summaryScrollOffset = tickScrollOffset('verdict.summary', dt, summaryMaxScroll);

      if (pendingVerdict) {
        const mouse = getMousePos();
        if (wasKeyPressed('enter')) {
          submitVerdict(pendingVerdict);
          return;
        }
        if (wasKeyPressed('escape')) {
          pendingVerdict = null;
          return;
        }
        if (wasMousePressed(0)) {
          if (confirmOkRect && inRect(mouse, confirmOkRect)) {
            submitVerdict(pendingVerdict);
            return;
          }
          if (confirmCancelRect && inRect(mouse, confirmCancelRect)) {
            pendingVerdict = null;
            return;
          }
        }
        return;
      }

      const mouse = getMousePos();
      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        if (summaryMaxScroll > 0 && summaryViewportRect && inRect(mouse, summaryViewportRect)) {
          setScrollTarget(
            'verdict.summary',
            getScrollTarget('verdict.summary') + toUnifiedScrollLines(wheel),
            summaryMaxScroll
          );
        } else if (
          dossierMaxScroll > 0 &&
          dossierViewportRect &&
          inRect(mouse, dossierViewportRect)
        ) {
          setScrollTarget(
            'verdict.dossier',
            getScrollTarget('verdict.dossier') + toUnifiedScrollPixels(wheel),
            dossierMaxScroll
          );
        } else if (listMaxScroll > 0 && (!listViewportRect || inRect(mouse, listViewportRect))) {
          setScrollTarget(
            'verdict.list',
            getScrollTarget('verdict.list') + toUnifiedScrollPixels(wheel),
            listMaxScroll
          );
        }
      }
      if (wasKeyPressed('arrowup')) {
        setScrollTarget('verdict.list', getScrollTarget('verdict.list') - 12, listMaxScroll);
      }
      if (wasKeyPressed('arrowdown')) {
        setScrollTarget('verdict.list', getScrollTarget('verdict.list') + 12, listMaxScroll);
      }
      if (wasKeyPressed('1')) {
        pendingVerdict = VERDICT_GUILTY;
        return;
      }
      if (wasKeyPressed('2')) {
        pendingVerdict = VERDICT_NOT_GUILTY;
        return;
      }
      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }
      if (wasMousePressed(0)) {
        for (const rect of buttonRects) {
          if (inRect(mouse, rect)) {
            pendingVerdict = rect.verdict;
            return;
          }
        }
      }
    },
    render() {
      drawVerdictScene(ctx);
    },
  });
}
