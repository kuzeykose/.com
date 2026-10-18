'use client'

import { useEffect, useRef, useState } from 'react'
import { useImage } from '../lab/photo'
import { Demo, Range, Toggle } from '../ui'

// Where things are in the photo, as fractions of its width and height.
const LIGHTHOUSE = { x: 0.735, y: 0.43 }
const HORIZON = 0.447
// The crop is 4:3 and 60% of the photo's width.
const CW = 0.6

const near = (v: number, target: number, tol: number) => Math.abs(v - target) < tol

export function CompositionDemo() {
  const photo = useImage('/photography/lighthouse/photo.jpg')
  const canvas = useRef<HTMLCanvasElement>(null)
  // The crop's centre, as fractions of the photo.
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 })
  const [tilt, setTilt] = useState(3)
  const [grid, setGrid] = useState(true)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  const aspect = photo ? photo.naturalWidth / photo.naturalHeight : 1.5
  const ch = (CW * aspect * 3) / 4 // crop height as a fraction of the photo's height

  useEffect(() => {
    const c = canvas.current
    if (!c || !photo) return
    const W = photo.naturalWidth
    const H = photo.naturalHeight
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    const px = centre.x * W
    const py = centre.y * H
    // Tilt the world about the middle of the crop, not the frame.
    ctx.save()
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, W, H)
    ctx.translate(px, py)
    ctx.rotate((tilt * Math.PI) / 180)
    ctx.translate(-px, -py)
    ctx.drawImage(photo, 0, 0)
    ctx.restore()
    // Dim everything outside the crop.
    const x0 = px - (CW * W) / 2
    const y0 = py - (ch * H) / 2
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.rect(x0, y0, CW * W, ch * H)
    ctx.fill('evenodd')
    ctx.strokeStyle = '#fcd34d'
    ctx.lineWidth = 3
    ctx.strokeRect(x0, y0, CW * W, ch * H)
    if (grid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      for (const k of [1, 2]) {
        ctx.beginPath()
        ctx.moveTo(x0 + (k * CW * W) / 3, y0)
        ctx.lineTo(x0 + (k * CW * W) / 3, y0 + ch * H)
        ctx.moveTo(x0, y0 + (k * ch * H) / 3)
        ctx.lineTo(x0 + CW * W, y0 + (k * ch * H) / 3)
        ctx.stroke()
      }
    }
  }, [photo, centre, tilt, grid, ch])

  const clampCentre = (x: number, y: number) => ({
    x: Math.min(1 - CW / 2, Math.max(CW / 2, x)),
    y: Math.min(1 - ch / 2, Math.max(ch / 2, y)),
  })

  // Where the lighthouse and the horizon land inside the crop, after the tilt.
  const turn = (x: number, y: number) => {
    const a = (tilt * Math.PI) / 180
    const dx = (x - centre.x) * aspect
    const dy = y - centre.y
    return { x: centre.x + (dx * Math.cos(a) - dy * Math.sin(a)) / aspect, y: centre.y + dx * Math.sin(a) + dy * Math.cos(a) }
  }
  const lh = turn(LIGHTHOUSE.x, LIGHTHOUSE.y)
  const hz = turn(centre.x, HORIZON)
  const rel = { x: (lh.x - (centre.x - CW / 2)) / CW, y: (lh.y - (centre.y - ch / 2)) / ch }
  const horizon = (hz.y - (centre.y - ch / 2)) / ch

  const thirdsX = near(rel.x, 1 / 3, 0.05) || near(rel.x, 2 / 3, 0.05)
  const thirdsY = near(horizon, 1 / 3, 0.045) || near(horizon, 2 / 3, 0.045)
  const level = Math.abs(tilt) < 0.5
  const inside = rel.x > 0.03 && rel.x < 0.97 && rel.y > 0.03 && rel.y < 0.97
  const checks = [
    {
      ok: inside && thirdsX,
      yes: 'The lighthouse sits on a third line.',
      no: !inside ? 'The lighthouse has fallen out of the picture.' : near(rel.x, 0.5, 0.05) ? 'The lighthouse is dead centre: fine for symmetry, but static.' : 'Drag the frame so the lighthouse sits on one of the vertical lines.',
    },
    { ok: thirdsY, yes: 'The horizon sits on a third, so sky or land gets the space.', no: near(horizon, 0.5, 0.05) ? 'The horizon cuts the picture in half.' : 'Move the frame so the horizon lies along a third line.' },
    { ok: level, yes: 'The horizon is level.', no: 'The horizon is tilted. The sea looks like it is draining away.' },
  ]

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  return (
    <Demo title="Composition">
      <div className="relative overflow-hidden rounded-lg bg-neutral-900">
        <canvas
          ref={canvas}
          className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            const p = point(e)
            drag.current = { ...p, cx: centre.x, cy: centre.y }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            const p = point(e)
            setCentre(clampCentre(drag.current.cx + p.x - drag.current.x, drag.current.cy + p.y - drag.current.y))
          }}
          onPointerUp={() => (drag.current = null)}
          role="img"
          aria-label="A lighthouse on the coast; drag the frame to compose the photo"
        />
        {!photo && <div className="aspect-[3/2]" />}
      </div>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-neutral-500">Drag the picture to move the yellow frame: that’s your photo.</p>
        <Range label="Tilt" min={-6} max={6} step={0.25} value={tilt} onChange={setTilt} format={(v) => `${v > 0 ? '+' : ''}${v}°`} />
        <Toggle label="Grid (Settings › Camera › Grid)" checked={grid} onChange={setGrid} />
        <ul className="space-y-1 text-sm">
          {checks.map((c) => (
            <li key={c.yes} className={c.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-400'}>
              {c.ok ? '✓' : '○'} {c.ok ? c.yes : c.no}
            </li>
          ))}
        </ul>
      </div>
    </Demo>
  )
}
