'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { park, waterfall } from '../lab/scenes'
import { FRIEND, cyclist, person, place, scaleAt } from '../lab/paint'
import type { Scene } from '../lab/darkroom'
import { Choice, Demo, Range } from '../ui'

const W = 640
const H = 480
const FPS = 15
const FRAMES = 45 // a Live Photo is about 1.5 s either side of the shutter
const PRESS = 22

type Clip = 'jump' | 'waterfall'
type Effect = 'live' | 'loop' | 'bounce' | 'long'

// A clip is a still background, a still foreground, and the moving things
// drawn in between for each frame.
type Film = { back: HTMLCanvasElement; front: HTMLCanvasElement; frame: (ctx: CanvasRenderingContext2D, t: number) => void }

function layersTo(scene: Scene, keep: (id: string) => boolean) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.scale(W / 100, W / 100)
  for (const l of scene.layers) if (keep(l.id)) l.paint(ctx)
  return c
}

function makeFilm(clip: Clip): Film {
  if (clip === 'jump') {
    const scene = park()
    const at = scene.layers.findIndex((l) => l.id === 'cyclist')
    const ids = scene.layers.map((l) => l.id)
    const friendX = (31 - 50) / scaleAt(3.2)
    return {
      back: layersTo(scene, (id) => ids.indexOf(id) < at),
      front: layersTo(scene, (id) => id === 'branch'),
      frame: (ctx, t) => {
        place(ctx, -6 + 3.66 * t, 8, () => cyclist(ctx))
        const jump = t > 1.25 && t < 2.05 ? 0.55 * Math.sin((Math.PI * (t - 1.25)) / 0.8) : 0
        place(ctx, friendX, 3.2, () => person(ctx, { ...FRIEND, wave: jump > 0.05 }), {}, jump)
      },
    }
  }
  const scene = waterfall()
  const streaks = scene.layers.find((l) => l.id === 'streaks')!
  const at = scene.layers.findIndex((l) => l.id === 'streaks')
  const ids = scene.layers.map((l) => l.id)
  const s = scaleAt(10.7)
  const height = 5.4 * s
  const bottom = 30 + 1.5 * s
  const x = 50 + 1.2 * s
  return {
    back: layersTo(scene, (id) => ids.indexOf(id) < at),
    front: layersTo(scene, (id) => ids.indexOf(id) > at),
    frame: (ctx, t) => {
      // The water falls 85 frame-units a second; wrap it round the fall.
      const dy = (t * 85) % height
      ctx.save()
      ctx.beginPath()
      ctx.rect(x - 14, bottom - height - 1, 28, height + 2)
      ctx.clip()
      for (const off of [dy, dy - height]) {
        ctx.save()
        ctx.translate(0, off)
        streaks.paint(ctx)
        ctx.restore()
      }
      ctx.restore()
    },
  }
}

function draw(ctx: CanvasRenderingContext2D, film: Film, frame: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(film.back, 0, 0)
  ctx.save()
  ctx.scale(W / 100, W / 100)
  film.frame(ctx, frame / FPS)
  ctx.restore()
  ctx.drawImage(film.front, 0, 0)
}

// Long Exposure: every frame averaged into one.
function longExposure(film: Film) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const sum = new Float32Array(W * H * 3)
  for (let f = 0; f < FRAMES; f++) {
    draw(ctx, film, f)
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
  const [clip, setClip] = useState<Clip>('jump')
  const [effect, setEffect] = useState<Effect>('live')
  const [key, setKey] = useState(PRESS)
  const [playing, setPlaying] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [film, setFilm] = useState<Film | null>(null)
  const long = useRef<{ clip: Clip; image: ImageData } | null>(null)

  useEffect(() => {
    setFilm(makeFilm(clip))
    setKey(PRESS)
  }, [clip])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !film) return
    if (effect === 'long') {
      if (long.current?.clip !== clip) long.current = { clip, image: longExposure(film) }
      ctx.putImageData(long.current.image, 0, 0)
      return
    }
    const looping = effect === 'loop' || effect === 'bounce'
    if (!playing && !looping) {
      draw(ctx, film, key)
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
      draw(ctx, film, f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [film, effect, key, playing, clip])

  const hint = useMemo(() => {
    if (effect === 'long') return clip === 'waterfall' ? 'Every frame blended into one: silky water, no tripod or filter needed.' : 'Every frame blended into one: the cyclist is a streak and your friend a ghost.'
    if (effect === 'loop') return 'Loop plays the clip round and round, smoothing over the join.'
    if (effect === 'bounce') return 'Bounce plays it forwards, then backwards.'
    return 'Press and hold the photo to play it, like in Photos. Drag the slider to choose a better key photo.'
  }, [effect, clip])

  return (
    <Demo title="Live Photos">
      <div className="mb-3">
        <Choice
          options={[
            { value: 'jump', label: 'A jump in the park' },
            { value: 'waterfall', label: 'A waterfall' },
          ]}
          value={clip}
          onChange={setClip}
          small
        />
      </div>
      <div className="relative overflow-hidden rounded-lg bg-neutral-900">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="block h-auto w-full touch-none select-none"
          onPointerDown={() => effect === 'live' && setPlaying(true)}
          onContextMenu={(e) => e.preventDefault()}
          role="img"
          aria-label="Live Photo"
        />
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
