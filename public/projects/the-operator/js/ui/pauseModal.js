import { drawText, drawRect } from '../draw.js';
import { drawSceneBackground } from './background.js';
import { COLORS, UI_FONT, DESIGN_W, DESIGN_H } from './theme.js';
import { drawPanel } from './panel.js';
import { t, getLanguage, setLanguage } from '../i18n/index.js';
import { isScrollInverted, toggleScrollInverted } from '../input.js';
import { getAmbientVolume, setAmbientVolume } from '../interrogationAudio.js';
import { getCrtStrength, setCrtStrength } from '../videoSettings.js';

const LANGS = ['en', 'tr'];

const MODAL_W = 200;
const MODAL_H = 140;
const MODAL_X = (DESIGN_W - MODAL_W) / 2;
const MODAL_Y = (DESIGN_H - MODAL_H) / 2;

const BTN_W = 160;
const BTN_H = 24;
const BTN_X = MODAL_X + (MODAL_W - BTN_W) / 2;
const BTN_GAP = 6;
const BTN_START_Y = MODAL_Y + 44;

const BUTTONS = [
  { key: 'continue', labelKey: 'PAUSE_CONTINUE' },
  { key: 'settings', labelKey: 'PAUSE_SETTINGS' },
  { key: 'quit', labelKey: 'PAUSE_QUIT' },
];

function pointInRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function drawPauseModal(ctx, { mouse, selectedIndex = 0 }) {
  // Dimmed backdrop
  ctx.save();
  ctx.fillStyle = 'rgba(14, 9, 6, 0.78)';
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();

  drawPanel(ctx, MODAL_X, MODAL_Y, MODAL_W, MODAL_H, { border: COLORS.amber });

  drawText(ctx, t('PAUSE_TITLE'), MODAL_X + MODAL_W / 2, MODAL_Y + 16, {
    size: 13,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawRect(ctx, MODAL_X + 8, MODAL_Y + 26, MODAL_W - 16, 1, COLORS.amberDim);

  const rects = [];
  let keyboardIndex = 0;

  for (let i = 0; i < BUTTONS.length; i += 1) {
    const btn = BUTTONS[i];
    const btnY = BTN_START_Y + i * (BTN_H + BTN_GAP);
    const rect = { x: BTN_X, y: btnY, w: BTN_W, h: BTN_H, key: btn.key };
    if (!btn.disabled) {
      rects.push(rect);
    }

    const mouseHovered = !btn.disabled && pointInRect(mouse, rect);
    const keyFocused = !btn.disabled && keyboardIndex === selectedIndex;
    const active = mouseHovered || keyFocused;
    if (!btn.disabled) {
      keyboardIndex += 1;
    }

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      border: btn.disabled ? COLORS.amberDim : active ? COLORS.amberBright : COLORS.amber,
      fill: active ? 'rgba(70, 42, 16, 0.75)' : COLORS.panelFillLight,
    });

    drawText(ctx, t(btn.labelKey), rect.x + rect.w / 2, rect.y + rect.h / 2, {
      size: 11,
      color: btn.disabled ? COLORS.amberDim : active ? COLORS.amberBright : COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
      align: 'center',
    });
  }

  return { rects };
}

const S_MODAL_W = 220;
const S_MODAL_H = 214;
const S_MODAL_X = (DESIGN_W - S_MODAL_W) / 2;
const S_MODAL_Y = (DESIGN_H - S_MODAL_H) / 2;

function cycleLanguage(dir) {
  const idx = LANGS.indexOf(getLanguage());
  setLanguage(LANGS[(idx + dir + LANGS.length) % LANGS.length]);
}

export function drawSettingsModal(ctx, { mouse, standalone = false }) {
  if (standalone) {
    drawSceneBackground(ctx);
  }
  ctx.save();
  ctx.fillStyle = standalone ? 'rgba(14, 9, 6, 0.68)' : 'rgba(14, 9, 6, 0.78)';
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();

  drawPanel(ctx, S_MODAL_X, S_MODAL_Y, S_MODAL_W, S_MODAL_H, { border: COLORS.amber });

  drawText(ctx, t('SETTINGS_TITLE'), S_MODAL_X + S_MODAL_W / 2, S_MODAL_Y + 16, {
    size: 13,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawRect(ctx, S_MODAL_X + 8, S_MODAL_Y + 26, S_MODAL_W - 16, 1, COLORS.amberDim);

  // Language row
  const rowY = S_MODAL_Y + 55;
  drawText(ctx, t('SETTINGS_LANGUAGE_LABEL'), S_MODAL_X + 18, rowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const arrowW = 20;
  const arrowH = 20;
  const labelW = 80;
  const rowRight = S_MODAL_X + S_MODAL_W - 14;
  const labelCX = rowRight - labelW / 2 - arrowW - 4;
  const leftArrowX = labelCX - labelW / 2 - arrowW - 4;
  const rightArrowX = labelCX + labelW / 2 + 4;

  const leftRect = { x: leftArrowX, y: rowY - arrowH / 2, w: arrowW, h: arrowH };
  const rightRect = { x: rightArrowX, y: rowY - arrowH / 2, w: arrowW, h: arrowH };

  const leftHover = pointInRect(mouse, leftRect);
  const rightHover = pointInRect(mouse, rightRect);

  drawPanel(ctx, leftRect.x, leftRect.y, arrowW, arrowH, {
    border: leftHover ? COLORS.amberBright : COLORS.amberDim,
    fill: leftHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });
  drawText(ctx, '<', leftRect.x + arrowW / 2, rowY, {
    size: 12,
    color: leftHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawPanel(ctx, rightRect.x, rightRect.y, arrowW, arrowH, {
    border: rightHover ? COLORS.amberBright : COLORS.amberDim,
    fill: rightHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });
  drawText(ctx, '>', rightRect.x + arrowW / 2, rowY, {
    size: 12,
    color: rightHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const langLabel = getLanguage() === 'en' ? t('SETTINGS_LANGUAGE_EN') : t('SETTINGS_LANGUAGE_TR');
  drawText(ctx, langLabel, labelCX, rowY, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const scrollRowY = rowY + 30;
  drawText(ctx, t('SETTINGS_SCROLL_LABEL'), S_MODAL_X + 18, scrollRowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const scrollRect = {
    x: rowRight - 76,
    y: scrollRowY - 10,
    w: 76,
    h: 20,
  };
  const scrollHover = pointInRect(mouse, scrollRect);
  drawPanel(ctx, scrollRect.x, scrollRect.y, scrollRect.w, scrollRect.h, {
    border: scrollHover ? COLORS.amberBright : COLORS.amberDim,
    fill: scrollHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });

  const scrollLabel = isScrollInverted() ? t('SETTINGS_SCROLL_ON') : t('SETTINGS_SCROLL_OFF');
  drawText(ctx, scrollLabel, scrollRect.x + scrollRect.w / 2, scrollRowY, {
    size: 11,
    color: scrollHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const volumeRowY = scrollRowY + 30;
  drawText(ctx, t('SETTINGS_SOUND_LABEL'), S_MODAL_X + 18, volumeRowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const trackW = 96;
  const trackH = 6;
  const trackX = rowRight - trackW - 14;
  const trackY = volumeRowY - trackH / 2;
  const volumeTrackRect = { x: trackX, y: trackY, w: trackW, h: trackH };
  const volumeHitRect = { x: trackX, y: trackY - 8, w: trackW, h: trackH + 16 };

  const vol = getAmbientVolume();
  const ratio = vol / 100;
  drawRect(ctx, trackX, trackY, trackW, trackH, COLORS.amberDim);
  drawRect(
    ctx,
    trackX,
    trackY,
    Math.max(1, Math.round(trackW * ratio)),
    trackH,
    COLORS.amberBright
  );

  const knobSize = 9;
  const knobX = trackX + ratio * trackW - knobSize / 2;
  const knobY = volumeRowY - knobSize / 2;
  const volumeKnobRect = { x: knobX, y: knobY, w: knobSize, h: knobSize };
  const volumeHover = pointInRect(mouse, volumeKnobRect);
  drawPanel(ctx, knobX, knobY, knobSize, knobSize, {
    border: volumeHover ? COLORS.amberBright : COLORS.amber,
    fill: volumeHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });

  drawText(ctx, `${vol}%`, rowRight, volumeRowY, {
    size: 10,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const crtRowY = volumeRowY + 30;
  drawText(ctx, t('SETTINGS_CRT_LABEL'), S_MODAL_X + 18, crtRowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const crtTrackW = 96;
  const crtTrackH = 6;
  const crtTrackX = rowRight - crtTrackW - 14;
  const crtTrackY = crtRowY - crtTrackH / 2;
  const crtTrackRect = { x: crtTrackX, y: crtTrackY, w: crtTrackW, h: crtTrackH };
  const crtHitRect = { x: crtTrackX, y: crtTrackY - 8, w: crtTrackW, h: crtTrackH + 16 };

  const crt = getCrtStrength();
  const crtRatio = crt / 100;
  drawRect(ctx, crtTrackX, crtTrackY, crtTrackW, crtTrackH, COLORS.amberDim);
  drawRect(
    ctx,
    crtTrackX,
    crtTrackY,
    Math.max(1, Math.round(crtTrackW * crtRatio)),
    crtTrackH,
    COLORS.amberBright
  );

  const crtKnobSize = 9;
  const crtKnobX = crtTrackX + crtRatio * crtTrackW - crtKnobSize / 2;
  const crtKnobY = crtRowY - crtKnobSize / 2;
  const crtKnobRect = { x: crtKnobX, y: crtKnobY, w: crtKnobSize, h: crtKnobSize };
  const crtHover = pointInRect(mouse, crtKnobRect);
  drawPanel(ctx, crtKnobX, crtKnobY, crtKnobSize, crtKnobSize, {
    border: crtHover ? COLORS.amberBright : COLORS.amber,
    fill: crtHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });

  drawText(ctx, `${crt}%`, rowRight, crtRowY, {
    size: 10,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawText(ctx, t('SETTINGS_BACK'), S_MODAL_X + S_MODAL_W / 2, S_MODAL_Y + S_MODAL_H - 14, {
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  return {
    volumeTrackRect,
    volumeHitRect,
    crtHitRect,
    cycleLanguage,
    adjustVolume(dir) {
      setAmbientVolume(getAmbientVolume() + dir * 4);
    },
    adjustCrt(dir) {
      setCrtStrength(getCrtStrength() + dir * 4);
    },
    hitTest(mouse) {
      if (pointInRect(mouse, leftRect)) cycleLanguage(-1);
      else if (pointInRect(mouse, rightRect)) cycleLanguage(1);
      else if (pointInRect(mouse, scrollRect)) toggleScrollInverted();
      else if (
        pointInRect(mouse, {
          x: volumeTrackRect.x,
          y: volumeTrackRect.y - 6,
          w: volumeTrackRect.w,
          h: volumeTrackRect.h + 12,
        })
      ) {
        const ratio = (mouse.x - volumeTrackRect.x) / volumeTrackRect.w;
        setAmbientVolume(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
      } else if (
        pointInRect(mouse, {
          x: crtTrackRect.x,
          y: crtTrackRect.y - 6,
          w: crtTrackRect.w,
          h: crtTrackRect.h + 12,
        })
      ) {
        const ratio = (mouse.x - crtTrackRect.x) / crtTrackRect.w;
        setCrtStrength(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
      }
    },
  };
}
