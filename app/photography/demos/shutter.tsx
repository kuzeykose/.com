'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto, type PhotoSpec } from '../lab/photo'
import { CYCLIST, TRAFFIC, WATERFALL } from '../lab/photos'
import { IPHONE_APERTURES, SHUTTERS, autoExpose, formatAperture, formatIso, formatShutter, meterReading } from '../lab/optics'
import { Choice, Demo, Meter, Readout, Stepper, Toggle } from '../ui'

type Subject = 'cyclist' | 'waterfall' | 'traffic'

// A preset is a shutter speed and a name; some need the dark filter, or a different aperture.
type Preset = [number, string, { filter?: boolean; aperture?: number }?]

const SUBJECTS: Record<Subject, { label: string; spec: PhotoSpec; focus: number; aperture: number; presets: Preset[] }> = {
  cyclist: {
    label: 'Cyclist',
    spec: CYCLIST,
    focus: 5.5,
    aperture: 4,
    presets: [[1 / 2000, 'Freeze'], [1 / 30, 'A hint of speed', { filter: true }], [1 / 4, 'Streak', { filter: true }]],
  },
  waterfall: {
    label: 'Waterfall',
    spec: WATERFALL,
    focus: 15,
    aperture: 4,
    presets: [[1 / 4000, 'Every drop'], [1 / 60, 'Natural'], [1, 'Silk', { filter: true }]],
  },
  traffic: {
    label: 'Traffic at night',
    spec: TRAFFIC,
    focus: 5,
    aperture: 4,
    presets: [[1 / 250, 'Frozen taxi', { aperture: 1.48 }], [1 / 15, 'Blur'], [1 / 2, 'Light trails']],
  },
}

export function ShutterDemo() {
  const [subject, setSubject] = useState<Subject>('cyclist')
  const [shutter, setShutter] = useState(1 / 1000)
  const [tripod, setTripod] = useState(true)
  const [nd, setNd] = useState(false)
  const [aperture, setAperture] = useState(SUBJECTS.cyclist.aperture)
  const cfg = SUBJECTS[subject]
  const scene = usePhoto(cfg.spec)
  // You pick the shutter; the iPhone picks ISO to match, as far as it can.
  // A dark (ND) filter cuts six stops of light, as if the scene were darker.
  const ev = cfg.spec.ev - (nd ? 6 : 0)
  const e = autoExpose(ev, { aperture, shutter })
  const stops = meterReading(ev, e)
  const shot = useMemo(
    () => ({ ...e, focus: cfg.focus, wb: cfg.spec.kelvin, shake: tripod ? 0 : 1, gain: nd ? -6 : 0 }),
    [e.shutter, e.iso, e.aperture, subject, tripod, nd]
  )

  return (
    <Demo title="Shutter speed">
      <div className="mb-3">
        <Choice
          options={(Object.keys(SUBJECTS) as Subject[]).map((k) => ({ value: k, label: SUBJECTS[k].label }))}
          value={subject}
          onChange={(k) => {
            const [t, , opts] = SUBJECTS[k].presets[0]
            setSubject(k)
            setShutter(t)
            setNd(!!opts?.filter)
            setAperture(opts?.aperture ?? SUBJECTS[k].aperture)
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
          {cfg.presets.map(([t, name, opts]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setShutter(t)
                setNd(!!opts?.filter)
                setAperture(opts?.aperture ?? cfg.aperture)
              }}
              className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:border-orange-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              {name} · {formatShutter(t)}
              {opts?.aperture ? ` · ${formatAperture(opts.aperture)}` : ''}
              {opts?.filter ? ' + filter' : ''}
            </button>
          ))}
        </div>
        <Choice
          label="Lens aperture"
          options={IPHONE_APERTURES.map((a) => ({ value: a, label: formatAperture(a) }))}
          value={aperture}
          onChange={setAperture}
          small
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Toggle label="On a tripod" checked={tripod} onChange={setTripod} />
          <Toggle label="Dark (ND) filter on the lens" checked={nd} onChange={setNd} />
        </div>
        <Readout items={[{ label: 'ISO (auto)', value: formatIso(e.iso), warn: e.iso >= 1600 }]} />
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
