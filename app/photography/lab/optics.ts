// The arithmetic of exposure: stops, the three settings, and how the
// iPhone picks the ones you leave on auto.

// The four stops the iPhone 18 Pro's main camera can close down to.
export const IPHONE_APERTURES = [1.48, 1.8, 2.8, 4]

// Shutter speeds in seconds, one third of a stop apart, fastest first.
export const SHUTTERS = [
  1 / 8000, 1 / 6400, 1 / 5000, 1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600,
  1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200,
  1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20,
  1 / 15, 1 / 13, 1 / 10, 1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2.5, 1 / 2, 1 / 1.6,
  1 / 1.3, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30,
]

// ISO in thirds of a stop.
export const ISOS = [
  50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600,
  2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800,
]

export const ISO_MIN = 50
export const ISO_MAX = 12800
// Slower than this and an unsupported hand starts to show (the iPhone's
// stabiliser buys a little more, but this is the old rule of thumb).
export const HANDHELD = 1 / 60

const nearest = (list: number[], v: number) =>
  list.reduce((best, x) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(best / v)) ? x : best))

export function formatShutter(t: number) {
  const s = nearest(SHUTTERS, t)
  if (s >= 1) return `${s}s`
  const d = 1 / s
  return `1/${d < 10 ? Math.round(d * 10) / 10 : Math.round(d)}`
}

export const formatIso = (iso: number) => `${nearest(ISOS, iso)}`

export const formatAperture = (n: number) => `ƒ/${n < 10 ? Number(n.toFixed(2)) : Math.round(n)}`

export function formatEv(ev: number) {
  const r = Math.round(ev * 3) / 3
  if (Math.abs(r) < 0.05) return '0'
  const whole = Math.trunc(r)
  const third = Math.round(Math.abs(r - whole) * 3)
  const sign = r > 0 ? '+' : '−'
  const frac = third === 0 ? '' : third === 1 ? '⅓' : '⅔'
  return `${sign}${Math.abs(whole) || (frac ? '' : '0')}${frac}`
}

// The exposure value of a combination, at ISO 100. One higher is one stop
// less light.
export const ev100 = (aperture: number, shutter: number, iso: number) =>
  Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100)

export type Exposure = { aperture: number; shutter: number; iso: number }

// What the Camera app does when you leave things on auto. It meters `ev`,
// holds whatever you fixed (aperture always, shutter if you set it), and
// fills in the rest: keep ISO low, keep the shutter fast enough to hold,
// and only then let the shutter drag.
export function autoExpose(
  ev: number,
  opts: { aperture: number; shutter?: number; compensation?: number; slowest?: number }
): Exposure {
  const { aperture: N, compensation = 0, slowest = 1 } = opts
  const target = ev - compensation
  const shutterFor = (iso: number) => (N * N) / Math.pow(2, target + Math.log2(iso / 100))
  const isoFor = (t: number) => 100 * Math.pow(2, Math.log2((N * N) / t) - target)

  if (opts.shutter) {
    const iso = Math.min(ISO_MAX, Math.max(ISO_MIN, isoFor(opts.shutter)))
    return { aperture: N, shutter: opts.shutter, iso }
  }
  let t = shutterFor(ISO_MIN)
  if (t < 1 / 8000) return { aperture: N, shutter: 1 / 8000, iso: ISO_MIN }
  if (t <= HANDHELD) return { aperture: N, shutter: t, iso: ISO_MIN }
  const iso = isoFor(HANDHELD)
  if (iso <= ISO_MAX) return { aperture: N, shutter: HANDHELD, iso }
  t = Math.min(slowest, shutterFor(ISO_MAX))
  return { aperture: N, shutter: t, iso: ISO_MAX }
}

// How far a combination is from what the scene needs, in stops.
// Positive is too bright.
export const meterReading = (ev: number, e: Exposure) => ev - ev100(e.aperture, e.shutter, e.iso)

// A lens as the blur maths sees it: its real focal length and the width of
// the sensor behind it, both in millimetres.
export type Lens = { focal: number; sensor: number }

// The 48MP Fusion main camera: 24mm-equivalent on a sensor about 9.8mm wide.
export const MAIN_LENS: Lens = { focal: 6.86, sensor: 9.8 }

// The blur circle a point at `distance` makes when the lens is focused at
// `focus` (both in metres), as a fraction of the frame width.
export function blurCircle(lens: Lens, aperture: number, focus: number, distance: number, crop = 1) {
  const f = lens.focal
  const s1 = Math.max(focus * 1000, f * 1.5)
  const s2 = distance * 1000
  const c = ((f * f) / (aperture * (s1 - f))) * (Math.abs(s2 - s1) / s2)
  return (c / lens.sensor) * crop
}

// Portrait mode doesn't use the lens for its blur: it measures depth and
// paints the blur in, as if a big camera had taken the picture. The
// numbers are tuned so ƒ/1.4 on someone a metre or so away looks like it does on
// the phone.
export const portraitBlur = (aperture: number, focus: number, distance: number) =>
  (0.16 / aperture) * Math.abs(1 / Math.max(focus, 0.2) - 1 / distance)

// Colour temperature to a linear-light RGB, scaled so its brightness is 1.
// (Tanner Helland's fit to the black-body curve.)
const kelvinCache = new Map<number, [number, number, number]>()
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

function blackBody(k: number): [number, number, number] {
  const t = k / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const clamp = (v: number) => Math.min(255, Math.max(0, v)) / 255
  return [toLinear(clamp(r)), toLinear(clamp(g)), Math.max(0.03, toLinear(clamp(b)))]
}

export function lightColour(kelvin: number): [number, number, number] {
  const k = Math.round(kelvin / 50) * 50
  const hit = kelvinCache.get(k)
  if (hit) return hit
  const [r, g, b] = blackBody(k)
  const [wr, wg, wb] = blackBody(6500)
  const rel: [number, number, number] = [r / wr, g / wg, b / wb]
  const y = 0.2126 * rel[0] + 0.7152 * rel[1] + 0.0722 * rel[2]
  const out: [number, number, number] = [rel[0] / y, rel[1] / y, rel[2] / y]
  kelvinCache.set(k, out)
  return out
}

// A swatch of what light of this temperature looks like, for the UI.
export function kelvinSwatch(kelvin: number) {
  const [r, g, b] = blackBody(kelvin)
  const m = Math.max(r, g, b)
  const enc = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
  return `rgb(${enc(r / m)}, ${enc(g / m)}, ${enc(b / m)})`
}
