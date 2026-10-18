'use client'

import { useEffect, useRef, useState } from 'react'
import { Grid } from '../lab/viewfinder'
import { Demo, Range, Toggle } from '../ui'

const W = 960
const H = 720

function paint(ctx: CanvasRenderingContext2D, horizon: number, subject: number, tilt: number) {
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  // Tilt the world, not the frame, and scale up so no corner shows.
  ctx.translate(W / 2, H / 2)
  ctx.rotate((tilt * Math.PI) / 180)
  ctx.scale(1.12, 1.12)
  ctx.translate(-W / 2, -H / 2)
  const hy = horizon * H
  const sky = ctx.createLinearGradient(0, -100, 0, hy)
  sky.addColorStop(0, '#2d3a6b')
  sky.addColorStop(0.55, '#e0777d')
  sky.addColorStop(1, '#f7c58b')
  ctx.fillStyle = sky
  ctx.fillRect(-200, -200, W + 400, hy + 200)
  // The sun, half set.
  const sx = W * 0.72
  const glow = ctx.createRadialGradient(sx, hy, 0, sx, hy, 160)
  glow.addColorStop(0, 'rgba(255, 236, 190, 0.95)')
  glow.addColorStop(0.25, 'rgba(255, 210, 140, 0.6)')
  glow.addColorStop(1, 'rgba(255, 190, 120, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(sx - 160, hy - 160, 320, 160)
  ctx.fillStyle = '#fff1cf'
  ctx.beginPath()
  ctx.arc(sx, hy, 34, Math.PI, 0)
  ctx.fill()
  // Sea, with a path of light.
  const sea = ctx.createLinearGradient(0, hy, 0, H + 200)
  sea.addColorStop(0, '#5a5f8a')
  sea.addColorStop(1, '#1c2240')
  ctx.fillStyle = sea
  ctx.fillRect(-200, hy, W + 400, H + 400)
  ctx.fillStyle = 'rgba(255, 220, 170, 0.55)'
  for (let i = 0; i < 40; i++) {
    const y = hy + 4 + i * i * 0.45
    const w = 20 + i * 5
    ctx.fillRect(sx - w / 2 + Math.sin(i * 1.7) * i * 1.5, y, w, 2 + i * 0.08)
  }
  // A lighthouse on a rock.
  const lx = subject * W
  ctx.fillStyle = '#20202c'
  ctx.beginPath()
  ctx.ellipse(lx, hy + 8, 90, 26, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#f2ece4'
  ctx.beginPath()
  ctx.moveTo(lx - 22, hy - 4)
  ctx.lineTo(lx - 14, hy - 170)
  ctx.lineTo(lx + 14, hy - 170)
  ctx.lineTo(lx + 22, hy - 4)
  ctx.fill()
  ctx.fillStyle = '#c0392b'
  for (const y of [-60, -120]) ctx.fillRect(lx - 20, hy + y - 18, 40, 18)
  ctx.fillStyle = '#2b2b33'
  ctx.fillRect(lx - 20, hy - 196, 40, 26)
  ctx.fillStyle = '#ffe9a8'
  ctx.fillRect(lx - 12, hy - 192, 24, 16)
  ctx.fillStyle = '#2b2b33'
  ctx.beginPath()
  ctx.moveTo(lx - 24, hy - 196)
  ctx.lineTo(lx, hy - 214)
  ctx.lineTo(lx + 24, hy - 196)
  ctx.fill()
  ctx.restore()
}

const near = (v: number, target: number, tol: number) => Math.abs(v - target) < tol

export function CompositionDemo() {
  const [horizon, setHorizon] = useState(0.5)
  const [subject, setSubject] = useState(0.5)
  const [tilt, setTilt] = useState(3)
  const [grid, setGrid] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) paint(ctx, horizon, subject, tilt)
  }, [horizon, subject, tilt])

  const drag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === 'pointermove' && e.buttons === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    setSubject(Math.min(0.92, Math.max(0.08, (e.clientX - r.left) / r.width)))
  }

  const thirdsX = near(subject, 1 / 3, 0.05) || near(subject, 2 / 3, 0.05)
  const thirdsY = near(horizon, 1 / 3, 0.04) || near(horizon, 2 / 3, 0.04)
  const level = Math.abs(tilt) < 0.5
  const checks = [
    { ok: thirdsX, yes: 'The lighthouse sits on a third line.', no: near(subject, 0.5, 0.05) ? 'The lighthouse is dead centre: fine for symmetry, but static.' : 'Drag the lighthouse onto one of the vertical lines.' },
    { ok: thirdsY, yes: 'The horizon sits on a third, so sky or sea gets the space.', no: near(horizon, 0.5, 0.04) ? 'The horizon cuts the picture in half.' : 'Move the horizon to a third line.' },
    { ok: level, yes: 'The horizon is level.', no: 'The horizon is tilted. The sea looks like it is draining away.' },
  ]

  return (
    <Demo title="Composition">
      <div className="relative overflow-hidden rounded-lg bg-neutral-900">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="block h-auto w-full cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag(e)
          }}
          onPointerMove={drag}
          role="img"
          aria-label="A lighthouse at sunset; drag to move it"
        />
        {grid && <Grid />}
      </div>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-neutral-500">Drag across the picture to move the lighthouse.</p>
        <Range label="Horizon height" min={0.2} max={0.8} step={0.01} value={horizon} onChange={setHorizon} format={(v) => `${Math.round(v * 100)}% down`} />
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
