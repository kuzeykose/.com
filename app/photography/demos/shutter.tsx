'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { night, park, waterfall } from '../lab/scenes'
import { SHUTTERS, autoExpose, formatAperture, formatIso, formatShutter, meterReading } from '../lab/optics'
import { Choice, Demo, Meter, Readout, Stepper, Toggle } from '../ui'

type Subject = 'cyclist' | 'waterfall' | 'traffic'

const SUBJECTS: Record<Subject, { label: string; build: () => ReturnType<typeof park>; focus: number; aperture: number; presets: [number, string, boolean?][] }> = {
  cyclist: {
    label: 'Cyclist',
    build: () => park(),
    focus: 8,
    aperture: 1.8,
    presets: [[1 / 2000, 'Freeze'], [1 / 30, 'A hint of speed', true], [1 / 4, 'Streak', true]],
  },
  waterfall: {
    label: 'Waterfall',
    build: () => waterfall(),
    focus: 10.8,
    aperture: 4,
    presets: [[1 / 4000, 'Every drop'], [1 / 60, 'Natural'], [1, 'Silk', true]],
  },
  traffic: {
    label: 'Traffic at night',
    build: () => night({ alone: true }),
    focus: 14,
    aperture: 4,
    presets: [[1 / 250, 'Frozen car'], [1 / 15, 'Blur'], [2, 'Light trails']],
  },
}

export function ShutterDemo() {
  const [subject, setSubject] = useState<Subject>('cyclist')
  const [shutter, setShutter] = useState(1 / 1000)
  const [tripod, setTripod] = useState(true)
  const [nd, setNd] = useState(false)
  const cfg = SUBJECTS[subject]
  const scene = useMemo(() => cfg.build(), [subject])
  // You pick the shutter; the iPhone picks ISO to match, as far as it can.
  // A dark (ND) filter cuts six stops of light, as if the scene were darker.
  const ev = scene.ev - (nd ? 6 : 0)
  const e = autoExpose(ev, { aperture: cfg.aperture, shutter })
  const stops = meterReading(ev, e)
  const shot = useMemo(
    () => ({ ...e, focus: cfg.focus, wb: scene.kelvin, shake: tripod ? 0 : 1, gain: nd ? -6 : 0 }),
    [e.shutter, e.iso, e.aperture, scene, tripod, nd]
  )

  return (
    <Demo title="Shutter speed">
      <div className="mb-3">
        <Choice
          options={(Object.keys(SUBJECTS) as Subject[]).map((k) => ({ value: k, label: SUBJECTS[k].label }))}
          value={subject}
          onChange={(k) => {
            setSubject(k)
            setShutter(SUBJECTS[k].presets[0][0])
            setNd(false)
          }}
          small
        />
      </div>
      <Viewfinder scene={scene} shot={shot} label={`${cfg.label} at ${formatShutter(shutter)}`}>
        <ShutterBar shutter={shutter} />
      </Viewfinder>
      <div className="mt-3 space-y-3">
        <Stepper label="Shutter speed" values={SHUTTERS} value={shutter} onChange={setShutter} format={formatShutter} />
        <div className="flex flex-wrap gap-1.5">
          {cfg.presets.map(([t, name, filter]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setShutter(t)
                setNd(!!filter)
              }}
              className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:border-orange-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              {name} · {formatShutter(t)}
              {filter ? ' + filter' : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Toggle label="On a tripod" checked={tripod} onChange={setTripod} />
          <Toggle label="Dark (ND) filter on the lens" checked={nd} onChange={setNd} />
        </div>
        <Readout
          items={[
            { label: 'aperture', value: formatAperture(e.aperture) },
            { label: 'ISO (auto)', value: formatIso(e.iso), warn: e.iso >= 1600 },
          ]}
        />
        {Math.abs(stops) > 0.4 && <Meter stops={stops} />}
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {Math.abs(stops) > 0.4
            ? stops > 0
              ? 'Even at the lowest ISO, this much time lets in too much light. In daylight a long exposure needs a dark (ND) filter, or the Live Photo trick further down.'
              : 'The iPhone has run out of ISO, so the picture gets darker. A slower shutter would let in more light.'
            : 'The iPhone moves ISO to keep the brightness steady, so you only see what time does to motion.'}
        </p>
      </div>
    </Demo>
  )
}

// A bar showing how long the shutter stays open, on a log scale.
function ShutterBar({ shutter }: { shutter: number }) {
  const t = (Math.log2(shutter) - Math.log2(1 / 8000)) / (Math.log2(30) - Math.log2(1 / 8000))
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-full bg-black/55 px-2 py-1 font-mono text-[10px] text-white">
      <span>open</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
        <span className="absolute inset-y-0 left-0 rounded-full bg-orange-500 transition-[width]" style={{ width: `${Math.max(2, t * 100)}%` }} />
      </span>
      <span>{formatShutter(shutter)}</span>
    </div>
  )
}
