// Drawing helpers shared by the scenes. Things are drawn in metres with
// their feet at the origin and up as negative y, then placed in the frame
// by `place`, which scales them by how far away they are.

export type Ctx = CanvasRenderingContext2D

// The frame is 100 units wide and 75 tall. A rig says how the camera sees
// it: `f` is how many units a metre spans one metre away (70 is the 1×
// main camera), `horizon` is the row at eye level, `eye` is how high the
// camera is above the ground. `zoom` crops in around the middle of the
// frame and `back` steps the camera backwards.
export type Rig = { f?: number; horizon?: number; eye?: number; zoom?: number; back?: number }

export const RIG: Required<Rig> = { f: 70, horizon: 30, eye: 1.5, zoom: 1, back: 0 }

const get = (rig: Rig) => ({ ...RIG, ...rig })

export const scaleAt = (d: number, rig: Rig = {}) => {
  const r = get(rig)
  return (r.f * r.zoom) / Math.max(0.05, d + r.back)
}
export const horizonY = (rig: Rig = {}) => {
  const r = get(rig)
  return 37.5 + (r.horizon - 37.5) * r.zoom
}
export const groundY = (d: number, rig: Rig = {}) => horizonY(rig) + get(rig).eye * scaleAt(d, rig)
// The ground distance seen at row y.
export function groundDepth(y: number, rig: Rig = {}) {
  const r = get(rig)
  return (r.eye * r.f * r.zoom) / Math.max(0.01, y - horizonY(rig)) - r.back
}

// Stand something `x` metres right of centre, `d` metres away, `lift`
// metres above the ground, and draw it in metres.
export function place(ctx: Ctx, x: number, d: number, draw: () => void, rig: Rig = {}, lift = 0) {
  if (d + get(rig).back <= 0.05) return
  const s = scaleAt(d, rig)
  ctx.save()
  ctx.translate(50 + x * s, groundY(d, rig) - lift * s)
  ctx.scale(s, s)
  draw()
  ctx.restore()
}

// Seeded randomness so a scene looks the same every time.
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function glowDot(ctx: Ctx, x: number, y: number, r: number, colour: string, halo = 3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * halo)
  g.addColorStop(0, colour)
  g.addColorStop(1 / halo, colour)
  g.addColorStop(Math.min(1, 1.6 / halo), withAlpha(colour, 0.35))
  g.addColorStop(1, withAlpha(colour, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * halo, 0, Math.PI * 2)
  ctx.fill()
}

export function withAlpha(hex: string, a: number) {
  if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (_, c) => `rgba(${c.split(',').slice(0, 3).join(',')}, ${a})`)
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export type Outfit = {
  skin: string
  hair: string
  top: string
  stripe?: string
  trousers: string
  shoes: string
  wave?: boolean
}

export const FRIEND: Outfit = {
  skin: '#c98d6b',
  hair: '#2b1d16',
  top: '#e8d9b0',
  stripe: '#2f4f7f',
  trousers: '#3b4a5a',
  shoes: '#f2f2f2',
  wave: true,
}

// A person, 1.7m tall, feet at the origin, facing the camera.
export function person(ctx: Ctx, o: Outfit = FRIEND) {
  // Legs and shoes.
  ctx.fillStyle = o.trousers
  roundRect(ctx, -0.15, -0.9, 0.14, 0.88, 0.05)
  ctx.fill()
  roundRect(ctx, 0.01, -0.9, 0.14, 0.88, 0.05)
  ctx.fill()
  ellipse(ctx, -0.09, -0.02, 0.1, 0.045, o.shoes)
  ellipse(ctx, 0.09, -0.02, 0.1, 0.045, o.shoes)

  // Arms: one at the side, one waving.
  ctx.fillStyle = o.top
  roundRect(ctx, -0.29, -1.42, 0.1, 0.56, 0.05)
  ctx.fill()
  ctx.save()
  ctx.translate(0.24, -1.38)
  ctx.rotate(o.wave ? -2.5 : 0.08)
  roundRect(ctx, -0.05, 0, 0.1, 0.5, 0.05)
  ctx.fill()
  ellipse(ctx, 0, 0.54, 0.05, 0.06, o.skin)
  ctx.restore()
  ellipse(ctx, -0.24, -0.84, 0.05, 0.06, o.skin)

  // Torso, with stripes for the eye (and the focus) to catch on.
  ctx.save()
  roundRect(ctx, -0.22, -1.45, 0.44, 0.62, 0.09)
  ctx.fillStyle = o.top
  ctx.fill()
  ctx.clip()
  if (o.stripe) {
    ctx.fillStyle = o.stripe
    for (let y = -1.4; y < -0.8; y += 0.07) ctx.fillRect(-0.3, y, 0.6, 0.025)
  }
  ctx.restore()

  // Neck and head.
  ctx.fillStyle = o.skin
  ctx.fillRect(-0.045, -1.52, 0.09, 0.1)
  ellipse(ctx, 0, -1.6, 0.095, 0.115, o.skin)
  // Hair.
  ctx.fillStyle = o.hair
  ctx.beginPath()
  ctx.ellipse(0, -1.65, 0.105, 0.085, 0, Math.PI, 0)
  ctx.lineTo(0.105, -1.56)
  ctx.quadraticCurveTo(0.08, -1.64, 0.02, -1.66)
  ctx.quadraticCurveTo(-0.06, -1.63, -0.105, -1.56)
  ctx.closePath()
  ctx.fill()
  // Face: eyes, brows, smile, cheeks.
  ellipse(ctx, -0.035, -1.6, 0.012, 0.014, '#1d1512')
  ellipse(ctx, 0.035, -1.6, 0.012, 0.014, '#1d1512')
  ellipse(ctx, -0.031, -1.604, 0.004, 0.004, '#ffffff')
  ellipse(ctx, 0.039, -1.604, 0.004, 0.004, '#ffffff')
  ctx.strokeStyle = o.hair
  ctx.lineWidth = 0.008
  ctx.beginPath()
  ctx.moveTo(-0.055, -1.63)
  ctx.lineTo(-0.018, -1.635)
  ctx.moveTo(0.018, -1.635)
  ctx.lineTo(0.055, -1.63)
  ctx.stroke()
  ctx.strokeStyle = '#7a3b2e'
  ctx.lineWidth = 0.01
  ctx.beginPath()
  ctx.arc(0, -1.57, 0.035, 0.2 * Math.PI, 0.8 * Math.PI)
  ctx.stroke()
  ellipse(ctx, -0.06, -1.565, 0.018, 0.01, 'rgba(220, 110, 100, 0.35)')
  ellipse(ctx, 0.06, -1.565, 0.018, 0.01, 'rgba(220, 110, 100, 0.35)')
}

// A rounded tree with speckled leaves.
export function tree(ctx: Ctx, seed: number, height: number, leaf: string, dark: string, light: string, trunk = '#5b4636') {
  const r = rng(seed)
  ctx.fillStyle = trunk
  ctx.beginPath()
  ctx.moveTo(-0.18, 0)
  ctx.lineTo(-0.1, -height * 0.55)
  ctx.lineTo(0.1, -height * 0.55)
  ctx.lineTo(0.18, 0)
  ctx.fill()
  const cr = height * 0.32
  const cy = -height + cr
  const blobs: [number, number, number][] = []
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2
    const d = r() * cr * 0.55
    blobs.push([Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, cr * (0.45 + r() * 0.35)])
  }
  for (const [x, y, rad] of blobs) ellipse(ctx, x, y + rad * 0.12, rad, rad, dark)
  for (const [x, y, rad] of blobs) ellipse(ctx, x - rad * 0.08, y, rad * 0.92, rad * 0.92, leaf)
  // Speckles of light and shade.
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * cr * 1.05
    const x = Math.cos(a) * d
    const y = cy + Math.sin(a) * d * 0.85
    ellipse(ctx, x, y, cr * 0.05, cr * 0.04, r() < 0.5 ? light : dark)
  }
}

export function bench(ctx: Ctx, wood = '#8a5a3b', metal = '#2e2e2e') {
  ctx.fillStyle = metal
  ctx.fillRect(-0.75, -0.45, 0.05, 0.45)
  ctx.fillRect(0.7, -0.45, 0.05, 0.45)
  ctx.fillRect(-0.75, -0.85, 0.04, 0.42)
  ctx.fillRect(0.71, -0.85, 0.04, 0.42)
  ctx.fillStyle = wood
  for (let i = 0; i < 3; i++) ctx.fillRect(-0.8, -0.85 + i * 0.1, 1.6, 0.07)
  ctx.fillRect(-0.8, -0.47, 1.6, 0.06)
}

export function lampPost(ctx: Ctx, metal = '#2b2f33', glass = '#f3e7c4') {
  ctx.fillStyle = metal
  ctx.fillRect(-0.05, -3.6, 0.1, 3.6)
  ctx.fillRect(-0.12, -0.25, 0.24, 0.25)
  roundRect(ctx, -0.17, -4.0, 0.34, 0.12, 0.03)
  ctx.fill()
  ctx.fillStyle = glass
  ctx.beginPath()
  ctx.moveTo(-0.15, -3.88)
  ctx.lineTo(0.15, -3.88)
  ctx.lineTo(0.1, -3.6)
  ctx.lineTo(-0.1, -3.6)
  ctx.closePath()
  ctx.fill()
}

// A bicycle and rider, travelling to the right.
export function cyclist(ctx: Ctx) {
  const wheel = (x: number) => {
    ctx.strokeStyle = '#1b1b1b'
    ctx.lineWidth = 0.05
    ctx.beginPath()
    ctx.arc(x, -0.34, 0.32, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 0.012
    ctx.strokeStyle = '#9aa0a6'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(x, -0.34)
      ctx.lineTo(x + Math.cos(a) * 0.3, -0.34 + Math.sin(a) * 0.3)
      ctx.stroke()
    }
  }
  wheel(-0.52)
  wheel(0.52)
  ctx.strokeStyle = '#d43f2f'
  ctx.lineWidth = 0.045
  ctx.beginPath()
  ctx.moveTo(-0.52, -0.34)
  ctx.lineTo(-0.1, -0.34)
  ctx.lineTo(0.38, -0.78)
  ctx.lineTo(-0.2, -0.8)
  ctx.closePath()
  ctx.moveTo(0.38, -0.78)
  ctx.lineTo(0.52, -0.34)
  ctx.moveTo(-0.2, -0.8)
  ctx.lineTo(-0.24, -0.9)
  ctx.moveTo(0.38, -0.78)
  ctx.lineTo(0.36, -0.98)
  ctx.stroke()
  // Rider.
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#263238'
  ctx.lineWidth = 0.11
  ctx.beginPath()
  ctx.moveTo(-0.22, -0.95)
  ctx.lineTo(0.05, -0.62)
  ctx.lineTo(-0.08, -0.36)
  ctx.stroke()
  ctx.strokeStyle = '#f4b400'
  ctx.lineWidth = 0.2
  ctx.beginPath()
  ctx.moveTo(-0.2, -0.98)
  ctx.lineTo(0.12, -1.42)
  ctx.stroke()
  ctx.lineWidth = 0.07
  ctx.beginPath()
  ctx.moveTo(0.1, -1.36)
  ctx.lineTo(0.36, -1.0)
  ctx.stroke()
  ctx.lineCap = 'butt'
  ellipse(ctx, 0.2, -1.58, 0.1, 0.11, '#b07a5a')
  ctx.fillStyle = '#1e88e5'
  ctx.beginPath()
  ctx.ellipse(0.2, -1.63, 0.13, 0.08, 0, Math.PI, 0)
  ctx.fill()
}

// A car facing right; lights are drawn by `carLights`.
export function car(ctx: Ctx, body = '#b3261e') {
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-2.1, -0.35)
  ctx.lineTo(-2.1, -0.85)
  ctx.quadraticCurveTo(-2.05, -0.95, -1.7, -0.98)
  ctx.lineTo(-1.1, -1.0)
  ctx.lineTo(-0.7, -1.42)
  ctx.lineTo(0.75, -1.42)
  ctx.lineTo(1.25, -1.0)
  ctx.lineTo(1.95, -0.92)
  ctx.quadraticCurveTo(2.12, -0.85, 2.12, -0.6)
  ctx.lineTo(2.12, -0.35)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1c2733'
  ctx.beginPath()
  ctx.moveTo(-0.95, -1.02)
  ctx.lineTo(-0.62, -1.34)
  ctx.lineTo(0.02, -1.34)
  ctx.lineTo(0.02, -1.02)
  ctx.closePath()
  ctx.moveTo(0.1, -1.02)
  ctx.lineTo(0.1, -1.34)
  ctx.lineTo(0.7, -1.34)
  ctx.lineTo(1.05, -1.02)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(-2.1, -0.55, 4.22, 0.05)
  for (const x of [-1.35, 1.3]) {
    ellipse(ctx, x, -0.33, 0.33, 0.33, '#151515')
    ellipse(ctx, x, -0.33, 0.17, 0.17, '#9e9e9e')
  }
}

export function carLights(ctx: Ctx) {
  glowDot(ctx, 2.05, -0.78, 0.08, '#fff6dc', 1.4)
  glowDot(ctx, -2.06, -0.8, 0.07, '#ff3020', 1.4)
}

// A building front with a grid of windows. Paint it once as the wall
// (`glow` false) and once as light (`glow` true): the same seed picks the
// same windows to be lit both times.
export function building(
  ctx: Ctx,
  w: number,
  h: number,
  colours: { wall: string; pane: string; lit: string },
  seed: number,
  cols: number,
  rows: number,
  share: number,
  glow = false
) {
  const r = rng(seed)
  if (!glow) {
    ctx.fillStyle = colours.wall
    ctx.fillRect(-w / 2, -h, w, h)
  }
  const ww = (w / cols) * 0.55
  const wh = (h / rows) * 0.5
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) {
      const x = -w / 2 + (c + 0.5) * (w / cols) - ww / 2
      const y = -h + (k + 0.4) * (h / rows)
      const on = r() < share
      if (glow && !on) continue
      ctx.fillStyle = glow ? colours.lit : colours.pane
      ctx.fillRect(x, y, ww, wh)
    }
  }
}
