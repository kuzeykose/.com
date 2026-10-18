'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { useImage, usePhoto } from '../lab/photo'
import { LAKE } from '../lab/photos'
import { autoExpose, formatEv } from '../lab/optics'
import { eightBit, type Darkroom, type Shot } from '../lab/darkroom'
import { Choice, Demo, Range } from '../ui'

const SIZES = [
  { mp: 12, width: 4032 },
  { mp: 24, width: 5712 },
  { mp: 48, width: 8064 },
]

// The part of the frame we zoom into: a peak on the right, a tenth of the width.
const CROP = { x: 0.555, y: 0.24, w: 0.1 }

export function MegapixelDemo() {
  const [mp, setMp] = useState(24)
  const canvas = useRef<HTMLCanvasElement>(null)
  const photo = useImage('/photography/lake/photo.jpg')

  useEffect(() => {
    const out = canvas.current
    if (!out || !photo) return
    // 48 MP gets every pixel this photo has in the crop; the others get
    // fewer, in proportion to how many pixels they have across.
    const full = CROP.w * photo.naturalWidth
    const px = Math.round((full * SIZES.find((s) => s.mp === mp)!.width) / 8064)
    const small = document.createElement('canvas')
    small.width = px
    small.height = Math.round(px * 0.75)
    const ctx = small.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photo, CROP.x * photo.naturalWidth, CROP.y * photo.naturalHeight, full, full * 0.75, 0, 0, small.width, small.height)
    // …then blow them up so every pixel shows as a little square.
    out.width = 960
    out.height = 720
    const o = out.getContext('2d')!
    o.imageSmoothingEnabled = false
    o.drawImage(small, 0, 0, out.width, out.height)
  }, [mp, photo])

  return (
    <Demo title="Megapixels">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <canvas
          ref={canvas}
          className="block h-auto w-full rounded-lg bg-neutral-900"
          style={{ imageRendering: 'pixelated' }}
          role="img"
          aria-label={`Zoomed into the mountains at ${mp} megapixels`}
        />
        {photo && (
          <div className="relative self-start overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt="" className="block h-auto w-full" />
            <div
              className="absolute border-2 border-amber-300"
              style={{ left: `${CROP.x * 100}%`, top: `${CROP.y * 100}%`, width: `${CROP.w * 100}%`, height: `${CROP.w * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <Choice options={SIZES.map((s) => ({ value: s.mp, label: `${s.mp} MP` }))} value={mp} onChange={setMp} small />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Zoomed into the yellow box, a tenth of the photo's width; each little square is one pixel. A {mp} MP photo is{' '}
          {SIZES.find((s) => s.mp === mp)!.width.toLocaleString('en')} pixels across, so 48 MP has twice as many squares across as
          12 MP. More megapixels means you can crop in later and keep detail. It costs storage, and in dim light the extra pixels
          mostly add noise.
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
  const scene = usePhoto(LAKE)
  // Shot badly on purpose: nearly two stops too bright, or three too dark.
  const miss = which === 'bright' ? 1.7 : -3
  const e = autoExpose(LAKE.ev - miss, { aperture: 1.8 })
  const shot = useMemo(() => ({ ...e, focus: 100, wb: LAKE.kelvin }), [which])
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
            ? 'Drag the exposure down. The HEIF sky and snow turn a flat grey: those pixels were saved as pure white, and there is nothing left to bring back. The ProRAW file kept the brighter values, so the clouds and the snow return.'
            : 'Drag the exposure up. Both get grainy, because the light was never caught. But the HEIF shadows were rounded to a few steps, so they come back blotchy, while the ProRAW file keeps smooth gradations.'}
        </p>
      </div>
    </Demo>
  )
}
