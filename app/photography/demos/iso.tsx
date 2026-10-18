'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { night } from '../lab/scenes'
import { ISOS, SHUTTERS, formatIso, formatShutter, meterReading } from '../lab/optics'
import type { Develop } from '../lab/darkroom'
import { Choice, Demo, Meter, Readout, Stepper } from '../ui'

// A magnified corner of the picture, pixels and all.
export function useLoupe(cx: number, cy: number, size = 72, scale = 3) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scratch = useRef<HTMLCanvasElement | null>(null)
  const draw = useCallback(
    (d: Develop) => {
      const out = ref.current
      if (!out) return
      if (!scratch.current) scratch.current = document.createElement('canvas')
      const s = scratch.current
      s.width = d.image.width
      s.height = d.image.height
      s.getContext('2d')!.putImageData(d.image, 0, 0)
      const w = Math.round(size * 1.33)
      out.width = w * scale
      out.height = size * scale
      const ctx = out.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(s, Math.round(cx * d.image.width - w / 2), Math.round(cy * d.image.height - size / 2), w, size, 0, 0, w * scale, size * scale)
    },
    [cx, cy, size, scale]
  )
  return [ref, draw] as const
}

export function IsoDemo() {
  const [how, setHow] = useState<'iso' | 'time'>('iso')
  const [iso, setIso] = useState(50)
  const [shutter, setShutter] = useState(1 / 60)
  const scene = useMemo(() => night({ ev: 3 }), [])
  const e = how === 'iso' ? { aperture: 1.48, shutter: 1 / 60, iso } : { aperture: 1.48, shutter, iso: 50 }
  const stops = meterReading(scene.ev, e)
  const shot = useMemo(() => ({ ...e, focus: 2.6, wb: scene.kelvin, shake: 0 }), [e.shutter, e.iso, scene])
  const [loupe, onDevelop] = useLoupe(0.7, 0.36)

  return (
    <Demo title="ISO">
      <div className="mb-3">
        <Choice
          label="How should we brighten this dark street?"
          options={[
            { value: 'iso', label: 'Turn up ISO' },
            { value: 'time', label: 'Keep ISO low, open longer' },
          ]}
          value={how}
          onChange={setHow}
          small
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Viewfinder scene={scene} shot={shot} onDevelop={onDevelop} label="A street at night" />
        <div>
          <canvas ref={loupe} className="block h-auto w-full rounded-lg bg-neutral-900" style={{ imageRendering: 'pixelated' }} aria-label="Close-up of your friend's face" />
          <p className="mt-1 text-xs text-neutral-500">Close-up of your friend, 3× bigger. Look at the speckles.</p>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {how === 'iso' ? (
          <Stepper label="ISO" values={ISOS} value={iso} onChange={setIso} format={(v) => `${v}`} />
        ) : (
          <Stepper
            label="Shutter speed (on a tripod)"
            values={SHUTTERS.filter((t) => t >= 1 / 60 && t <= 8)}
            value={shutter}
            onChange={setShutter}
            format={formatShutter}
          />
        )}
        <Readout
          items={[
            { label: 'ƒ', value: '1.48' },
            { label: 'shutter', value: formatShutter(e.shutter) },
            { label: 'ISO', value: formatIso(e.iso), warn: e.iso >= 1600 },
          ]}
        />
        <Meter stops={stops} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {how === 'iso'
            ? 'Each doubling of ISO doubles the brightness, but the sensor caught no more light: the grain comes up with it. Around ISO 800 to 1600 it reaches the brightness the scene needs.'
            : 'Collecting more light is the clean way to brighten: no grain. The price is time. Anything that moves smears, and you need the phone to be perfectly still.'}
        </p>
      </div>
    </Demo>
  )
}
