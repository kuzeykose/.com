import { drawRect } from '../draw.js';
import { COLORS } from './theme.js';

export function drawPanel(ctx, x, y, w, h, options = {}) {
  const { border = COLORS.amber, fill = COLORS.panelFill, borderWidth = 1 } = options;

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);

  drawRect(ctx, x, y, w, borderWidth, border);
  drawRect(ctx, x, y + h - borderWidth, w, borderWidth, border);
  drawRect(ctx, x, y, borderWidth, h, border);
  drawRect(ctx, x + w - borderWidth, y, borderWidth, h, border);
}
