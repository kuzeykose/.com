'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { photoAssets } from '../lab/photo'
import { CYCLIST, WATERFALL } from '../lab/photos'
import { Choice, Demo, Range } from '../ui'

const W = 640
const H = 480
const FPS = 15
const FRAMES = 45 // a Live Photo is about 1.5 s either side of the shutter
const PRESS = 22

type Clip = 'cyclist' | 'waterfall'
type Effect = 'live' | 'loop' | 'bounce' | 'long'

// A clip is a still background with one moving cut-out drawn over it.
type Film = (ctx: CanvasRenderingContext2D, t: number) => void

function canvas(data?: Uint8ClampedArray) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  if (data) c.getContext('2d')!.putImageData(new ImageData(data, W, H), 0, 0)
  return c
}

// The photo's pixels, with alpha from a mask.
function cutout(photo: Uint8ClampedArray, mask: Uint8Array) {
  const px = new Uint8ClampedArray(photo)
  for (let i = 0; i < mask.length; i++) px[i * 4 + 3] = mask[i]
  return canvas(px)
}

async function makeFilm(clip: Clip): Promise<Film> {
  if (clip === 'cyclist') {
    const a = await photoAssets(CYCLIST)
    const back = canvas(a.plate)
    const rider = cutout(a.photo, a.masks.rider)
    // He rides left at about a third of the frame a second.
    return (ctx, t) => {
      ctx.drawImage(back, 0, 0)
      ctx.drawImage(rider, (1.5 - t) * 0.32 * W, 0)
    }
  }
  const a = await photoAssets(WATERFALL)
  const back = canvas(a.photo)
  const water = cutout(a.photo, a.masks.water)
  const layer = canvas()
  const lctx = layer.getContext('2d')!
  const period = 150
  return (ctx, t) => {
    ctx.drawImage(back, 0, 0)
    // Slide the falling water downwards, wrapping round, and keep it inside the falls.
    const dy = (t * 0.55 * W) % period
    lctx.globalCompositeOperation = 'source-over'
    lctx.clearRect(0, 0, W, H)
    lctx.drawImage(water, 0, dy)
    lctx.drawImage(water, 0, dy - period)
    lctx.globalCompositeOperation = 'destination-in'
    lctx.drawImage(water, 0, 0)
    ctx.drawImage(layer, 0, 0)
  }
}

// Long Exposure: every frame averaged into one.
function longExposure(film: Film) {
  const c = canvas()
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const sum = new Float32Array(W * H * 3)
  for (let f = 0; f < FRAMES; f++) {
    film(ctx, f / FPS)
    const d = ctx.getImageData(0, 0, W, H).data
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      sum[j] += d[i]
      sum[j + 1] += d[i + 1]
      sum[j + 2] += d[i + 2]
    }
  }
  const out = ctx.createImageData(W, H)
  for (let i = 0, j = 0; i < out.data.length; i += 4, j += 3) {
    out.data[i] = sum[j] / FRAMES
    out.data[i + 1] = sum[j + 1] / FRAMES
    out.data[i + 2] = sum[j + 2] / FRAMES
    out.data[i + 3] = 255
  }
  return out
}

export function LiveDemo() {
  const [clip, setClip] = useState<Clip>('cyclist')
  const [effect, setEffect] = useState<Effect>('live')
  const [key, setKey] = useState(PRESS)
  const [playing, setPlaying] = useState(false)
  const ref = useRef<HTMLCanvasElement>(null)
  const [film, setFilm] = useState<{ clip: Clip; draw: Film } | null>(null)
  const long = useRef<{ clip: Clip; image: ImageData } | null>(null)

  useEffect(() => {
    let live = true
    setKey(PRESS)
    makeFilm(clip).then((draw) => live && setFilm({ clip, draw }))
    return () => {
      live = false
    }
  }, [clip])

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || !film || film.clip !== clip) return
    if (effect === 'long') {
      if (long.current?.clip !== clip) long.current = { clip, image: longExposure(film.draw) }
      ctx.putImageData(long.current.image, 0, 0)
      return
    }
    const looping = effect === 'loop' || effect === 'bounce'
    if (!playing && !looping) {
      film.draw(ctx, key / FPS)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const n = Math.floor(((now - start) / 1000) * FPS)
      let f: number
      if (effect === 'bounce') {
        const p = n % (FRAMES * 2 - 2)
        f = p < FRAMES ? p : FRAMES * 2 - 2 - p
      } else if (effect === 'loop') f = n % FRAMES
      else {
        f = n
        if (f >= FRAMES) {
          setPlaying(false)
          return
        }
      }
      film.draw(ctx, f / FPS)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [film, effect, key, playing, clip])

  const hint = useMemo(() => {
    if (effect === 'long') return clip === 'waterfall' ? 'Every frame blended into one: silky water, no tripod or filter needed.' : 'Every frame blended into one: the cyclist becomes a ghostly streak across a sharp road.'
    if (effect === 'loop') return 'Loop plays the clip round and round, smoothing over the join.'
    if (effect === 'bounce') return 'Bounce plays it forwards, then backwards.'
    return 'Press and hold the photo to play it, like in Photos. Drag the slider to choose a better key photo.'
  }, [effect, clip])

  return (
    <Demo title="Live Photos">
      <div className="mb-3">
        <Choice
          options={[
            { value: 'cyclist', label: 'A cyclist passing' },
            { value: 'waterfall', label: 'A waterfall' },
          ]}
          value={clip}
          onChange={setClip}
          small
        />
      </div>
      <div className="relative overflow-hidden rounded-lg bg-neutral-900">
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="block h-auto w-full touch-none select-none"
          onPointerDown={() => effect === 'live' && setPlaying(true)}
          onContextMenu={(e) => e.preventDefault()}
          role="img"
          aria-label="Live Photo"
        />
        {!film && <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">Developing the photo…</div>}
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-white uppercase">
          {effect === 'long' ? 'Long exposure' : effect === 'loop' ? 'Loop' : effect === 'bounce' ? 'Bounce' : playing ? '● Live' : 'Live'}
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <Choice
          label="Effect"
          options={[
            { value: 'live', label: 'Live' },
            { value: 'loop', label: 'Loop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'long', label: 'Long Exposure' },
          ]}
          value={effect}
          onChange={(v) => {
            setEffect(v)
            setPlaying(false)
          }}
          small
        />
        <div className={effect === 'live' ? '' : 'pointer-events-none opacity-40'}>
          <Range
            label="Key photo"
            min={0}
            max={FRAMES - 1}
            step={1}
            value={key}
            onChange={(k) => {
              setKey(k)
              setPlaying(false)
            }}
            format={(k) => (k === PRESS ? 'when you pressed' : `${k < PRESS ? '−' : '+'}${(Math.abs(k - PRESS) / FPS).toFixed(1)}s`)}
          />
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</p>
      </div>
    </Demo>
  )
}
