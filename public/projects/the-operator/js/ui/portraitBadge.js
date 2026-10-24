import { getImage } from '../assets.js';
import { drawRect, drawText } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { getCctvOffset, getCctvTint, getCctvScanlineAlpha } from './cctvEffect.js';

export function drawPortraitBadge(ctx, x, y, w, h, imageKey, label, effect) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  const labelH = 12;
  const portraitX = x + 3;
  const portraitY = y + 3;
  const portraitW = w - 6;
  const portraitH = h - labelH - 4;

  const hasEffect = effect && effect.intensity > 0 && effect.style && effect.style !== 'NEUTRAL';
  const offset = hasEffect
    ? getCctvOffset(effect.style, effect.intensity, effect.time || 0)
    : { dx: 0, dy: 0 };

  const img = getImage(imageKey);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(portraitX, portraitY, portraitW, portraitH);
    ctx.clip();
    const scale = Math.max(portraitW / img.width, portraitH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = portraitX + (portraitW - drawW) / 2 + offset.dx;
    const offsetY = portraitY + (portraitH - drawH) / 2 + offset.dy;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    if (hasEffect) {
      const tint = getCctvTint(effect.style, effect.intensity, effect.time || 0);
      if (tint) {
        ctx.fillStyle = `rgba(${tint.color}, ${tint.alpha.toFixed(3)})`;
        ctx.fillRect(portraitX, portraitY, portraitW, portraitH);
      }

      const scanAlpha = getCctvScanlineAlpha(effect.style, effect.intensity, effect.time || 0);
      if (scanAlpha > 0.01) {
        ctx.fillStyle = `rgba(0, 0, 0, ${scanAlpha.toFixed(3)})`;
        for (let sy = portraitY; sy < portraitY + portraitH; sy += 2) {
          ctx.fillRect(portraitX, sy, portraitW, 1);
        }
      }
    }

    ctx.restore();
  } else {
    drawRect(ctx, portraitX, portraitY, portraitW, portraitH, COLORS.panelSolid);
  }

  drawRect(ctx, x + 1, y + h - labelH - 1, w - 2, 1, COLORS.amberDim);

  const maxLabelW = w - 6;
  let labelText = label;
  let labelSize = 12;
  ctx.font = `${labelSize}px ${UI_FONT}`;
  while (ctx.measureText(labelText).width > maxLabelW && labelSize > 7) {
    labelSize -= 1;
    ctx.font = `${labelSize}px ${UI_FONT}`;
  }
  if (ctx.measureText(labelText).width > maxLabelW) {
    const firstWord = labelText.split(/\s+/)[0];
    if (firstWord && firstWord !== labelText) {
      labelText = firstWord;
      labelSize = 12;
      ctx.font = `${labelSize}px ${UI_FONT}`;
      while (ctx.measureText(labelText).width > maxLabelW && labelSize > 7) {
        labelSize -= 1;
        ctx.font = `${labelSize}px ${UI_FONT}`;
      }
    }
  }

  drawText(ctx, labelText, x + w / 2, y + h - labelH / 2, {
    size: labelSize,
    color: COLORS.cream,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });
}
