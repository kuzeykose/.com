'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { CAFE_CLOSE } from '../lab/photos'
import { IPHONE_APERTURES, autoExpose, formatAperture, formatIso, formatShutter } from '../lab/optics'
import { Choice, Demo, Readout, Toggle } from '../ui'
import { useLoupe } from './iso'

// Six blades, like the iPhone 18 Pro's, closing around the opening.
export function Blades({ aperture, size = 120 }: { aperture: number; size?: number }) {
  // Opening radius relative to the lens: ƒ/1.48 is wide open.
  const open = 0.86 * (1.48 / aperture)
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2
    const r = open * 50
    // Each blade is a big sheet whose inner edge is one side of the hexagon.
    const x1 = 50 + Math.cos(a) * r
    const y1 = 50 + Math.sin(a) * r
    const x2 = 50 + Math.cos(a + Math.PI / 3) * r
    const y2 = 50 + Math.sin(a + Math.PI / 3) * r
    const dx = Math.cos(a + Math.PI / 6) * 80
    const dy = Math.sin(a + Math.PI / 6) * 80
    const ex = (x2 - x1) * 1.1
    const ey = (y2 - y1) * 1.1
    // Rounded, so the server and the browser write the same path.
    const p = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`
    return `M${p(x1 - ex * 0.3, y1 - ey * 0.3)} L${p(x2 + ex, y2 + ey)} L${p(x2 + ex + dx, y2 + ey + dy)} L${p(x1 + dx, y1 + dy)} Z`
  })
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Aperture at ${formatAperture(aperture)}`}>
      <defs>
        <clipPath id="lens-clip">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill="#1c1c1e" />
      <circle cx="50" cy="50" r="46" fill="#7dd3fc" />
      <g clipPath="url(#lens-clip)">
        {blades.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? '#3a3a3c' : '#2c2c2e'} stroke="#111" strokeWidth={0.6} className="transition-all duration-300" />
        ))}
      </g>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#000" strokeWidth={1.5} />
    </svg>
  )
}

export function ApertureDemo() {
  const [aperture, setAperture] = useState(1.48)
  const [compensate, setCompensate] = useState(true)
  const scene = usePhoto(CAFE_CLOSE)
  const ev = CAFE_CLOSE.ev
  // With compensation on, the iPhone rebalances shutter and ISO; off, they
  // stay where they were at ƒ/1.48.
  const base = autoExpose(ev, { aperture: 1.48 })
  const e = compensate ? autoExpose(ev, { aperture }) : { ...base, aperture }
  const shot = useMemo(() => ({ ...e, focus: 0.36, wb: CAFE_CLOSE.kelvin }), [e.aperture, e.shutter, e.iso])
  const light = (aperture / 1.48) ** 2
  // A close look at the street behind, where the blur shows most.
  const [loupe, onDevelop] = useLoupe(0.34, 0.15, 60, 3)

  return (
    <Demo title="Lens aperture">
      <Viewfinder scene={scene} shot={shot} onDevelop={onDevelop} label="A cappuccino on a café table, close up">
        <div className="pointer-events-none absolute border border-white/80" style={{ left: '27.75%', top: '8.75%', width: '12.5%', height: '12.5%' }} />
      </Viewfinder>
      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <Blades aperture={aperture} size={92} />
          <p className="w-24 text-center text-xs text-neutral-600 dark:text-neutral-400">
            {aperture === 1.48 ? 'Wide open: the most light' : `${light.toFixed(1)}× less light than ƒ/1.48`}
          </p>
        </div>
        <div>
          <canvas ref={loupe} className="block h-auto w-full rounded-lg bg-neutral-900" aria-label="Close-up of the street behind" />
          <p className="mt-1 text-xs text-neutral-500">The railings behind the table, 3× closer (the white box).</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Choice
          label="Lens aperture"
          options={IPHONE_APERTURES.map((a) => ({ value: a, label: formatAperture(a) }))}
          value={aperture}
          onChange={setAperture}
        />
        <Toggle label="Let the iPhone keep the brightness the same" checked={compensate} onChange={setCompensate} />
        <Readout
          items={[
            { label: 'shutter', value: formatShutter(e.shutter) },
            { label: 'ISO', value: formatIso(e.iso) },
          ]}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Focus is on the cup, about a third of a metre away. Watch the street behind it in the close-up: wide
          open the railings melt into a soft blur; at ƒ/4 they come back.
          {compensate ? ' The iPhone slows the shutter or raises ISO to make up for the smaller hole.' : ' With nothing making up for it, the picture just gets darker.'}
        </p>
      </div>
    </Demo>
  )
}
