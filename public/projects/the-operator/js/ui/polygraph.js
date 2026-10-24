import { drawRect, drawText } from '../draw.js';
import { clamp } from '../math.js';
import { COLORS, UI_FONT } from './theme.js';
import { t } from '../i18n/index.js';

const SWEEP_RATE = 28;

const SEVERITY = {
  heart: { MAX_SPIKE: 3, SPIKE: 2, MAX: 3, ERRATIC: 2, INCREASE: 1, RISE: 1 },
  breathing: {
    HOLDING_BREATH: 3,
    HYPERVENTILATION: 3,
    CRYING: 3,
    UNEVEN: 2,
    SHALLOW: 2,
    DEEP: 1,
  },
  gsr: { MAX: 3, SURGE: 3, SPIKE: 2, INCREASE: 1 },
};

function severityAlpha(score, active, fade) {
  const f = clamp(fade, 0, 1);
  if (score >= 3) return (active ? 0.36 : 0.3) * (0.35 + 0.65 * f);
  if (score === 2) return (active ? 0.31 : 0.25) * (0.35 + 0.65 * f);
  if (score === 1) return (active ? 0.24 : 0.19) * (0.35 + 0.65 * f);
  return 0;
}

function categoryForLane(marker, type) {
  if (type === 'heart') return marker.hrCategory;
  if (type === 'breathing') return marker.breathingCategory;
  return marker.gsrCategory;
}

function normalizeCategory(value) {
  if (value == null) return '';
  return String(value).trim().toUpperCase();
}

function drawBandSegment(ctx, waveX, y, h, sharedCursor, waveW, ageStart, ageEnd, alpha) {
  if (ageStart <= ageEnd) return;
  const lenSamples = ageStart - ageEnd;
  const colStart = (((sharedCursor - ageStart) % waveW) + waveW) % waveW;
  ctx.save();
  ctx.globalAlpha = alpha;
  const color = '#ffd26a';
  const room = waveW - colStart;
  if (lenSamples <= room) {
    drawRect(ctx, waveX + colStart, y + 2, lenSamples, h - 4, color);
  } else {
    drawRect(ctx, waveX + colStart, y + 2, room, h - 4, color);
    drawRect(ctx, waveX, y + 2, lenSamples - room, h - 4, color);
  }
  ctx.restore();
}

function drawLaneMarkers(ctx, waveX, y, waveW, h, type, time, sharedCursor, markers) {
  if (!markers || markers.length === 0) return;
  const minBandPx = 6;

  for (const m of markers) {
    if (m.startTime == null) continue;
    const endTime = m.endTime != null ? m.endTime : time;
    const ageStart = Math.floor((time - m.startTime) * SWEEP_RATE);
    const ageEnd = Math.floor((time - endTime) * SWEEP_RATE);
    if (ageStart <= 0) continue;
    const visibleStart = Math.min(ageStart, waveW);
    const visibleEnd = Math.max(ageEnd, 0);
    if (visibleStart <= visibleEnd) continue;

    const cat = normalizeCategory(categoryForLane(m, type));
    let sev = SEVERITY[type][cat] || 0;
    if (type === 'breathing' && sev === 0 && cat) {
      sev = 1;
    }
    if (sev <= 0) continue;

    const isActive = m.endTime == null;
    const fade = isActive ? 1 : clamp(1 - ageStart / (waveW * 2.2), 0, 1);
    const alpha = severityAlpha(sev, isActive, fade);
    if (alpha <= 0) continue;

    let bandStart = visibleStart;
    let bandEnd = visibleEnd;
    if (bandStart - bandEnd < minBandPx) {
      bandEnd = Math.max(0, bandStart - minBandPx);
    }

    drawBandSegment(ctx, waveX, y, h, sharedCursor, waveW, bandStart, bandEnd, alpha);

    const headCol = (((sharedCursor - bandStart) % waveW) + waveW) % waveW;
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, alpha + 0.22);
    drawRect(ctx, waveX + headCol, y + 2, 1, h - 4, '#ffd26a');
    ctx.restore();
  }
}

const TRACE_STATE = {
  heart: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
  breathing: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
  gsr: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
};

function drawLaneGrid(ctx, x, y, w, h) {
  drawRect(ctx, x, y, w, h, 'rgba(10, 6, 3, 0.55)');
  for (let gy = y + 4; gy < y + h; gy += 6) {
    drawRect(ctx, x, gy, w, 1, 'rgba(90, 60, 30, 0.08)');
  }
  for (let gx = x + 16; gx < x + w; gx += 16) {
    drawRect(ctx, gx, y, 1, h, 'rgba(90, 60, 30, 0.08)');
  }
}

function sampleByOffset(buffer, offset) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(offset, buffer.count - 1));
  const idx = (buffer.head - 1 - clamped + buffer.size * 4) % buffer.size;
  return buffer.data[idx];
}

function resetTraceLane(lane, width, fill) {
  lane.samples = new Float32Array(width);
  lane.samples.fill(fill);
  lane.width = width;
  lane.lastCursor = -1;
}

function getLatestSample(buffer, sampleAt) {
  if (typeof sampleAt === 'function') {
    return sampleAt(0);
  }
  return sampleByOffset(buffer, 0);
}

function updateTraceLane(lane, buffer, width, sharedCursor, sampleAt) {
  if (!buffer || buffer.count <= 0 || width <= 2) {
    return;
  }

  const latest = getLatestSample(buffer, sampleAt);
  const resetNeeded = !lane.samples || lane.width !== width || lane.bufferRef !== buffer;
  if (resetNeeded) {
    resetTraceLane(lane, width, latest);
    lane.bufferRef = buffer;
  }

  if (lane.lastCursor === sharedCursor) {
    return;
  }

  if (lane.lastCursor < 0) {
    lane.samples[sharedCursor] = latest;
    lane.lastCursor = sharedCursor;
    return;
  }

  let steps = (sharedCursor - lane.lastCursor + width) % width;
  if (steps <= 0) {
    steps = 1;
  }

  for (let i = 1; i <= steps; i += 1) {
    const idx = (lane.lastCursor + i) % width;
    lane.samples[idx] = latest;
  }

  lane.lastCursor = sharedCursor;
}

function drawLaneWave(ctx, x, y, w, h, color, buffer, sampleRate, type, sampleAt, sharedCursor) {
  if (!buffer || buffer.count <= 1) {
    return;
  }

  const midY = y + h / 2;
  const gain = type === 'heart' ? h * 0.4 : type === 'breathing' ? h * 0.48 : h * 0.72;
  const lane = TRACE_STATE[type];
  updateTraceLane(lane, buffer, w, sharedCursor, sampleAt);
  if (!lane.samples) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i < w; i += 1) {
    const sample = lane.samples[i];
    const py = clamp(midY - sample * gain, y + 1, y + h - 1);
    if (i === 0) {
      ctx.moveTo(x + i, py);
    } else {
      ctx.lineTo(x + i, py);
    }
  }
  ctx.stroke();

  ctx.restore();
}

function readout(type, profile, biometricReadout) {
  if (biometricReadout) {
    if (type === 'heart') {
      return `${Math.round(biometricReadout.bpm)} BPM`;
    }
    if (type === 'breathing') {
      return `${Math.round(biometricReadout.breathingRpm ?? 14)} RPM`;
    }
    return `${biometricReadout.gsrUs.toFixed(1)} uS`;
  }

  if (type === 'heart') {
    return `${Math.round(40 + profile.freq * 22)} BPM`;
  }
  if (type === 'breathing') {
    return `${Math.round(6 + profile.freq * 14)} RPM`;
  }
  return `${Math.round(8 + profile.amp * 42)} uS`;
}

function drawLane(
  ctx,
  x,
  y,
  w,
  h,
  {
    label,
    color,
    profile,
    type,
    time,
    flash = 0,
    buffer,
    sampleRate,
    biometricReadout,
    sampleAt,
    sharedCursor,
    drawSweep,
    markers,
  }
) {
  const labelW = 40;
  const valueW = 62;

  const waveX = x + labelW;
  const waveW = w - labelW - valueW;

  drawLaneGrid(ctx, waveX, y + 2, waveW, h - 4);
  drawLaneMarkers(ctx, waveX, y, waveW, h, type, time, sharedCursor, markers);

  if (drawSweep) {
    const sweepX = waveX + sharedCursor;
    drawRect(ctx, sweepX - 8, y + 2, 8, h - 4, 'rgba(224, 72, 72, 0.10)');
    drawRect(ctx, sweepX - 2, y + 2, 2, h - 4, 'rgba(224, 72, 72, 0.18)');
  }

  drawLaneWave(
    ctx,
    waveX,
    y + 2,
    waveW,
    h - 4,
    color,
    buffer,
    sampleRate,
    type,
    sampleAt,
    sharedCursor
  );

  if (flash > 0.001) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.4, flash * 0.4);
    drawRect(ctx, waveX, y + 2, waveW, h - 4, color);
    ctx.restore();
  }

  drawText(ctx, label, x + 4, y + h / 2, {
    size: 12,
    color,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, `${readout(type, profile, biometricReadout)}`, waveX + waveW + 6, y + h / 2, {
    size: 11,
    color: COLORS.cream,
    align: 'left',
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawFearColumn(ctx, x, y, w, h, fearBar, maxFearBar, fearFlash) {
  const labelY = y + 10;
  const valueY = y + h - 8;
  const barTop = labelY + 10;
  const barBottom = valueY - 10;
  const barH = Math.max(0, barBottom - barTop);
  const barW = 8;
  const barX = x + Math.floor((w - barW) / 2);

  drawText(ctx, t('POLY_FEAR'), x + w / 2, labelY, {
    size: 11,
    color: COLORS.cream,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, barX, barTop, barW, barH, COLORS.fearTrack);

  const ratio = clamp(fearBar / maxFearBar, 0, 1);
  const fillH = Math.round(barH * ratio);
  if (fillH > 0) {
    drawRect(ctx, barX, barBottom - fillH, barW, fillH, COLORS.fear);
  }

  if (fearFlash > 0.001) {
    drawRect(
      ctx,
      barX,
      barTop,
      barW,
      barH,
      `rgba(255, 220, 150, ${Math.min(0.75, fearFlash * 0.75)})`
    );
  }

  for (let i = 1; i < 4; i += 1) {
    const ty = barTop + Math.round((barH * i) / 4);
    drawRect(ctx, barX - 2, ty, 2, 1, COLORS.amberDim);
    drawRect(ctx, barX + barW, ty, 2, 1, COLORS.amberDim);
  }

  drawText(ctx, `${Math.round(fearBar)}`, x + w / 2, valueY - 6, {
    size: 11,
    color: COLORS.cream,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });
  drawText(ctx, `/${maxFearBar}`, x + w / 2, valueY + 4, {
    size: 9,
    color: COLORS.amberDim,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });
}

export function drawPolygraph(ctx, x, y, w, h, data) {
  const {
    waves,
    time,
    fearBar,
    maxFearBar,
    fearFlash = 0,
    laneFlash = {},
    biometric,
    markers = [],
    activeMarker = null,
  } = data;

  const allMarkers = activeMarker ? [...markers, activeMarker] : markers;

  const bioBuffers = biometric?.buffers || {};
  const bioRate = biometric?.sampleRate || {};
  const bioReadout = biometric?.readout || null;
  const bioSampleAt = biometric?.sampleAt || null;

  drawRect(ctx, x, y, w, h, COLORS.panelSolid);
  drawRect(ctx, x, y, w, 1, COLORS.amber);

  const headerH = 16;

  drawText(ctx, t('POLY_HEADER'), x + 6, y + headerH / 2 + 1, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, x, y + headerH, w, 1, COLORS.amberDim);

  const fearColW = 52;
  const lanesX = x;
  const lanesW = w - fearColW;
  const fearColX = x + lanesW;

  drawRect(ctx, fearColX, y + headerH, 1, h - headerH, COLORS.amberDim);

  const lanesY = y + headerH + 2;
  const lanesH = h - headerH - 4;
  const laneH = Math.floor(lanesH / 3);
  const labelW = 40;
  const valueW = 62;
  const waveW = lanesW - labelW - valueW;
  const sharedCursor = Math.floor((time * 28) % Math.max(1, waveW));

  drawLane(ctx, lanesX, lanesY, lanesW, laneH, {
    label: t('POLY_PULSE'),
    color: COLORS.pulse,
    profile: waves.heartRate,
    type: 'heart',
    time,
    flash: laneFlash.heartRate || 0,
    buffer: bioBuffers.heartRate,
    sampleRate: bioRate.heartRate || 250,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('heartRate', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
    markers: allMarkers,
  });

  drawLane(ctx, lanesX, lanesY + laneH, lanesW, laneH, {
    label: t('POLY_BREATHING'),
    color: COLORS.breathing,
    profile: waves.breathing,
    type: 'breathing',
    time,
    flash: laneFlash.breathing || 0,
    buffer: bioBuffers.breathing,
    sampleRate: bioRate.breathing || 32,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('breathing', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
    markers: allMarkers,
  });

  drawLane(ctx, lanesX, lanesY + laneH * 2, lanesW, laneH, {
    label: t('POLY_GSR'),
    color: COLORS.gsr,
    profile: waves.gsr,
    type: 'gsr',
    time,
    flash: laneFlash.gsr || 0,
    buffer: bioBuffers.gsr,
    sampleRate: bioRate.gsr || 64,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('gsr', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
    markers: allMarkers,
  });

  drawFearColumn(ctx, fearColX, y + headerH, fearColW, h - headerH, fearBar, maxFearBar, fearFlash);
}
