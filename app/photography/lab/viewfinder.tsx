'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Darkroom, type Develop, type Scene, type Shot } from './darkroom'

export type Overlay = {
  grid?: boolean
  peaking?: boolean
  // Paints over the developed picture (e.g. highlight a range of tones).
  paint?: (image: ImageData) => void
}

type Props = {
  scene: Scene
  shot: Shot
  overlay?: Overlay
  onDevelop?: (d: Develop) => void
  onTap?: (hit: { x: number; y: number; depth: number; label?: string }) => void
  // Called with the darkroom so a demo can do its own developing.
  develop?: (room: Darkroom, shot: Shot) => Develop
  label?: string
  children?: ReactNode
  className?: string
}

const WIDTH = 640

// A canvas that renders a scene through the darkroom whenever the shot
// changes, and only while it's on screen.
export function Viewfinder({ scene, shot, overlay, onDevelop, onTap, develop, label, children, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const room = useRef<Darkroom | null>(null)
  const [visible, setVisible] = useState(false)
  const latest = useRef({ scene, shot, overlay, onDevelop, develop })
  latest.current = { scene, shot, overlay, onDevelop, develop }
  const frame = useRef(0)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) {
      room.current?.sleep()
      return
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const el = canvas.current
      if (!el) return
      const { scene, shot, overlay, onDevelop, develop } = latest.current
      if (!room.current) room.current = new Darkroom(WIDTH)
      const r = room.current
      r.setScene(scene)
      const d = develop ? develop(r, shot) : r.develop(shot)
      if (overlay?.peaking) peak(d.image)
      overlay?.paint?.(d.image)
      el.width = r.w
      el.height = r.h
      el.getContext('2d')!.putImageData(d.image, 0, 0)
      onDevelop?.(d)
    })
    return () => cancelAnimationFrame(frame.current)
  }, [visible, scene, shot, overlay, develop])

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onTap || !room.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const hit = room.current.pick(x, y)
    if (hit) onTap({ x, y, ...hit })
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-neutral-900 ${className ?? ''}`}>
      <canvas
        ref={canvas}
        width={WIDTH}
        height={(WIDTH * 3) / 4}
        onPointerDown={tap}
        aria-label={label}
        role="img"
        className={`block h-auto w-full ${onTap ? 'cursor-crosshair' : ''}`}
      />
      {overlay?.grid && <Grid />}
      {children}
    </div>
  )
}

export function Grid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/45" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/45" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/45" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/45" />
    </div>
  )
}

// Focus peaking: outline the edges that are sharp.
function peak(image: ImageData) {
  const { width: w, height: h, data } = image
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  const hits: number[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      // A sharp edge changes a lot from one pixel to the next; a soft one
      // spreads the same change over many.
      const g = Math.max(Math.abs(lum[i + 1] - lum[i - 1]), Math.abs(lum[i + w] - lum[i - w]))
      if (g > 40) hits.push(i)
    }
  }
  for (const i of hits) {
    data[i * 4] = 255
    data[i * 4 + 1] = 214
    data[i * 4 + 2] = 10
  }
}
