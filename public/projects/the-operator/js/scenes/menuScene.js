import { drawRect, drawText, drawWrappedText, drawScrollableText, wrapTextLines } from '../draw.js';
import { getImage } from '../assets.js';
import { registerScene, setScene } from '../sceneManager.js';
import {
  getMousePos,
  getPlatformScrollDelta,
  toUnifiedScrollLines,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import { clamp } from '../math.js';
import { CASES } from '../game/cases.js';
import { getStats } from '../game/caseStats.js';
import { getSelectedCaseData, setSelectedCase, state } from '../game/state.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t, getLanguage } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import {
  getScrollTarget,
  resetScroll,
  setScrollTarget,
  tickScrollOffset,
} from '../smoothScroll.js';

let menuAnim = 0;
let infoScrollOffset = 0;
let infoMaxScroll = 0;
let listScrollOffset = 0;
let listMaxScroll = 0;
let lastCaseIndex = -1;

function getVisibleCases() {
  const lang = getLanguage();
  return CASES.filter((c) => !c.language || c.language === lang);
}

function getVisibleIdx(visibleCases) {
  const currentDef = CASES[state.caseIndex];
  const idx = visibleCases.indexOf(currentDef);
  return idx >= 0 ? idx : 0;
}

function selectVisibleCase(visibleCases, visibleIdx) {
  const clamped = clamp(visibleIdx, 0, visibleCases.length - 1);
  const caseDef = visibleCases[clamped];
  if (caseDef) setSelectedCase(CASES.indexOf(caseDef));
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function parseLabel(label) {
  const sep = label.includes(' — ') ? ' — ' : ' - ';
  const dashIdx = label.indexOf(sep);
  if (dashIdx < 0) {
    return { prefix: label, suffix: '' };
  }
  return {
    prefix: label.slice(0, dashIdx),
    suffix: label.slice(dashIdx + sep.length),
  };
}

function drawStatusIcon(ctx, x, y, stats) {
  if (!stats || stats.attempts <= 0) return;

  const size = 12;
  const cx = x - size / 2;
  const cy = y - size / 2;
  const mid = size / 2;
  const pad = 2.5;

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stats.successes > 0) {
    // Checkmark — completed
    ctx.strokeStyle = COLORS.success;
    ctx.beginPath();
    ctx.moveTo(cx + pad, cy + mid);
    ctx.lineTo(cx + mid - 1, cy + size - pad - 1);
    ctx.lineTo(cx + size - pad, cy + pad);
    ctx.stroke();
  } else if (stats.fails > 0) {
    // X — failed (wrong verdict)
    ctx.strokeStyle = COLORS.fail;
    ctx.beginPath();
    ctx.moveTo(cx + pad, cy + pad);
    ctx.lineTo(cx + size - pad, cy + size - pad);
    ctx.moveTo(cx + size - pad, cy + pad);
    ctx.lineTo(cx + pad, cy + size - pad);
    ctx.stroke();
  } else {
    // Dash — attempted (bad end, no verdict made)
    ctx.strokeStyle = COLORS.amber;
    ctx.beginPath();
    ctx.moveTo(cx + pad, cy + mid);
    ctx.lineTo(cx + size - pad, cy + mid);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCaseCard(ctx, x, y, w, h, opts) {
  const { number, prefix, suffix, selected, hovered, pulseT, stats, characterImage } = opts;
  const borderColor = selected ? COLORS.amberBright : hovered ? COLORS.amber : COLORS.amberDim;
  const fillColor = selected
    ? 'rgba(60, 36, 14, 0.8)'
    : hovered
      ? 'rgba(30, 20, 10, 0.65)'
      : COLORS.panelFillLight;

  drawPanel(ctx, x, y, w, h, { border: borderColor, fill: fillColor });

  if (characterImage) {
    const imgSize = h - 4;
    const imgX = x + 2;
    const imgY = y + 2;
    ctx.drawImage(characterImage, imgX, imgY, imgSize, imgSize);
  } else {
    drawText(ctx, number, x + 12, y + h / 2, {
      size: 18,
      color: selected ? COLORS.amberBright : COLORS.amber,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const dividerX = characterImage ? x + h - 2 : x + 36;
  drawRect(ctx, dividerX, y + 6, 1, h - 12, COLORS.amberDim);

  const textX = characterImage ? x + h + 4 : x + 44;
  const textW = characterImage ? w - h - 12 : w - 52;

  const hasStatus = stats && stats.attempts > 0;
  const suffixW = hasStatus ? textW - 18 : textW;

  const titleLineH = 12;
  const titleLines = wrapTextLines(ctx, prefix, textW, 11, UI_FONT).slice(0, 2);
  const titleTop = y + 7;
  for (let i = 0; i < titleLines.length; i += 1) {
    drawText(ctx, titleLines[i], textX, titleTop + i * titleLineH, {
      size: 11,
      color: selected ? COLORS.amberBright : COLORS.cream,
      font: UI_FONT,
      baseline: 'top',
    });
  }

  const suffixY = titleTop + titleLines.length * titleLineH + 1;
  const suffixMaxLines = titleLines.length >= 2 ? 1 : 2;
  drawWrappedText(ctx, suffix, textX, suffixY, suffixW, {
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 11,
    maxLines: suffixMaxLines,
    baseline: 'top',
  });

  drawStatusIcon(ctx, x + w - 6, y + h - 6, stats);

  if (selected) {
    const pulse = 0.5 + 0.5 * Math.sin(pulseT * 3);
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.55;
    drawRect(ctx, x + 2, y + 2, w - 4, 1, COLORS.amberBright);
    drawRect(ctx, x + 2, y + h - 3, w - 4, 1, COLORS.amberBright);
    ctx.restore();
  }
}

function drawMenuScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 20;
  const panelY = 20;
  const panelW = DESIGN_W - 40;
  const panelH = DESIGN_H - 40;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  const titleP = smoothstep(clamp(menuAnim / 0.4, 0, 1));
  if (titleP > 0.01) {
    const titleY = -28 + (52 - -28) * titleP;
    ctx.save();
    ctx.globalAlpha = titleP;
    drawText(ctx, t('APP_TITLE'), DESIGN_W / 2, titleY, {
      align: 'center',
      size: 28,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }

  const subtitleP = smoothstep(clamp((menuAnim - 0.3) / 0.3, 0, 1));
  if (subtitleP > 0.01) {
    ctx.save();
    ctx.globalAlpha = subtitleP;
    drawText(ctx, t('MENU_CASE_SELECT'), DESIGN_W / 2, 78, {
      align: 'center',
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }

  state.menuCaseRects = [];
  const cardW = 192;
  const cardH = 44;
  const cardGap = 6;
  const listX = 28;
  const listStartY = 96;
  const listAreaH = DESIGN_H - listStartY - 56;
  const mouse = getMousePos();

  const visibleCases = getVisibleCases();
  const visibleIdx = getVisibleIdx(visibleCases);

  const totalListH =
    visibleCases.length > 0 ? visibleCases.length * (cardH + cardGap) - cardGap : 0;
  listMaxScroll = Math.max(0, totalListH - listAreaH);

  if (visibleCases.length === 0) {
    const noP = smoothstep(clamp((menuAnim - 0.5) / 0.35, 0, 1));
    if (noP > 0.01) {
      ctx.save();
      ctx.globalAlpha = noP;
      drawText(ctx, t('MENU_NO_CASES'), listX + cardW / 2, listStartY + 24, {
        align: 'center',
        size: 11,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'middle',
      });
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX - 2, listStartY, cardW + 4, listAreaH);
  ctx.clip();

  for (let i = 0; i < visibleCases.length; i += 1) {
    const caseDef = visibleCases[i];
    const y = listStartY + i * (cardH + cardGap) - listScrollOffset;
    const rect = { x: listX, y, w: cardW, h: cardH, index: i };
    state.menuCaseRects.push(rect);

    const cardStart = 0.5 + i * 0.12;
    const cardP = smoothstep(clamp((menuAnim - cardStart) / 0.35, 0, 1));
    if (cardP < 0.01) {
      continue;
    }

    const xOffset = (1 - cardP) * 16;
    const selected = i === visibleIdx;
    const interactive = cardP > 0.6;
    const hovered = interactive && inRect(mouse, rect);

    const { prefix, suffix } = parseLabel(caseDef.label);
    const numberStr = String(i + 1).padStart(2, '0');
    const characterImage = getImage(`defendant-${caseDef.id}`);

    ctx.globalAlpha = cardP;
    drawCaseCard(ctx, listX - xOffset, y, cardW, cardH, {
      number: numberStr,
      prefix,
      suffix,
      selected,
      hovered,
      pulseT: menuAnim,
      stats: getStats(caseDef.id),
      characterImage,
    });
  }

  ctx.restore();

  if (listMaxScroll > 0) {
    const sbX = listX + cardW + 3;
    const sbY = listStartY;
    const sbH = listAreaH;
    const sbW = 3;
    drawRect(ctx, sbX, sbY, sbW, sbH, COLORS.amberDim);
    const thumbH = Math.max(16, (listAreaH / totalListH) * sbH);
    const thumbY = sbY + (listScrollOffset / listMaxScroll) * (sbH - thumbH);
    drawRect(ctx, sbX, thumbY, sbW, thumbH, COLORS.amberBright);
  }

  const infoP = smoothstep(clamp((menuAnim - 0.85) / 0.4, 0, 1));
  if (infoP > 0.01) {
    const caseData = getSelectedCaseData();
    const infoX = listX + cardW + 12;
    const infoW = DESIGN_W - infoX - 28;
    const infoBaseY = listStartY;
    const infoH = DESIGN_H - listStartY - 56;
    const infoYOffset = (1 - infoP) * 14;
    const infoY = infoBaseY + infoYOffset;

    ctx.save();
    ctx.globalAlpha = infoP;
    drawPanel(ctx, infoX, infoY, infoW, infoH, { border: COLORS.amberDim });

    if (caseData) {
      const titleLineCount = drawWrappedText(
        ctx,
        caseData.title,
        infoX + infoW / 2,
        infoY + 10,
        infoW - 24,
        {
          align: 'center',
          size: 12,
          color: COLORS.amberBright,
          font: UI_FONT,
          baseline: 'top',
          lineHeight: 15,
          maxLines: 3,
        }
      );
      const titleBlockH = titleLineCount * 15 + 10;
      const scrollResult = drawScrollableText(
        ctx,
        caseData.context,
        infoX + 12,
        infoY + titleBlockH,
        infoW - 24,
        infoH - titleBlockH - 8,
        infoScrollOffset,
        {
          size: 12,
          color: COLORS.cream,
          font: UI_FONT,
          lineHeight: 12,
          scrollbarTrackColor: COLORS.amberDim,
          scrollbarThumbColor: COLORS.amberBright,
        }
      );
      infoMaxScroll = scrollResult.maxScroll;
    } else {
      drawText(ctx, t('MENU_CASE_LOAD_ERROR'), infoX + infoW / 2, infoY + infoH / 2, {
        align: 'center',
        size: 12,
        color: COLORS.fail,
        font: UI_FONT,
        baseline: 'middle',
      });
    }

    ctx.restore();
  }

  const promptP = smoothstep(clamp((menuAnim - 1.2) / 0.3, 0, 1));
  if (promptP > 0.01) {
    ctx.save();
    ctx.globalAlpha = promptP * 0.6;
    drawText(ctx, t('MENU_FULLSCREEN_HINT'), 28, DESIGN_H - 28, {
      align: 'left',
      size: 10,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
    drawText(
      ctx,
      `${t('MENU_BRIEFING_HINT')}  ·  ${t('MENU_SETTINGS_HINT')}`,
      DESIGN_W - 28,
      DESIGN_H - 28,
      {
        align: 'right',
        size: 10,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'middle',
      }
    );
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = promptP;
    drawText(
      ctx,
      `1-${visibleCases.length} / ${t('MENU_KEY_INSTRUCTIONS')}`,
      DESIGN_W / 2,
      DESIGN_H - 44,
      {
        align: 'center',
        size: 12,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'middle',
      }
    );
    ctx.restore();

    const blink = 0.45 + 0.55 * Math.abs(Math.sin(menuAnim * 2.6));
    ctx.save();
    ctx.globalAlpha = promptP * blink;
    drawText(ctx, t('MENU_ENTER_START'), DESIGN_W / 2, DESIGN_H - 28, {
      align: 'center',
      size: 12,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }
}

export function registerMenuScene(_canvas, ctx) {
  registerScene('menu', {
    enter() {
      menuAnim = 0;
      infoScrollOffset = 0;
      infoMaxScroll = 0;
      listScrollOffset = 0;
      listMaxScroll = 0;
      lastCaseIndex = -1;
      resetScroll('menu.list');
      resetScroll('menu.info');
      applyAmbientProfile('menu');

      const visible = getVisibleCases();
      if (visible.length > 0 && !visible.includes(CASES[state.caseIndex])) {
        setSelectedCase(CASES.indexOf(visible[0]));
      }
    },
    update(dt) {
      menuAnim += dt;

      listScrollOffset = tickScrollOffset('menu.list', dt, listMaxScroll);
      infoScrollOffset = tickScrollOffset('menu.info', dt, infoMaxScroll);

      if (state.caseIndex !== lastCaseIndex) {
        lastCaseIndex = state.caseIndex;
        setScrollTarget('menu.info', 0, infoMaxScroll);

        const cardH = 44;
        const cardGap = 6;
        const listStartY = 96;
        const listAreaH = DESIGN_H - listStartY - 56;
        const visibleForScroll = getVisibleCases();
        const selectedIdx = getVisibleIdx(visibleForScroll);
        const cardTop = selectedIdx * (cardH + cardGap);
        const cardBottom = cardTop + cardH;
        const currentTarget = getScrollTarget('menu.list');
        let nextTarget = currentTarget;
        if (cardTop < currentTarget) {
          nextTarget = cardTop;
        } else if (cardBottom > currentTarget + listAreaH) {
          nextTarget = cardBottom - listAreaH;
        }
        setScrollTarget('menu.list', nextTarget, listMaxScroll);
      }

      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        const mouse = getMousePos();
        const cardW = 192;
        const listX = 28;
        const listStartY = 96;
        const listAreaH = DESIGN_H - listStartY - 56;
        const infoX = listX + cardW + 12;
        const mouseOverList =
          mouse.x >= listX &&
          mouse.x <= listX + cardW + 6 &&
          mouse.y >= listStartY &&
          mouse.y <= listStartY + listAreaH;
        if (mouseOverList) {
          setScrollTarget(
            'menu.list',
            getScrollTarget('menu.list') + toUnifiedScrollLines(wheel) * 50,
            listMaxScroll
          );
        } else if (mouse.x >= infoX) {
          setScrollTarget(
            'menu.info',
            getScrollTarget('menu.info') + toUnifiedScrollLines(wheel),
            infoMaxScroll
          );
        }
      }

      const visible = getVisibleCases();
      const vIdx = getVisibleIdx(visible);

      for (let i = 0; i < Math.min(visible.length, 9); i += 1) {
        if (wasKeyPressed(String(i + 1))) {
          selectVisibleCase(visible, i);
        }
      }
      if (
        wasKeyPressed('arrowleft') ||
        wasKeyPressed('arrowup') ||
        wasKeyPressed('a') ||
        wasKeyPressed('w')
      ) {
        selectVisibleCase(visible, vIdx - 1);
      }
      if (
        wasKeyPressed('arrowright') ||
        wasKeyPressed('arrowdown') ||
        wasKeyPressed('d') ||
        wasKeyPressed('s')
      ) {
        selectVisibleCase(visible, vIdx + 1);
      }

      if (wasMousePressed(0) && state.menuCaseRects.length > 0) {
        const mouse = getMousePos();
        for (const rect of state.menuCaseRects) {
          if (inRect(mouse, rect)) {
            selectVisibleCase(visible, rect.index);
            break;
          }
        }
      }

      if (wasKeyPressed('s')) {
        setScene('settings');
        return;
      }
      if (wasKeyPressed('b')) {
        setScene('briefing');
        return;
      }
      if (wasKeyPressed('enter') && state.gameData) {
        setScene('dossier');
      }
    },
    render() {
      drawMenuScene(ctx);
    },
  });
}
