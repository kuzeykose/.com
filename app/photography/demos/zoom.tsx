'use client'

import { useState } from 'react'
import { useImage } from '../lab/photo'
import { Choice, Demo } from '../ui'

const LENSES = [
  { zoom: 0.5, mm: 13, name: 'Ultra Wide' },
  { zoom: 1, mm: 24, name: 'Main' },
  { zoom: 2, mm: 48, name: 'Main, cropped' },
  { zoom: 4, mm: 100, name: 'Telephoto' },
  { zoom: 8, mm: 200, name: 'Telephoto, cropped' },
]

// Where the lenses point in this photo: the mountain peak right of centre.
const AIM = { x: 0.6, y: 0.33 }

export function ZoomDemo() {
  const [zoom, setZoom] = useState(1)
  const photo = useImage('/photography/lake/photo.jpg')
  const lens = LENSES.find((l) => l.zoom === zoom)!
  // Treat the whole photo as the .5× view; each step in zoom halves the width.
  const frame = (z: number) => {
    const w = 0.5 / z
    return {
      left: Math.min(1 - w, Math.max(0, AIM.x - w / 2)) * 100,
      top: Math.min(1 - w, Math.max(0, AIM.y - w / 2)) * 100,
      width: w * 100,
      height: w * 100,
    }
  }
  const f = frame(zoom)
  return (
    <Demo title="Lenses and zoom">
      <div className="relative overflow-hidden rounded-lg bg-neutral-900">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.src} alt="A mountain lake, as the .5× lens sees it" className="block h-auto w-full" />
        )}
        {!photo && <div className="aspect-[4/3]" />}
        {LENSES.filter((l) => l.zoom > 0.5).map((l) => {
          const r = frame(l.zoom)
          return (
            <div
              key={l.zoom}
              className={`pointer-events-none absolute border ${l.zoom === zoom ? 'border-2 border-amber-300' : 'border-white/60'}`}
              style={{ left: `${r.left}%`, top: `${r.top}%`, width: `${r.width}%`, height: `${r.height}%` }}
            >
              <span className="absolute -top-0.5 left-0.5 font-mono text-[10px] text-white drop-shadow">{l.zoom}×</span>
            </div>
          )
        })}
        {zoom > 0.5 && (
          <div
            className="pointer-events-none absolute transition-all duration-300"
            style={{ left: `${f.left}%`, top: `${f.top}%`, width: `${f.width}%`, height: `${f.height}%`, boxShadow: '0 0 0 999px rgba(0,0,0,0.55)' }}
          />
        )}
      </div>
      <div className="mt-3 space-y-3">
        <Choice options={LENSES.map((l) => ({ value: l.zoom, label: `${l.zoom === 0.5 ? '.5' : l.zoom}×` }))} value={zoom} onChange={setZoom} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <b>
            {lens.zoom}× · {lens.mm} mm · {lens.name}.
          </b>{' '}
          Standing in one spot, each step up the lenses keeps half the width of the one before. The whole photo is what .5× sees;
          8× reaches the little box on the peak. Use 2× or 4× for faces (no big nose) and .5× for rooms and big landscapes.
        </p>
      </div>
    </Demo>
  )
}
