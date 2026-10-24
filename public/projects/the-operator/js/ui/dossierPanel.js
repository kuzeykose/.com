import { drawRect, drawText, wrapTextLines } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';

function buildEntries(d, suspect) {
  const entries = [];
  entries.push({ type: 'heading', text: t('DOSSIER_IDENTITY') });
  entries.push({ type: 'kv', key: t('DOSSIER_NAME'), value: suspect?.name || '-' });
  entries.push({ type: 'kv', key: t('DOSSIER_ROLE'), value: suspect?.role || '-' });
  if (d?.age != null) entries.push({ type: 'kv', key: t('DOSSIER_AGE'), value: String(d.age) });
  if (d?.identity_summary) entries.push({ type: 'body', text: d.identity_summary });

  if (d?.family?.length) {
    entries.push({ type: 'heading', text: t('DOSSIER_FAMILY') });
    for (const f of d.family) {
      entries.push({
        type: 'item',
        label: `${f.relation}: ${f.name || ''}`.trim(),
        detail: f.note || '',
      });
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
      layout.push({ ...e, y, h: 14 });
      y += 16;
    } else if (e.type === 'kv') {
      const valLines = wrapTextLines(ctx, e.value, width - 48, 10, UI_FONT);
      const h = Math.max(11, valLines.length * 11);
      layout.push({ ...e, y, h, valLines });
      y += h + 2;
    } else if (e.type === 'body') {
      const lines = wrapTextLines(ctx, e.text, width, 10, UI_FONT);
      const h = lines.length * 11;
      layout.push({ ...e, y, h, lines });
      y += h + 3;
    } else if (e.type === 'item') {
      const labelLines = wrapTextLines(ctx, e.label, width, 10, UI_FONT);
      const detailIndent = e.tag ? 34 : 6;
      const detailLines = wrapTextLines(ctx, e.detail, width - detailIndent, 10, UI_FONT);
      const h = labelLines.length * 11 + (detailLines.length > 0 ? detailLines.length * 11 + 2 : 0);
      layout.push({ ...e, y, h, labelLines, detailLines });
      y += h + 4;
    }
  }
  return { layout, totalHeight: y };
}

function drawTabTexture(ctx, x, y, w, h) {
  for (let yy = y + 3; yy < y + h - 3; yy += 3) {
    for (let xx = x + 2; xx < x + w - 2; xx += 2) {
      const seed = (xx * 13 + yy * 7) % 11;
      if (seed < 3) {
        drawRect(ctx, xx, yy, 1, 1, 'rgba(255, 245, 220, 0.04)');
      } else if (seed > 8) {
        drawRect(ctx, xx, yy, 1, 1, 'rgba(12, 9, 7, 0.28)');
      }
    }
  }
}

export function drawDossierTab(ctx, x, y, w, h, expanded, hovered = false) {
  if (hovered) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    drawRect(ctx, x - 1, y - 1, w + 2, h + 2, COLORS.amberBright);
    ctx.restore();
  }

  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amberDim,
    fill: hovered ? 'rgba(20, 14, 8, 0.95)' : 'rgba(14, 9, 6, 0.92)',
  });

  drawRect(
    ctx,
    x + 1,
    y + 1,
    w - 2,
    h - 2,
    hovered ? 'rgba(24, 18, 12, 0.42)' : 'rgba(18, 13, 9, 0.5)'
  );
  drawTabTexture(ctx, x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = 5;
  const arrow = expanded
    ? [
        [cx + size / 2, cy - size],
        [cx - size / 2, cy],
        [cx + size / 2, cy + size],
      ]
    : [
        [cx - size / 2, cy - size],
        [cx + size / 2, cy],
        [cx - size / 2, cy + size],
      ];

  ctx.save();
  ctx.fillStyle = 'rgba(130, 111, 82, 0.88)';
  ctx.beginPath();
  ctx.moveTo(arrow[0][0], arrow[0][1]);
  ctx.lineTo(arrow[1][0], arrow[1][1]);
  ctx.lineTo(arrow[2][0], arrow[2][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawDossierPanel(ctx, x, y, w, h, dossier, suspect, scrollOffset) {
  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amber,
    fill: 'rgba(14, 9, 6, 0.95)',
  });

  drawText(ctx, t('DOSSIER_TITLE'), x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const scrollbarW = 3;
  const contentX = x + 8;
  const contentY = y + 22;
  const contentW = w - 16 - scrollbarW;
  const contentH = h - 28;

  const entries = buildEntries(dossier, suspect);
  const { layout, totalHeight } = layoutEntries(ctx, entries, contentW);
  const maxScroll = Math.max(0, totalHeight - contentH);
  const clampedScroll = Math.min(Math.max(0, scrollOffset), maxScroll);

  ctx.save();
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentW, contentH);
  ctx.clip();

  const originY = contentY - clampedScroll;
  for (const row of layout) {
    const rowY = originY + row.y;
    if (rowY + row.h < contentY || rowY > contentY + contentH) continue;
    if (row.type === 'heading') {
      drawText(ctx, `[ ${row.text} ]`, contentX, rowY + 7, {
        size: 10,
        color: COLORS.amberBright,
        font: UI_FONT,
        baseline: 'middle',
      });
      drawRect(ctx, contentX, rowY + 12, contentW, 1, COLORS.amberDim);
    } else if (row.type === 'kv') {
      drawText(ctx, `${row.key}:`, contentX, rowY + 2, {
        size: 10,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'top',
      });
      for (let i = 0; i < row.valLines.length; i += 1) {
        drawText(ctx, row.valLines[i], contentX + 40, rowY + 2 + i * 11, {
          size: 10,
          color: COLORS.cream,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    } else if (row.type === 'body') {
      for (let i = 0; i < row.lines.length; i += 1) {
        drawText(ctx, row.lines[i], contentX, rowY + i * 11, {
          size: 10,
          color: COLORS.cream,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    } else if (row.type === 'item') {
      let cursorY = rowY;
      for (let i = 0; i < row.labelLines.length; i += 1) {
        drawText(ctx, row.labelLines[i], contentX, cursorY + i * 11, {
          size: 10,
          color: COLORS.amberBright,
          font: UI_FONT,
          baseline: 'top',
        });
      }
      cursorY += row.labelLines.length * 11;
      if (row.tag && row.detailLines.length > 0) {
        drawText(ctx, `[${row.tag}]`, contentX, cursorY + 2, {
          size: 8,
          color: COLORS.pulse,
          font: UI_FONT,
          baseline: 'top',
        });
      }
      for (let i = 0; i < row.detailLines.length; i += 1) {
        drawText(ctx, row.detailLines[i], contentX + (row.tag ? 34 : 6), cursorY + 2 + i * 11, {
          size: 10,
          color: COLORS.creamDim,
          font: UI_FONT,
          baseline: 'top',
        });
      }
    }
  }

  ctx.restore();

  if (maxScroll > 0) {
    const trackX = x + w - scrollbarW - 2;
    drawRect(ctx, trackX, contentY, scrollbarW, contentH, COLORS.amberDim);
    const thumbH = Math.max(10, contentH * (contentH / totalHeight));
    const thumbY = contentY + (contentH - thumbH) * (clampedScroll / maxScroll);
    drawRect(ctx, trackX, thumbY, scrollbarW, thumbH, COLORS.amberBright);
  }

  return { clampedScroll, maxScroll };
}
