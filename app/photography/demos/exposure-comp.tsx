'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { night, park } from '../lab/scenes'
import { autoExpose, formatEv, formatIso, formatShutter, meterReading } from '../lab/optics'
import type { Develop } from '../lab/darkroom'
import { Choice, Demo, Histogram, Meter, Range, Readout } from '../ui'

type Pick = 'snow' | 'night' | 'park'

const PICKS: Record<Pick, { label: string; build: () => ReturnType<typeof park>; focus: number; fix: string }> = {
  snow: {
    label: 'Snowy day',
    build: () => park({ winter: true }),
    focus: 3.2,
    fix: 'All that white fools the meter into making the snow grey. Push it up about +1⅓ to make snow white again.',
  },
  night: {
    label: 'Night street',
    build: () => night(),
    focus: 2.6,
    fix: 'The meter wants the night to look like an overcast day. Pull it down about −1 to keep it dark and moody.',
  },
  park: {
    label: 'Ordinary day',
    build: () => park(),
    focus: 3.2,
    fix: "A scene with a bit of everything is what the meter's good at. Leave it at 0, or nudge to taste.",
  },
}

export function ExposureCompDemo() {
  const [pick, setPick] = useState<Pick>('snow')
  const [comp, setComp] = useState(0)
  const [dev, setDev] = useState<Develop | null>(null)
  const cfg = PICKS[pick]
  const scene = useMemo(() => cfg.build(), [pick])
  const e = autoExpose(scene.meterEv ?? scene.ev, { aperture: 1.8, compensation: comp })
  const stops = meterReading(scene.ev, e)
  const shot = useMemo(() => ({ ...e, focus: cfg.focus, wb: scene.kelvin }), [e.shutter, e.iso, scene])

  return (
    <Demo title="Exposure compensation">
      <div className="mb-3">
        <Choice
          options={(Object.keys(PICKS) as Pick[]).map((k) => ({ value: k, label: PICKS[k].label }))}
          value={pick}
          onChange={(k) => {
            setPick(k)
            setComp(0)
          }}
          small
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Viewfinder scene={scene} shot={shot} onDevelop={setDev} label={cfg.label} />
        {/* The sun slider the iPhone shows next to the focus square. */}
        <div className="flex items-center gap-3 sm:flex-col">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg text-amber-300" aria-hidden>
            ☀
          </div>
          <div className="w-full sm:w-44">
            <Range label="Exposure" min={-2} max={2} step={1 / 3} value={comp} onChange={setComp} format={formatEv} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Readout
            items={[
              { label: 'shutter', value: formatShutter(e.shutter) },
              { label: 'ISO', value: formatIso(e.iso) },
            ]}
          />
          <Meter stops={stops} />
        </div>
        <Histogram data={dev?.histogram ?? null} height={56} />
      </div>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{cfg.fix}</p>
    </Demo>
  )
}
