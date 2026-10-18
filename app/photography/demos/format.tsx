'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { park } from '../lab/scenes'
import { autoExpose, formatEv } from '../lab/optics'
import { eightBit, type Darkroom, type Shot } from '../lab/darkroom'
import { Choice, Demo, Range } from '../ui'

const SIZES = [
  { mp: 12, width: 4032 },
  { mp: 24, width: 5712 },
  { mp: 48, width: 8064 },
]

// The part of the frame we zoom into: the cyclist's front wheel, 8 m away.
const CROP = { x: 56.4, y: 38.3, w: 2.6 }

export function MegapixelDemo() {
  const [mp, setMp] = useState(24)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useMemo(() => park(), [])

  useEffect(() => {
    const out = canvas.current
    if (!out) return
    const width = SIZES.find((s) => s.mp === mp)!.width
    // Draw only the pixels the sensor would have had across the crop…
    const px = Math.round((width * CROP.w) / 100)
    const small = document.createElement('canvas')
    small.width = px
    small.height = Math.round(px * 0.75)
    const ctx = small.getContext('2d')!
    ctx.scale(px / CROP.w, px / CROP.w)
    ctx.translate(-CROP.x, -CROP.y)
    for (const l of scene.layers) l.paint(ctx)
    // …then blow them up so every pixel shows as a little square.
    out.width = 960
    out.height = 720
    const o = out.getContext('2d')!
    o.imageSmoothingEnabled = false
    o.drawImage(small, 0, 0, out.width, out.height)
  }, [mp, scene])

  return (
    <Demo title="Megapixels">
      <canvas
        ref={canvas}
        className="block h-auto w-full rounded-lg bg-neutral-900"
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-label={`Zoomed into the cyclist at ${mp} megapixels`}
      />
      <div className="mt-3 space-y-2">
        <Choice options={SIZES.map((s) => ({ value: s.mp, label: `${s.mp} MP` }))} value={mp} onChange={setMp} small />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Zoomed right into the cyclist's front wheel, a sliver under 3% as wide as the whole photo; each little square
          is one pixel. At {mp} MP that sliver is{' '}
          {Math.round((SIZES.find((s) => s.mp === mp)!.width * CROP.w) / 100)} pixels across. More megapixels means you can crop in
          later and keep detail. It costs storage, and in dim light the extra pixels mostly add noise.
        </p>
      </div>
    </Demo>
  )
}

type Case = 'bright' | 'dark'

export function RawDemo() {
  const [fmt, setFmt] = useState<'heif' | 'raw'>('heif')
  const [which, setWhich] = useState<Case>('bright')
  const [edit, setEdit] = useState(0)
  const scene = useMemo(() => park(), [])
  // Shot badly on purpose: two stops too bright, or three too dark.
  const miss = which === 'bright' ? 1.7 : -3
  const e = autoExpose(scene.ev - miss, { aperture: 1.8 })
  const shot = useMemo(() => ({ ...e, focus: 3.2, wb: scene.kelvin }), [which, scene])
  const develop = useMemo(
    () => (room: Darkroom, s: Shot) => {
      const light = room.expose(s)
      const gain = Math.pow(2, edit)
      if (fmt === 'heif') return room.finish(eightBit(light), null, gain)
      // The sensor itself still saturates, about two stops above white.
      for (let i = 0; i < light.length; i++) if (light[i] > 4) light[i] = 4
      return room.finish(light, null, gain)
    },
    [fmt, edit]
  )

  return (
    <Demo title="HEIF versus ProRAW">
      <div className="mb-3">
        <Choice
          options={[
            { value: 'bright', label: 'Shot too bright' },
            { value: 'dark', label: 'Shot too dark' },
          ]}
          value={which}
          onChange={(v) => {
            setWhich(v)
            setEdit(0)
          }}
          small
        />
      </div>
      <Viewfinder scene={scene} shot={shot} develop={develop} label="The photo after editing">
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {fmt === 'raw' ? 'ProRAW · 12-bit' : 'HEIF · 8-bit'}
        </div>
      </Viewfinder>
      <div className="mt-3 space-y-3">
        <Choice
          label="File it was saved as"
          options={[
            { value: 'heif', label: 'HEIF' },
            { value: 'raw', label: 'ProRAW' },
          ]}
          value={fmt}
          onChange={setFmt}
          small
        />
        <Range label="Exposure, in the Photos editor" min={-3} max={3.5} step={1 / 3} value={edit} onChange={setEdit} format={formatEv} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {which === 'bright'
            ? 'Drag the exposure down. The HEIF sky turns a flat grey: those pixels were saved as pure white, and there is nothing left to bring back. The ProRAW file kept the brighter values, so clouds return.'
            : 'Drag the exposure up. Both get grainy, because the light was never caught. But the HEIF shadows were rounded to a few steps, so they come back blotchy, while the ProRAW file keeps smooth gradations.'}
        </p>
      </div>
    </Demo>
  )
}
