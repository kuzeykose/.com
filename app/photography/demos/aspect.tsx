'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { park } from '../lab/scenes'
import { autoExpose } from '../lab/optics'
import { Choice, Demo } from '../ui'

type Ratio = '4:3' | '16:9' | '1:1'

// The part of the 4:3 sensor each shape keeps, as fractions of its width and height.
const KEEP: Record<Ratio, { w: number; h: number; use: string }> = {
  '4:3': { w: 1, h: 1, use: 'The whole sensor. Best for prints and for cropping later.' },
  '16:9': { w: 1, h: 0.75, use: 'Wide like a TV or a laptop screen; turn the phone upright and it fills a phone screen. Cuts the top and bottom.' },
  '1:1': { w: 0.75, h: 1, use: 'A square, for a profile picture or a calm, centred subject. Cuts the sides.' },
}

export function AspectDemo() {
  const [ratio, setRatio] = useState<Ratio>('4:3')
  const scene = useMemo(() => park(), [])
  const e = autoExpose(scene.ev, { aperture: 1.8 })
  const shot = useMemo(() => ({ ...e, focus: 3.2, wb: scene.kelvin, noise: false }), [scene])
  const k = KEEP[ratio]
  const left = ((1 - k.w) / 2) * 100
  const top = ((1 - k.h) / 2) * 100

  return (
    <Demo title="Aspect ratio">
      <Viewfinder scene={scene} shot={shot} label={`The park framed at ${ratio}`}>
        <div
          className="pointer-events-none absolute border-2 border-amber-300 transition-all duration-300"
          style={{ left: `${left}%`, right: `${left}%`, top: `${top}%`, bottom: `${top}%`, boxShadow: '0 0 0 999px rgba(0,0,0,0.6)' }}
        />
      </Viewfinder>
      <div className="mt-3 space-y-2">
        <Choice options={(['4:3', '16:9', '1:1'] as Ratio[]).map((r) => ({ value: r, label: r }))} value={ratio} onChange={setRatio} small />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {k.use} {ratio !== '4:3' && `You keep ${Math.round(k.w * k.h * 100)}% of the pixels.`}
        </p>
      </div>
    </Demo>
  )
}
