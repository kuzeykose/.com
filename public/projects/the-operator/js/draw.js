export function clearCanvas(ctx, color = '#0b1224') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawRect(ctx, x, y, w, h, color = '#ffffff') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawSprite(ctx, img, x, y, w, h, flipX = false) {
  if (!img) {
    return;
  }

  ctx.save();
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

export function drawSpriteFrame(ctx, img, frame, x, y, w, h, flipX = false, options = {}) {
  if (!img || !frame) {
    return;
  }

  const sourceInset = options.sourceInset ?? 0;
  const sx = frame.x + sourceInset;
  const sy = frame.y + sourceInset;
  const sw = frame.w - sourceInset * 2;
  const sh = frame.h - sourceInset * 2;

  if (sw <= 0 || sh <= 0) {
    return;
  }

  const drawW = w ?? frame.w;
  const drawH = h ?? frame.h;

  ctx.save();
  if (flipX) {
    ctx.translate(x + drawW, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, x, y, drawW, drawH);
  }
  ctx.restore();
}

export function drawText(ctx, text, x, y, options = {}) {
  const {
    color = '#e5e7eb',
    size = 18,
    font = 'Trebuchet MS, Segoe UI, sans-serif',
    align = 'left',
    baseline = 'alphabetic',
  } = options;

  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

const DEFAULT_FONT = 'Trebuchet MS, Segoe UI, sans-serif';

export function wrapTextLines(ctx, text, maxWidth, size = 12, font = DEFAULT_FONT) {
  const content = String(text || '').trim();
  if (!content) {
    return [];
  }

  const paragraphs = content.split(/\n+/);
  const lines = [];
  const prevFont = ctx.font;
  ctx.font = `${size}px ${font}`;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${line} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  }

  ctx.font = prevFont;
  return lines;
}

export function drawWrappedText(ctx, text, x, y, maxWidth, options = {}) {
  const size = options.size ?? 12;
  const font = options.font ?? DEFAULT_FONT;
  const lineHeight = options.lineHeight ?? Math.round(size * 1.35);
  const maxLines = options.maxLines ?? Number.POSITIVE_INFINITY;
  const lines = wrapTextLines(ctx, text, maxWidth, size, font).slice(0, maxLines);

  for (let i = 0; i < lines.length; i += 1) {
    drawText(ctx, lines[i], x, y + i * lineHeight, {
      ...options,
      size,
      font,
    });
  }

  return lines.length;
}

export function drawScrollableText(ctx, text, x, y, w, h, scrollOffset, options = {}) {
  const size = options.size ?? 12;
  const font = options.font ?? DEFAULT_FONT;
  const lineH = options.lineHeight ?? size;
  const color = options.color ?? '#e5e7eb';
  const scrollbarW = options.scrollbarW ?? 3;
  const trackColor = options.scrollbarTrackColor ?? '#7a4b1e';
  const thumbColor = options.scrollbarThumbColor ?? '#ffb55a';

  const textW = w - scrollbarW - 4;
  const maxLines = Math.max(1, Math.floor(h / lineH));
  const allLines = wrapTextLines(ctx, text, textW, size, font);
  const maxScroll = Math.max(0, allLines.length - maxLines);
  const clamped = Math.min(Math.max(0, scrollOffset), maxScroll);
  const visible = allLines.slice(clamped, clamped + maxLines);

  for (let i = 0; i < visible.length; i++) {
    drawText(ctx, visible[i], x, y + i * lineH, { size, font, color, baseline: 'top' });
  }

  if (maxScroll > 0) {
    const trackX = x + w - scrollbarW;
    drawRect(ctx, trackX, y, scrollbarW, h, trackColor);
    const thumbH = Math.max(8, h * (maxLines / allLines.length));
    const thumbRatio = maxScroll === 0 ? 0 : clamped / maxScroll;
    const thumbY = y + (h - thumbH) * thumbRatio;
    drawRect(ctx, trackX, thumbY, scrollbarW, thumbH, thumbColor);
  }

  return { clampedScroll: clamped, maxScroll };
}
