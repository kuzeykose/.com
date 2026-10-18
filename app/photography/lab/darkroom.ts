// A small camera simulator. A scene is a stack of flat cut-outs, each at a
// distance from the camera. The darkroom lights them, blurs each one by
// how far it is from the focus and how far it moves while the shutter is
// open, stacks them up, and then develops the result the way a sensor
// would: exposure, white balance, noise, clipping, and a style on top.
//
// Everything runs on the CPU in plain typed arrays, so it behaves the same
// in every browser, phones included.

import { MAIN_LENS, blurCircle, ev100, lightColour, portraitBlur, type Lens } from './optics'
import { applyGrade, type Grade } from './grade'

export type Paint = (ctx: CanvasRenderingContext2D) => void

export type Layer = {
  id: string
  // Bump this when the drawing changes (someone stepped closer, a light
  // came on), so the darkroom redraws it.
  version?: string
  label?: string
  // Metres from the camera.
  depth: number
  // The ground isn't at one distance; it says how far away a given row is.
  depthAt?: (y: number) => number
  // Drawn in a 100 × 75 frame, in the colours things have in white light.
  paint: Paint
  // Lamps, windows, neon: drawn on their own and added as light.
  glow?: Paint
  // How bright the glow is next to a white wall in the scene's light.
  glowPower?: number
  // Frame widths per second, sideways and down.
  motion?: [number, number]
  // The light that falls on this layer, if it isn't the scene's.
  kelvin?: number
  light?: number
}

export type Scene = {
  id: string
  // The exposure value (at ISO 100) that renders the scene as it should look.
  ev: number
  // What a simple average meter would ask for instead (snow fools it).
  meterEv?: number
  // Colour temperature of the main light.
  kelvin: number
  // 1 for the main camera; 2 for its 2× crop. (The scene draws itself
  // cropped; this is for the blur, which grows with it.)
  crop?: number
  lens?: Lens
  layers: Layer[]
}

export type Shot = {
  aperture: number
  shutter: number
  iso: number
  focus: number
  // 'lens' blurs like the real lens; 'portrait' paints in Portrait mode's
  // blur, as strong as the simulated ƒ-number in `portrait`.
  blur?: 'lens' | 'portrait'
  portrait?: number
  // White balance the camera assumes, in kelvin.
  wb: number
  tint?: number
  flash?: boolean
  // 1 handheld, 0 on a tripod; `shakeTime` is how long each frame is open.
  shake?: number
  shakeTime?: number
  // Frames merged into one (Night mode); noise drops with their number.
  frames?: number
  // Extra brightness applied after capture, in stops.
  gain?: number
  noise?: boolean
  grade?: Grade | null
}

export type Develop = {
  image: ImageData
  histogram: Uint32Array
  clipped: number
  crushed: number
}

const FRAME = 100

type Raster = { key: string; x: number; y: number; w: number; h: number; albedo: Uint8ClampedArray; glow?: Uint8ClampedArray }
type Buffer = { x: number; y: number; w: number; h: number; data: Float32Array }

// sRGB byte → linear light, and back through a lookup table.
const LINEAR = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const LUT_SIZE = 8192
const ENCODE = new Uint8ClampedArray(LUT_SIZE)
for (let i = 0; i < LUT_SIZE; i++) {
  const c = i / (LUT_SIZE - 1)
  ENCODE[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
}
export const encode = (v: number) => ENCODE[v <= 0 ? 0 : v >= 1 ? LUT_SIZE - 1 : (v * (LUT_SIZE - 1)) | 0]

// One shared table of Gaussian noise; every darkroom reads it the same way,
// so the grain stays put while you drag a slider.
let GRAIN: Float32Array | null = null
function grain() {
  if (GRAIN) return GRAIN
  const n = 1 << 20
  GRAIN = new Float32Array(n)
  let seed = 1234567
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed + 1) / 4294967297
  }
  for (let i = 0; i < n; i += 2) {
    const r = Math.sqrt(-2 * Math.log(rand()))
    const t = 2 * Math.PI * rand()
    GRAIN[i] = r * Math.cos(t)
    GRAIN[i + 1] = r * Math.sin(t)
  }
  return GRAIN
}

// Each blur is snapped to one of these, so a dragged slider reuses work.
const SIGMAS = [0, 0.5, 0.7, 1, 1.4, 1.8, 2.3, 2.8, 3.4, 4, 5, 6, 7, 8.5, 10, 12, 14, 17, 20, 24, 28, 33, 40]
function snapSigma(s: number) {
  if (s < 0.3) return 0
  let best = SIGMAS[1]
  for (const x of SIGMAS) if (Math.abs(Math.log(x / s)) < Math.abs(Math.log(best / s))) best = x
  return best
}

// A running-sum box blur along rows (or columns), window [i - left, i + right].
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, left: number, right: number, vertical: boolean) {
  const n = left + right + 1
  const inv = 1 / n
  const lines = vertical ? w : h
  const len = vertical ? h : w
  const step = vertical ? w * 4 : 4
  for (let l = 0; l < lines; l++) {
    const base = vertical ? l * 4 : l * w * 4
    const last = base + (len - 1) * step
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0
    for (let k = -left; k <= right; k++) {
      const p = k < 0 ? base : k >= len ? last : base + k * step
      s0 += src[p]; s1 += src[p + 1]; s2 += src[p + 2]; s3 += src[p + 3]
    }
    for (let i = 0; i < len; i++) {
      const o = base + i * step
      dst[o] = s0 * inv; dst[o + 1] = s1 * inv; dst[o + 2] = s2 * inv; dst[o + 3] = s3 * inv
      const ai = i + right + 1
      const ri = i - left
      const a = ai >= len ? last : base + ai * step
      const r = ri < 0 ? base : base + ri * step
      s0 += src[a] - src[r]; s1 += src[a + 1] - src[r + 1]; s2 += src[a + 2] - src[r + 2]; s3 += src[a + 3] - src[r + 3]
    }
  }
}

// A three-tap [a, 1 − 2a, a] pass, for blurs under a pixel or so.
function tapPass(src: Float32Array, dst: Float32Array, w: number, h: number, a: number, vertical: boolean) {
  const lines = vertical ? w : h
  const len = vertical ? h : w
  const step = vertical ? w * 4 : 4
  const c = 1 - 2 * a
  for (let l = 0; l < lines; l++) {
    const base = vertical ? l * 4 : l * w * 4
    for (let i = 0; i < len; i++) {
      const o = base + i * step
      const p = i > 0 ? o - step : o
      const q = i < len - 1 ? o + step : o
      for (let k = 0; k < 4; k++) dst[o + k] = a * src[p + k] + c * src[o + k] + a * src[q + k]
    }
  }
}

function gaussian(buf: Float32Array, tmp: Float32Array, w: number, h: number, sigma: number) {
  if (sigma <= 0) return
  if (sigma < 1.2) {
    const v = sigma * sigma
    const k = Math.ceil(v / 0.5)
    const a = v / (2 * k)
    for (let i = 0; i < k; i++) {
      tapPass(buf, tmp, w, h, a, false)
      tapPass(tmp, buf, w, h, a, true)
    }
    return
  }
  // Three boxes whose variances add up to the Gaussian's.
  const n = 3
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(ideal)
  if (wl % 2 === 0) wl--
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4))
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2
    boxPass(buf, tmp, w, h, r, r, false)
    boxPass(tmp, buf, w, h, r, r, true)
  }
}

// Big blurs lose nothing by being done at half size, and cost a quarter.
function gaussianFast(buf: Float32Array, tmp: Float32Array, w: number, h: number, sigma: number) {
  if (sigma < 3) return gaussian(buf, tmp, w, h, sigma)
  const hw = (w + 1) >> 1
  const hh = (h + 1) >> 1
  const half = new Float32Array(hw * hh * 4)
  for (let y = 0; y < hh; y++) {
    const y0 = y * 2, y1 = Math.min(h - 1, y0 + 1)
    for (let x = 0; x < hw; x++) {
      const x0 = x * 2, x1 = Math.min(w - 1, x0 + 1)
      const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4
      const o = (y * hw + x) * 4
      for (let k = 0; k < 4; k++) half[o + k] = (buf[a + k] + buf[b + k] + buf[c + k] + buf[d + k]) * 0.25
    }
  }
  gaussian(half, new Float32Array(half.length), hw, hh, Math.sqrt(sigma * sigma - 1) / 2)
  // Back up to full size, bilinearly.
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, (y + 0.5) / 2 - 0.5)
    const y0 = Math.min(hh - 1, Math.floor(fy)), y1 = Math.min(hh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, (x + 0.5) / 2 - 0.5)
      const x0 = Math.min(hw - 1, Math.floor(fx)), x1 = Math.min(hw - 1, x0 + 1), tx = fx - x0
      const a = (y0 * hw + x0) * 4, b = (y0 * hw + x1) * 4, c = (y1 * hw + x0) * 4, d = (y1 * hw + x1) * 4
      const o = (y * w + x) * 4
      for (let k = 0; k < 4; k++) {
        const top = half[a + k] + (half[b + k] - half[a + k]) * tx
        const bottom = half[c + k] + (half[d + k] - half[c + k]) * tx
        buf[o + k] = top + (bottom - top) * ty
      }
    }
  }
}

function smear(buf: Float32Array, tmp: Float32Array, w: number, h: number, length: number, vertical: boolean) {
  const n = Math.round(length)
  if (n < 2) return
  const left = Math.floor((n - 1) / 2)
  boxPass(buf, tmp, w, h, left, n - 1 - left, vertical)
  buf.set(tmp)
}

export class Darkroom {
  readonly w: number
  readonly h: number
  private scene: Scene | null = null
  private rasters = new Map<string, Raster>()
  private cache = new Map<string, Buffer>()
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private acc: Float32Array
  private shaken: Float32Array | null = null
  private wide: Float32Array | null = null
  private wideTmp: Float32Array | null = null

  constructor(w: number) {
    this.w = w
    this.h = Math.round((w * 3) / 4)
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.w
    this.canvas.height = this.h
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.acc = new Float32Array(this.w * this.h * 3)
  }

  setScene(scene: Scene) {
    if (this.scene && this.scene.id !== scene.id) {
      this.rasters.clear()
      this.cache.clear()
    }
    this.scene = scene
    for (const layer of scene.layers) {
      const key = `${layer.id}@${layer.version ?? ''}`
      if (this.rasters.get(layer.id)?.key !== key) this.rasters.set(layer.id, this.raster(layer, key))
    }
  }

  // Frees the working buffers; the rasters stay so coming back is quick.
  sleep() {
    this.cache.clear()
    this.shaken = this.wide = this.wideTmp = null
  }

  private paintLayer(paint: Paint) {
    const { ctx, w, h } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.scale(w / FRAME, w / FRAME)
    paint(ctx)
    ctx.restore()
    return ctx.getImageData(0, 0, w, h).data
  }

  private raster(layer: Layer, key: string): Raster {
    const { w, h } = this
    const albedo = new Uint8ClampedArray(this.paintLayer(layer.paint))
    const glow = layer.glow ? this.paintLayer(layer.glow) : undefined
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3
        if (albedo[i] > 0 || (glow && glow[i] > 0)) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x1 < 0) return { key, x: 0, y: 0, w: 0, h: 0, albedo: new Uint8ClampedArray(0) }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const crop = (src: Uint8ClampedArray) => {
      const out = new Uint8ClampedArray(bw * bh * 4)
      for (let y = 0; y < bh; y++) out.set(src.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + bw) * 4), y * bw * 4)
      return out
    }
    return { key, x: x0, y: y0, w: bw, h: bh, albedo: crop(albedo), glow: glow ? crop(glow) : undefined }
  }

  // The layer at a point in the frame (0–1 across, 0–1 down), nearest first.
  pick(fx: number, fy: number): { depth: number; label?: string } | null {
    if (!this.scene) return null
    const px = Math.floor(fx * this.w)
    const py = Math.floor(fy * this.h)
    const layers = this.scene.layers
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      const r = this.rasters.get(layer.id)
      if (!r || px < r.x || py < r.y || px >= r.x + r.w || py >= r.y + r.h) continue
      if (r.albedo[((py - r.y) * r.w + (px - r.x)) * 4 + 3] < 128) continue
      return { depth: layer.depthAt ? layer.depthAt(fy * 75) : layer.depth, label: layer.label }
    }
    return null
  }

  private lighting(layer: Layer, shot: Shot): [number, number, number] {
    const scene = this.scene!
    const [r, g, b] = lightColour(layer.kelvin ?? scene.kelvin)
    const k = layer.light ?? 1
    let out: [number, number, number] = [r * k, g * k, b * k]
    if (shot.flash) {
      // A phone's LED is about as bright at a metre as an EV 9 room.
      const f = Math.pow(2, 9 - scene.ev) / (layer.depth * layer.depth)
      const [fr, fg, fb] = lightColour(5500)
      out = [out[0] + fr * f, out[1] + fg * f, out[2] + fb * f]
    }
    return out
  }

  private sigma(layer: Layer, shot: Shot) {
    const scene = this.scene!
    const frac =
      shot.blur === 'portrait'
        ? portraitBlur(shot.portrait ?? shot.aperture, shot.focus, layer.depth)
        : blurCircle(scene.lens ?? MAIN_LENS, shot.aperture, shot.focus, layer.depth, scene.crop ?? 1)
    // A Gaussian looks about 2.4σ wide; match that to the blur circle.
    return snapSigma(Math.min(40, (frac * this.w) / 2.4))
  }

  private layerBuffer(layer: Layer, shot: Shot): Buffer | null {
    const r = this.rasters.get(layer.id)
    if (!r || r.w === 0) return null
    const light = this.lighting(layer, shot)
    const sigma = this.sigma(layer, shot)
    const [vx, vy] = layer.motion ?? [0, 0]
    const mx = Math.round(Math.abs(vx) * this.w * shot.shutter)
    const my = Math.round(Math.abs(vy) * this.w * shot.shutter)
    const key = `${layer.id}|${r.key}|${light.map((c) => c.toFixed(3)).join(',')}|${sigma}|${mx}|${my}`
    const hit = this.cache.get(key)
    if (hit) {
      this.cache.delete(key)
      this.cache.set(key, hit)
      return hit
    }

    const { w: W, h: H } = this
    const pad = Math.ceil(sigma * 3) + Math.ceil(Math.max(mx, my) / 2) + 2
    const x0 = r.x - pad, y0 = r.y - pad
    const bw = r.w + pad * 2, bh = r.h + pad * 2
    const data = new Float32Array(bw * bh * 4)
    const power = layer.glowPower ?? 6
    const [lr, lg, lb] = light
    for (let y = 0; y < bh; y++) {
      // Past the frame's edge, repeat the edge (sky shouldn't fade to black).
      const sy = Math.min(H - 1, Math.max(0, y + y0)) - r.y
      if (sy < 0 || sy >= r.h) continue
      for (let x = 0; x < bw; x++) {
        const sx = Math.min(W - 1, Math.max(0, x + x0)) - r.x
        if (sx < 0 || sx >= r.w) continue
        const s = (sy * r.w + sx) * 4
        const o = (y * bw + x) * 4
        const a = r.albedo[s + 3] / 255
        let cr = LINEAR[r.albedo[s]] * a * lr
        let cg = LINEAR[r.albedo[s + 1]] * a * lg
        let cb = LINEAR[r.albedo[s + 2]] * a * lb
        if (r.glow) {
          const ga = (r.glow[s + 3] / 255) * power
          cr += LINEAR[r.glow[s]] * ga
          cg += LINEAR[r.glow[s + 1]] * ga
          cb += LINEAR[r.glow[s + 2]] * ga
        }
        data[o] = cr; data[o + 1] = cg; data[o + 2] = cb; data[o + 3] = a
      }
    }
    const tmp = new Float32Array(data.length)
    if (mx) smear(data, tmp, bw, bh, mx, false)
    if (my) smear(data, tmp, bw, bh, my, true)
    gaussianFast(data, tmp, bw, bh, sigma)

    const buf = { x: x0, y: y0, w: bw, h: bh, data }
    this.cache.set(key, buf)
    // Keep a couple of versions of every layer around, and no more.
    const limit = this.scene!.layers.length * 2 + 4
    while (this.cache.size > limit) this.cache.delete(this.cache.keys().next().value!)
    return buf
  }

  private composite(shot: Shot) {
    const { w: W, h: H, acc } = this
    acc.fill(0)
    for (const layer of this.scene!.layers) {
      const b = this.layerBuffer(layer, shot)
      if (!b) continue
      const ys = Math.max(0, b.y), ye = Math.min(H, b.y + b.h)
      const xs = Math.max(0, b.x), xe = Math.min(W, b.x + b.w)
      for (let y = ys; y < ye; y++) {
        let s = ((y - b.y) * b.w + (xs - b.x)) * 4
        let o = (y * W + xs) * 3
        for (let x = xs; x < xe; x++, s += 4, o += 3) {
          const a = b.data[s + 3]
          const r = b.data[s], g = b.data[s + 1], bl = b.data[s + 2]
          if (a === 0 && r === 0 && g === 0 && bl === 0) continue
          const k = 1 - a
          acc[o] = r + acc[o] * k
          acc[o + 1] = g + acc[o + 1] * k
          acc[o + 2] = bl + acc[o + 2] * k
        }
      }
    }
    return acc
  }

  // Hand shake while the shutter is open smears the whole frame a little.
  private shake(src: Float32Array, shot: Shot) {
    const t = shot.shakeTime ?? shot.shutter
    const len = (shot.shake ?? 0) * this.w * 0.035 * t * (this.scene!.crop ?? 1)
    if (len < 1.5) return src
    const { w: W, h: H } = this
    // Widen to four channels for the box blur, then back.
    const n = W * H
    if (!this.wide || this.wide.length !== n * 4) {
      this.wide = new Float32Array(n * 4)
      this.wideTmp = new Float32Array(n * 4)
    }
    const buf = this.wide
    const tmp = this.wideTmp!
    for (let i = 0; i < n; i++) {
      buf[i * 4] = src[i * 3]; buf[i * 4 + 1] = src[i * 3 + 1]; buf[i * 4 + 2] = src[i * 3 + 2]; buf[i * 4 + 3] = 1
    }
    smear(buf, tmp, W, H, len, false)
    smear(buf, tmp, W, H, len * 0.6, true)
    if (!this.shaken || this.shaken.length !== n * 3) this.shaken = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      this.shaken[i * 3] = buf[i * 4]; this.shaken[i * 3 + 1] = buf[i * 4 + 1]; this.shaken[i * 3 + 2] = buf[i * 4 + 2]
    }
    return this.shaken
  }

  // The light that reached the sensor, white-balanced and with its noise,
  // before anything is clipped: what a RAW file keeps.
  expose(shot: Shot): Float32Array {
    const scene = this.scene!
    const light = this.shake(this.composite(shot), shot)
    const m = Math.pow(2, scene.ev - ev100(shot.aperture, shot.shutter, shot.iso) + (shot.gain ?? 0))
    const [ir, ig, ib] = lightColour(shot.wb)
    const tint = Math.pow(2, -0.35 * (shot.tint ?? 0))
    const gr = m / ir, gg = (m / ig) * tint, gb = m / ib
    const out = new Float32Array(light.length)
    const noisy = shot.noise !== false
    const gain = shot.iso / 100
    const quiet = 1 / Math.sqrt(shot.frames ?? 1)
    const z = grain()
    const mask = z.length - 1
    const n = this.w * this.h
    for (let i = 0; i < n; i++) {
      let r = light[i * 3] * gr
      let g = light[i * 3 + 1] * gg
      let b = light[i * 3 + 2] * gb
      if (noisy) {
        const y = Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b)
        // Shot noise grows with the light; read noise with the gain alone.
        const s = (Math.sqrt(0.00006 * y * gain) + 0.00035 * gain) * quiet
        const j = (i * 4) & mask
        const l = z[j] * 0.75
        r += s * (l + 0.55 * z[(j + 1) & mask])
        g += s * (l + 0.45 * z[(j + 2) & mask])
        b += s * (l + 0.65 * z[(j + 3) & mask])
      }
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b
    }
    return out
  }

  // Clip, encode and grade linear light into a picture, and count it up.
  finish(light: Float32Array, grade?: Grade | null, gain = 1): Develop {
    const n = this.w * this.h
    const image = new ImageData(this.w, this.h)
    const px = image.data
    const histogram = new Uint32Array(256)
    let clipped = 0, crushed = 0
    const rgb = [0, 0, 0]
    for (let i = 0; i < n; i++) {
      let r = encode(light[i * 3] * gain)
      let g = encode(light[i * 3 + 1] * gain)
      let b = encode(light[i * 3 + 2] * gain)
      if (grade) {
        rgb[0] = r / 255; rgb[1] = g / 255; rgb[2] = b / 255
        applyGrade(rgb, grade)
        r = rgb[0] * 255; g = rgb[1] * 255; b = rgb[2] * 255
      }
      const o = i * 4
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255
      const y = (54 * px[o] + 183 * px[o + 1] + 19 * px[o + 2]) >> 8
      histogram[y]++
      if (px[o] >= 254 || px[o + 1] >= 254 || px[o + 2] >= 254) clipped++
      if (y <= 3) crushed++
    }
    return { image, histogram, clipped: clipped / n, crushed: crushed / n }
  }

  develop(shot: Shot): Develop {
    return this.finish(this.expose(shot), shot.grade)
  }
}

// What an 8-bit file keeps of the light: everything clipped to white and
// rounded to 256 steps. Editing starts from this, not from the light.
export function eightBit(light: Float32Array) {
  const out = new Float32Array(light.length)
  for (let i = 0; i < light.length; i++) out[i] = LINEAR[encode(light[i])]
  return out
}
