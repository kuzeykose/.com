'use client'

import { useMemo, useState } from 'react'
import { Viewfinder, type Overlay } from '../lab/viewfinder'
import { night, park } from '../lab/scenes'
import { autoExpose } from '../lab/optics'
import type { Develop } from '../lab/darkroom'
import { Choice, Demo, Histogram, Toggle } from '../ui'

type Example = 'good' | 'dark' | 'bright' | 'night' | 'snow'

const EXAMPLES: Record<Example, { label: string; build: () => ReturnType<typeof park>; stops: number; focus: number; read: string }> = {
  good: {
    label: 'Well exposed',
    build: () => park(),
    stops: 0,
    focus: 3.2,
    read: 'A hill spread across the whole width, touching neither wall. Tones from shadow to highlight, nothing lost.',
  },
  dark: {
    label: 'Too dark',
    build: () => park(),
    stops: -2,
    focus: 3.2,
    read: 'Everything is piled up on the left and the right half is empty. Shadows are crushed to black and nothing reaches white.',
  },
  bright: {
    label: 'Too bright',
    build: () => park(),
    stops: 1.7,
    focus: 3.2,
    read: 'A cliff against the right wall: a big share of the picture is pure white. The sky and the striped shirt have lost their detail for good.',
  },
  night: {
    label: 'Dark on purpose',
    build: () => night(),
    stops: 0,
    focus: 2.6,
    read: 'Mostly on the left, and that is correct: it is night. A few spikes on the right are the lamps. Only the lamps should clip.',
  },
  snow: {
    label: 'Bright on purpose',
    build: () => park({ winter: true }),
    stops: 0,
    focus: 3.2,
    read: 'Leaning right, because the scene is mostly white snow, but not stacked against the wall. Bright, with detail kept.',
  },
}

export function HistogramDemo() {
  const [ex, setEx] = useState<Example>('good')
  const [range, setRange] = useState<[number, number] | null>(null)
  const [clipping, setClipping] = useState(false)
  const [dev, setDev] = useState<Develop | null>(null)
  const cfg = EXAMPLES[ex]
  const scene = useMemo(() => cfg.build(), [ex])
  const e = autoExpose(scene.ev + -cfg.stops, { aperture: 1.8 })
  const shot = useMemo(() => ({ ...e, focus: cfg.focus, wb: scene.kelvin, noise: false }), [e.shutter, e.iso, scene])

  const overlay = useMemo<Overlay | undefined>(() => {
    if (!range && !clipping) return undefined
    return {
      paint: (img) => {
        const p = img.data
        for (let i = 0; i < p.length; i += 4) {
          const y = (54 * p[i] + 183 * p[i + 1] + 19 * p[i + 2]) >> 8
          if (range && y >= range[0] && y <= range[1]) {
            p[i] = 255
            p[i + 1] = 110 + (p[i + 1] >> 3)
            p[i + 2] = 20
          } else if (clipping && (p[i] >= 254 || p[i + 1] >= 254 || p[i + 2] >= 254)) {
            p[i] = 239
            p[i + 1] = 40
            p[i + 2] = 40
          } else if (clipping && y <= 3) {
            p[i] = 40
            p[i + 1] = 110
            p[i + 2] = 245
          } else if (range) {
            // Dim everything outside the chosen tones.
            p[i] = p[i] * 0.35
            p[i + 1] = p[i + 1] * 0.35
            p[i + 2] = p[i + 2] * 0.35
          }
        }
      },
    }
  }, [range, clipping])

  return (
    <Demo title="Reading a histogram">
      <div className="mb-3">
        <Choice
          options={(Object.keys(EXAMPLES) as Example[]).map((k) => ({ value: k, label: EXAMPLES[k].label }))}
          value={ex}
          onChange={setEx}
          small
        />
      </div>
      <Viewfinder scene={scene} shot={shot} overlay={overlay} onDevelop={setDev} label={cfg.label} />
      <div className="mt-3">
        <Histogram data={dev?.histogram ?? null} height={90} onHover={setRange} selected={range} />
        <p className="mt-1 text-xs text-neutral-500">Drag across the histogram to light up the pixels it is counting.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Toggle label="Show clipping (red: pure white, blue: pure black)" checked={clipping} onChange={setClipping} />
        {dev && (
          <span className="font-mono text-xs text-neutral-500">
            {(dev.clipped * 100).toFixed(1)}% white · {(dev.crushed * 100).toFixed(1)}% black
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{cfg.read}</p>
    </Demo>
  )
}
