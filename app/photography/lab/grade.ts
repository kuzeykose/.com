// Photographic Styles, roughly: each is a small recipe of warmth, tint,
// saturation and contrast, applied to the developed picture. The phone's
// real ones are subtler and treat skin separately, but they push the
// picture the same way.

export type Grade = {
  warmth: number // + amber, − blue
  tint: number // + magenta, − green
  saturation: number
  contrast: number
  // Raises (+) or deepens (−) the shadows.
  shadows: number
  // Lifts the blacks to grey, like old film.
  fade: number
  mono?: boolean
}

export const NEUTRAL: Grade = { warmth: 0, tint: 0, saturation: 0, contrast: 0, shadows: 0, fade: 0 }

export type StyleName =
  | 'Standard' | 'Amber' | 'Gold' | 'Rose Gold' | 'Neutral' | 'Cool Rose'
  | 'Vibrant' | 'Natural' | 'Luminous' | 'Dramatic' | 'Quiet' | 'Cozy' | 'Ethereal'
  | 'Muted B&W' | 'Stark B&W'

export const STYLES: { name: StyleName; kind: 'undertone' | 'mood'; grade: Partial<Grade>; note: string }[] = [
  { name: 'Standard', kind: 'undertone', grade: {}, note: 'What the iPhone does by default.' },
  { name: 'Amber', kind: 'undertone', grade: { warmth: 0.22, saturation: 0.05 }, note: 'A warm, amber undertone.' },
  { name: 'Gold', kind: 'undertone', grade: { warmth: 0.26, tint: -0.06, saturation: 0.1, contrast: 0.05 }, note: 'Warmer still, with a golden glow.' },
  { name: 'Rose Gold', kind: 'undertone', grade: { warmth: 0.12, tint: 0.16, saturation: 0.04 }, note: 'Warm with a pink blush.' },
  { name: 'Neutral', kind: 'undertone', grade: { warmth: -0.1, saturation: -0.06 }, note: 'Takes the warmth out.' },
  { name: 'Cool Rose', kind: 'undertone', grade: { warmth: -0.14, tint: 0.12 }, note: 'Cool, with a rosy cast.' },
  { name: 'Vibrant', kind: 'mood', grade: { saturation: 0.38, contrast: 0.1 }, note: 'Bright, saturated colour.' },
  { name: 'Natural', kind: 'mood', grade: { saturation: -0.06, contrast: -0.06, shadows: 0.04 }, note: 'True to life and gentle.' },
  { name: 'Luminous', kind: 'mood', grade: { shadows: 0.12, contrast: -0.08, saturation: 0.1 }, note: 'Light and airy.' },
  { name: 'Dramatic', kind: 'mood', grade: { contrast: 0.38, shadows: -0.08, saturation: -0.12 }, note: 'Deep shadows and bite.' },
  { name: 'Quiet', kind: 'mood', grade: { fade: 0.12, saturation: -0.3, contrast: -0.18 }, note: 'Soft, faded and muted.' },
  { name: 'Cozy', kind: 'mood', grade: { warmth: 0.24, contrast: 0.08, shadows: -0.06, saturation: -0.06 }, note: 'Dark and warm.' },
  { name: 'Ethereal', kind: 'mood', grade: { fade: 0.08, saturation: -0.18, tint: 0.1, shadows: 0.06 }, note: 'Dreamy, pale and pink.' },
  { name: 'Muted B&W', kind: 'mood', grade: { mono: true, contrast: -0.15, fade: 0.06 }, note: 'Soft black and white.' },
  { name: 'Stark B&W', kind: 'mood', grade: { mono: true, contrast: 0.42, shadows: -0.06 }, note: 'Punchy black and white.' },
]

// Build the grade the Camera app would apply: the style at `palette`
// strength (0–1), then the Tone and Color pad (each −1 to 1) on top.
export function styleGrade(name: StyleName, palette = 1, tone = 0, color = 0): Grade {
  const style = STYLES.find((s) => s.name === name)!.grade
  const g = { ...NEUTRAL }
  for (const k of ['warmth', 'tint', 'saturation', 'contrast', 'shadows', 'fade'] as const) g[k] = (style[k] ?? 0) * palette
  g.mono = style.mono && palette > 0.5
  // Tone: up is deeper shadows and more contrast, down is flatter and lifted.
  g.contrast += tone * 0.3
  g.shadows -= tone * 0.12
  // Color: up is richer, down is more muted.
  g.saturation += color * 0.55
  return g
}

export const isNeutral = (g: Grade) =>
  !g.mono && !g.warmth && !g.tint && !g.saturation && !g.contrast && !g.shadows && !g.fade

export function applyGrade(c: number[], g: Grade) {
  let r = c[0], gr = c[1], b = c[2]
  if (g.warmth) {
    r *= 1 + 0.22 * g.warmth
    b *= 1 - 0.3 * g.warmth
  }
  if (g.tint) {
    gr *= 1 - 0.18 * g.tint
    r *= 1 + 0.04 * g.tint
  }
  const y = 0.2126 * r + 0.7152 * gr + 0.0722 * b
  if (g.mono) r = gr = b = y
  else if (g.saturation) {
    const s = 1 + g.saturation
    r = y + (r - y) * s
    gr = y + (gr - y) * s
    b = y + (b - y) * s
  }
  const curve = (v: number) => {
    if (g.shadows) v += g.shadows * v * (1 - v) * (1 - v) * 2.4
    // An S-curve around the middle grey of the picture.
    if (g.contrast) {
      const k = g.contrast
      const s = v * v * (3 - 2 * v)
      v = k > 0 ? v + (s - v) * k * 1.6 : v + (0.5 - v) * -k * 0.6
    }
    if (g.fade) v = g.fade * 0.6 + v * (1 - g.fade * 0.75)
    return v < 0 ? 0 : v > 1 ? 1 : v
  }
  c[0] = curve(r)
  c[1] = curve(gr)
  c[2] = curve(b)
}
