'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { park } from '../lab/scenes'
import { Choice, Demo, Toggle } from '../ui'

const LENSES = [
  { zoom: 0.5, mm: 13, name: 'Ultra Wide' },
  { zoom: 1, mm: 24, name: 'Main' },
  { zoom: 2, mm: 48, name: 'Main, cropped' },
  { zoom: 4, mm: 100, name: 'Telephoto' },
  { zoom: 8, mm: 200, name: 'Telephoto, cropped' },
]

const FRIEND = 3.2

export function ZoomDemo() {
  const [zoom, setZoom] = useState(1)
  const [walk, setWalk] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  // Walking back (or forward) so your friend stays the same size.
  const back = walk ? FRIEND * (zoom - 1) : 0
  // The camera is held level and pointed at your friend, so zooming
  // closes in on them.
  const scene = useMemo(() => park({ rig: { zoom, back, horizon: 37.5 }, friendX: 50, cyclist: false, branch: back === 0 }), [zoom, back])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const w = 960
    c.width = w
    c.height = w * 0.75
    const ctx = c.getContext('2d')!
    ctx.setTransform(w / 100, 0, 0, w / 100, 0, 0)
    ctx.clearRect(0, 0, 100, 75)
    for (const l of scene.layers) l.paint(ctx)
  }, [scene])

  const lens = LENSES.find((l) => l.zoom === zoom)!
  return (
    <Demo title="Lenses and zoom">
      <canvas ref={canvas} className="block h-auto w-full rounded-lg bg-neutral-900" role="img" aria-label={`The park at ${zoom}×`} />
      <div className="mt-3 space-y-3">
        <Choice options={LENSES.map((l) => ({ value: l.zoom, label: `${l.zoom === 0.5 ? '.5' : l.zoom}×` }))} value={zoom} onChange={setZoom} />
        <Toggle label="Walk so your friend stays the same size" checked={walk} onChange={setWalk} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <b>
            {lens.zoom}× · {lens.mm} mm · {lens.name}.
          </b>{' '}
          {walk
            ? `You're ${(FRIEND + back).toFixed(1)} m from your friend. The trees seem to ${zoom > 1 ? 'loom closer and bigger behind them' : 'shrink away into the distance'}. That is perspective: it comes from where you stand, and the lens only crops it.`
            : 'Standing still, a longer lens just crops in. Use 2× or 4× for faces (no big nose), .5× for rooms and big landscapes.'}
        </p>
      </div>
    </Demo>
  )
}
