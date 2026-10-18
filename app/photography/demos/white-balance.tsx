'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { cafe } from '../lab/scenes'
import { autoExpose, kelvinSwatch } from '../lab/optics'
import type { Develop } from '../lab/darkroom'
import { Choice, Demo, Range } from '../ui'

const LIGHTS = [
  { k: 1900, label: 'Candle' },
  { k: 2700, label: 'Old bulb' },
  { k: 3200, label: 'Warm LED' },
  { k: 4000, label: 'Office light' },
  { k: 5500, label: 'Midday sun' },
  { k: 6500, label: 'Overcast' },
  { k: 8000, label: 'Blue shade' },
]

const PRESETS = [
  { k: 3200, label: 'Tungsten' },
  { k: 4000, label: 'Fluorescent' },
  { k: 5500, label: 'Daylight' },
  { k: 6500, label: 'Cloudy' },
  { k: 7500, label: 'Shade' },
]

// Auto white balance gets close, but leaves very warm light a little warm
// on purpose: candlelight that looks white looks wrong.
export const autoWhite = (k: number) => (k < 4000 ? k + (4000 - k) * 0.15 : k > 7000 ? k - (k - 7000) * 0.3 : k)

export function WhiteBalanceDemo() {
  const [light, setLight] = useState(2700)
  const [mode, setMode] = useState<'auto' | 'preset' | 'kelvin'>('auto')
  const [preset, setPreset] = useState(5500)
  const [kelvin, setKelvin] = useState(5500)
  const [tint, setTint] = useState(0)
  const [swatch, setSwatch] = useState<[number, number, number] | null>(null)
  const scene = useMemo(() => cafe({ kelvin: light }), [light])
  const e = autoExpose(scene.ev, { aperture: 1.8 })
  const wb = mode === 'auto' ? autoWhite(light) : mode === 'preset' ? preset : kelvin
  const shot = useMemo(() => ({ ...e, focus: 0.3, wb, tint: mode === 'kelvin' ? tint : 0, noise: false }), [wb, tint, mode, scene])

  // Sample the saucer, which should come out neutral white or grey.
  const sample = (d: Develop) => {
    const { width: w, height: h, data } = d.image
    let r = 0, g = 0, b = 0, n = 0
    for (let y = Math.round(h * 0.885); y < h * 0.9; y++)
      for (let x = Math.round(w * 0.47); x < w * 0.53; x++) {
        const i = (y * w + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    setSwatch([r / n, g / n, b / n].map(Math.round) as [number, number, number])
  }
  const cast = swatch ? describeCast(swatch) : ''

  return (
    <Demo title="White balance">
      <div className="mb-3">
        <Choice label="The light in the café" options={LIGHTS.map((l) => ({ value: l.k, label: l.label }))} value={light} onChange={setLight} small />
      </div>
      <Viewfinder scene={scene} shot={shot} onDevelop={sample} label="A café table under the chosen light">
        <div className="pointer-events-none absolute h-3 w-[6%] rounded-sm border border-white/80" style={{ left: '47%', top: '88%' }} />
      </Viewfinder>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-md border border-neutral-300 dark:border-neutral-700" style={{ background: swatch ? `rgb(${swatch.join(',')})` : undefined }} />
        <div className="text-sm">
          <div className="font-mono text-xs text-neutral-500">
            Saucer: R {swatch?.[0]} · G {swatch?.[1]} · B {swatch?.[2]}
          </div>
          <div className="text-neutral-700 dark:text-neutral-300">{cast}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Choice
          label="White balance"
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'preset', label: 'Preset' },
            { value: 'kelvin', label: 'Kelvin' },
          ]}
          value={mode}
          onChange={setMode}
          small
        />
        {mode === 'preset' && <Choice options={PRESETS.map((p) => ({ value: p.k, label: `${p.label} · ${p.k}K` }))} value={preset} onChange={setPreset} small />}
        {mode === 'kelvin' && (
          <>
            <div>
              <Range label="Temperature" min={1800} max={10000} step={100} value={kelvin} onChange={setKelvin} format={(k) => `${k}K`} />
              <div className="mt-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${[1800, 3000, 4500, 6500, 10000].map((k) => kelvinSwatch(k)).join(',')})` }} />
            </div>
            <Range label="Tint" min={-1} max={1} step={0.05} value={tint} onChange={setTint} format={(t) => (t === 0 ? '0' : t < 0 ? `${Math.round(t * 100)} green` : `+${Math.round(t * 100)} magenta`)} />
          </>
        )}
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The number tells the camera what colour the light is, so it can cancel it out. Set it lower than the light
          and the picture turns blue; higher and it turns orange. When it matches, the saucer goes neutral.
          {mode === 'auto' && light < 3500 ? ' Auto leaves warm light a little warm on purpose, so it still feels like candlelight.' : ''}
        </p>
      </div>
    </Demo>
  )
}

function describeCast([r, g, b]: [number, number, number]) {
  const warm = r - b
  // Green sticks out above both red and blue; magenta dips below both.
  const green = g - Math.max(r, b)
  const magenta = Math.min(r, b) - g
  if (Math.abs(warm) < 10 && green < 6 && magenta < 6) return 'Neutral. The white balance matches the light.'
  const parts: string[] = []
  if (warm > 10) parts.push(warm > 45 ? 'very orange' : 'warm, a little orange')
  if (warm < -10) parts.push(warm < -45 ? 'very blue' : 'cool, a little blue')
  if (green >= 6) parts.push('greenish')
  if (magenta >= 6) parts.push('magenta')
  return `Off-white: ${parts.join(' and ')}.`
}
