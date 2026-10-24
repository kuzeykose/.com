import { drawRect, drawText, drawScrollableText, wrapTextLines } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import {
  getMousePos,
  getPlatformScrollDelta,
  toUnifiedScrollPixels,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import { state, getDefendantImageKey } from '../game/state.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { drawPortraitBadge } from '../ui/portraitBadge.js';
import { t, getLanguage } from '../i18n/index.js';
import { CASES } from '../game/cases.js';
import {
  getScrollTarget,
  resetScroll,
  setScrollTarget,
  tickScrollOffset,
} from '../smoothScroll.js';

let scroll = 0;
let maxScroll = 0;
let summaryScroll = 0;
let summaryMaxScroll = 0;
let startRect = null;
let summaryRect = null;
let anim = 0;

function inRect(point, rect) {
  return (
    rect &&
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function buildEntries(d) {
  const suspect = state.gameData?.suspect || {};
  const entries = [];

  entries.push({ type: 'heading', text: t('DOSSIER_IDENTITY') });
  entries.push({ type: 'kv', key: t('DOSSIER_NAME'), value: suspect.name || '-' });
  entries.push({ type: 'kv', key: t('DOSSIER_ROLE'), value: suspect.role || '-' });
  if (d?.age != null) entries.push({ type: 'kv', key: t('DOSSIER_AGE'), value: String(d.age) });
  if (d?.identity_summary) entries.push({ type: 'body', text: d.identity_summary });

  if (d?.family?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_FAMILY') });
    for (const f of d.family) {
      const header = `${f.relation}: ${f.name || ''}`.trim();
      entries.push({ type: 'item', label: header, detail: f.note || '' });
    }
  }

  if (d?.medical?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_HEALTH') });
    for (const m of d.medical) {
      entries.push({
        type: 'item',
        label: m.condition,
        detail: m.polygraph_effect || '',
        tag: t('DOSSIER_POLY_TAG'),
      });
    }
  }

  if (d?.habits?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_HABITS') });
    for (const h of d.habits) {
      entries.push({
        type: 'item',
        label: h.habit,
        detail: h.polygraph_effect || '',
        tag: t('DOSSIER_POLY_TAG'),
      });
    }
  }

  if (d?.priors?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_PRIORS') });
    for (const p of d.priors) entries.push({ type: 'body', text: `• ${p}` });
  }

  if (d?.pressure_points?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_PRESSURE') });
    for (const pp of d.pressure_points) entries.push({ type: 'body', text: `• ${pp}` });
  }

  return entries;
}

function layoutEntries(ctx, entries, width) {
  const layout = [];
  let y = 0;
  for (const e of entries) {
    if (e.type === 'heading') {
      layout.push({ ...e, y, h: 16 });
      y += 18;
    } else if (e.type === 'kv') {
      const valLines = wrapTextLines(ctx, e.value, width - 90, 11, UI_FONT);
      const h = Math.max(12, valLines.length * 12);
      layout.push({ ...e, y, h, valLines });
      y += h + 2;
    } else if (e.type === 'body') {
      const lines = wrapTextLines(ctx, e.text, width, 11, UI_FONT);
      const h = lines.length * 12;
      layout.push({ ...e, y, h, lines });
      y += h + 4;
    } else if (e.type === 'item') {
      const labelLines = wrapTextLines(ctx, e.label, width, 11, UI_FONT);
      const detailIndent = e.tag ? 40 : 8;
      const detailLines = wrapTextLines(ctx, e.detail, width - detailIndent, 11, UI_FONT);
      const h = labelLines.length * 12 + (detailLines.length > 0 ? detailLines.length * 12 + 2 : 0);
      layout.push({ ...e, y, h, labelLines, detailLines });
      y += h + 6;
    }
  }
  return { layout, totalHeight: y };
}

function drawDossierScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 16;
  const panelY = 14;
  const panelW = DESIGN_W - 32;
  const panelH = DESIGN_H - 28;
  const btnW = 240;
  const btnH = 32;
  const btnX = DESIGN_W / 2 - btnW / 2;
  const btnY = panelY + panelH - btnH - 10;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  drawText(ctx, t('DOSSIER_TITLE'), DESIGN_W / 2, panelY + 14, {
    align: 'center',
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const title = state.gameData?.title || '';
  drawText(ctx, title.toUpperCase(), DESIGN_W / 2, panelY + 28, {
    align: 'center',
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });

  const portraitX = panelX + 14;
  const portraitY = panelY + 44;
  const portraitW = 120;
  const portraitH = 150;
  drawPortraitBadge(
    ctx,
    portraitX,
    portraitY,
    portraitW,
    portraitH,
    getDefendantImageKey(),
    state.gameData?.suspect?.name?.toUpperCase() || t('DOSSIER_DEFAULT_NAME')
  );

  const contextX = portraitX;
  const contextY = portraitY + portraitH + 8;
  const contextW = portraitW;
  drawText(ctx, t('DOSSIER_CASE_SUMMARY'), contextX, contextY, {
    size: 11,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'top',
  });
  const summaryY = contextY + 14;
  const summaryH = Math.max(46, btnY - summaryY - 8);
  summaryRect = { x: contextX, y: summaryY, w: contextW, h: summaryH };
  drawRect(
    ctx,
    summaryRect.x - 2,
    summaryRect.y - 2,
    summaryRect.w + 4,
    summaryRect.h + 4,
    'rgba(14, 9, 6, 0.4)'
  );
  const summaryDraw = drawScrollableText(
    ctx,
    state.gameData?.context || '',
    summaryRect.x,
    summaryRect.y,
    summaryRect.w,
    summaryRect.h,
    summaryScroll,
    {
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 11,
      scrollbarTrackColor: COLORS.fearTrack,
      scrollbarThumbColor: COLORS.amberBright,
    }
  );
  summaryMaxScroll = summaryDraw.maxScroll;

  drawRect(ctx, summaryRect.x - 2, summaryRect.y - 2, summaryRect.w + 4, 1, COLORS.amberDim);
  drawRect(
    ctx,
    summaryRect.x - 2,
    summaryRect.y + summaryRect.h + 1,
    summaryRect.w + 4,
    1,
    COLORS.amberDim
  );
  drawRect(ctx, summaryRect.x - 2, summaryRect.y - 2, 1, summaryRect.h + 4, COLORS.amberDim);
  drawRect(
    ctx,
    summaryRect.x + summaryRect.w + 1,
    summaryRect.y - 2,
    1,
    summaryRect.h + 4,
    COLORS.amberDim
  );

  const contentX = portraitX + portraitW + 16;
  const contentY = panelY + 44;
  const contentW = panelW - (contentX - panelX) - 18;
  const contentH = panelH - (contentY - panelY) - 60;

  drawRect(ctx, contentX - 4, contentY - 4, contentW + 8, contentH + 8, 'rgba(14, 9, 6, 0.6)');
  drawRect(ctx, contentX - 4, contentY - 4, contentW + 8, 1, COLORS.amberDim);
  drawRect(ctx, contentX - 4, contentY + contentH + 3, contentW + 8, 1, COLORS.amberDim);
  drawRect(ctx, contentX - 4, contentY - 4, 1, contentH + 8, COLORS.amberDim);
  drawRect(ctx, contentX + contentW + 3, contentY - 4, 1, contentH + 8, COLORS.amberDim);

  const entries = buildEntries(state.gameData?.dossier);
  const { layout, totalHeight } = layoutEntries(ctx, entries, contentW - 8);
  maxScroll = Math.max(0, totalHeight - contentH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentW, contentH);
  ctx.clip();

  const originY = contentY - scroll;
  for (const row of layout) {
    const rowY = originY + row.y;
    if (rowY + row.h < contentY || rowY > contentY + contentH) continue;
    if (row.type === 'heading') {
      drawText(ctx, `[ ${row.text} ]`, contentX, rowY + 8, {
        size: 11,
        color: COLORS.amberBright,
        font: UI_FONT,
        baseline: 'middle',
      });
      drawRect(ctx, contentX, rowY + 14, contentW, 1, COLORS.amberDim);
    } else if (row.type === 'kv') {
      drawText(ctx, `${row.key}:`, contentX, rowY + 2, {
        size: 11,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'top',
      });
      for (let i = 0; i < row.valLines.length; i += 1) {
        drawText(ctx, row.valLines[i], contentX + 72, rowY + 2 + i * 12, {
          size: 11,
          color: COLORS.cream,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    } else if (row.type === 'body') {
      for (let i = 0; i < row.lines.length; i += 1) {
        drawText(ctx, row.lines[i], contentX, rowY + i * 12, {
          size: 11,
          color: COLORS.cream,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    } else if (row.type === 'item') {
      let cursorY = rowY;
      for (let i = 0; i < row.labelLines.length; i += 1) {
        drawText(ctx, row.labelLines[i], contentX, cursorY + i * 12, {
          size: 11,
          color: COLORS.amberBright,
          font: UI_FONT,
          baseline: 'top',
        });
      }
      cursorY += row.labelLines.length * 12;
      if (row.tag && row.detailLines.length > 0) {
        drawText(ctx, `[${row.tag}]`, contentX, cursorY + 2, {
          size: 9,
          color: COLORS.pulse,
          font: UI_FONT,
          baseline: 'top',
        });
      }
      for (let i = 0; i < row.detailLines.length; i += 1) {
        drawText(ctx, row.detailLines[i], contentX + (row.tag ? 40 : 8), cursorY + 2 + i * 12, {
          size: 11,
          color: COLORS.creamDim,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    }
  }

  ctx.restore();

  if (maxScroll > 0) {
    const trackX = contentX + contentW + 1;
    const trackY = contentY;
    const trackH = contentH;
    drawRect(ctx, trackX, trackY, 3, trackH, COLORS.fearTrack);
    const thumbH = Math.max(12, trackH * (contentH / totalHeight));
    const thumbY = trackY + (trackH - thumbH) * (scroll / maxScroll);
    drawRect(ctx, trackX, thumbY, 3, thumbH, COLORS.amberBright);
  }

  const caseDef = CASES[state.caseIndex];
  if (caseDef?.language && caseDef.language !== getLanguage()) {
    const warnY = panelY + panelH - 52;
    drawRect(ctx, panelX + 2, warnY - 7, panelW - 4, 14, 'rgba(14, 0, 0, 0.8)');
    drawText(ctx, t('WARN_LANG_MISMATCH'), DESIGN_W / 2, warnY, {
      align: 'center',
      size: 9,
      color: COLORS.fail,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  startRect = { x: btnX, y: btnY, w: btnW, h: btnH };
  const mouse = getMousePos();
  const hovered = inRect(mouse, startRect);
  drawPanel(ctx, btnX, btnY, btnW, btnH, {
    border: hovered ? COLORS.amberBright : COLORS.amber,
    fill: hovered ? 'rgba(60, 36, 14, 0.85)' : COLORS.panelFillLight,
  });
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 2.4));
  ctx.save();
  ctx.globalAlpha = pulse;
  drawText(ctx, t('DOSSIER_START_BTN'), DESIGN_W / 2, btnY + btnH / 2, {
    align: 'center',
    size: 12,
    color: hovered ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
  ctx.restore();

  drawText(ctx, t('DOSSIER_FOOTER'), panelX + 14, btnY + btnH / 2, {
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
}

export function registerDossierScene(_canvas, ctx) {
  registerScene('dossier', {
    enter() {
      scroll = 0;
      maxScroll = 0;
      summaryScroll = 0;
      summaryMaxScroll = 0;
      summaryRect = null;
      anim = 0;
      startRect = null;
      resetScroll('dossier.main');
      resetScroll('dossier.summary');
    },
    update(dt) {
      anim += dt;
      scroll = tickScrollOffset('dossier.main', dt, maxScroll);
      summaryScroll = tickScrollOffset('dossier.summary', dt, summaryMaxScroll);

      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        const delta = toUnifiedScrollPixels(wheel);
        const mouse = getMousePos();
        const overSummary = inRect(mouse, summaryRect);
        if (overSummary && summaryMaxScroll > 0) {
          setScrollTarget(
            'dossier.summary',
            getScrollTarget('dossier.summary') + delta,
            summaryMaxScroll
          );
        } else {
          setScrollTarget('dossier.main', getScrollTarget('dossier.main') + delta, maxScroll);
        }
      }
      if (wasKeyPressed('arrowdown') || wasKeyPressed('s')) {
        setScrollTarget('dossier.main', getScrollTarget('dossier.main') + 24, maxScroll);
      }
      if (wasKeyPressed('arrowup') || wasKeyPressed('w')) {
        setScrollTarget('dossier.main', getScrollTarget('dossier.main') - 24, maxScroll);
      }
      if (wasKeyPressed('enter')) {
        setScene('play');
        return;
      }
      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }
      if (wasMousePressed(0) && inRect(getMousePos(), startRect)) {
        setScene('play');
      }
    },
    render() {
      drawDossierScene(ctx);
    },
  });
}
