// The places the simulator photographs. Each is built from cut-outs at
// real distances, so focus, blur and flash fall off the way they would.

import type { Layer, Paint, Scene } from './darkroom'
import {
  FRIEND,
  bench,
  building,
  car,
  carLights,
  cyclist,
  ellipse,
  glowDot,
  groundDepth,
  groundY,
  horizonY,
  lampPost,
  person,
  place,
  rng,
  roundRect,
  scaleAt,
  tree,
  type Ctx,
  type Outfit,
  type Rig,
} from './paint'

// The ground, cut into bands by distance so each band can blur on its
// own. Every band also paints a little way past its near edge, so when a
// nearer band blurs there is still ground underneath it.
function ground(id: string, edges: number[], rig: Rig, paint: Paint, label: string, extra: Partial<Layer> = {}): Layer[] {
  const out: Layer[] = []
  for (let i = edges.length - 2; i >= 0; i--) {
    const near = edges[i]
    const far = edges[i + 1]
    const top = far === Infinity ? horizonY(rig) - 0.6 : groundY(far, rig)
    const bottom = groundY(near, rig)
    if (top > 75 || bottom < 0) continue
    const reach = i === 0 ? 400 : Math.max(8, (bottom - top) * 1.3)
    out.push({
      id: `${id}-${i}`,
      label,
      depth: far === Infinity ? near * 3 : Math.sqrt(near * far),
      depthAt: (y) => Math.min(far === Infinity ? 1000 : far, Math.max(near, groundDepth(y, rig))),
      paint: (ctx) => {
        ctx.save()
        ctx.beginPath()
        ctx.rect(-150, top, 400, bottom + reach - top)
        ctx.clip()
        paint(ctx)
        ctx.restore()
      },
      ...extra,
    })
  }
  return out
}

const skyGradient = (ctx: Ctx, rig: Rig, stops: [number, string][]) => {
  const g = ctx.createLinearGradient(0, -40, 0, horizonY(rig) + 1)
  for (const [at, c] of stops) g.addColorStop(at, c)
  ctx.fillStyle = g
  ctx.fillRect(-150, -150, 400, horizonY(rig) + 152)
}

// Where on screen something `x` m from centre at `d` m lands, and back.
const xFor = (screenX: number, d: number, rig: Rig = {}) => (screenX - 50) / scaleAt(d, rig)

// ——— A park on a sunny afternoon ———

export type ParkOptions = {
  winter?: boolean
  // How far your friend stands, and where across the frame (0–100).
  friend?: number
  friendX?: number
  cyclist?: boolean
  // The branch hanging into the top corner, just in front of the camera.
  branch?: boolean
  rig?: Rig
}

export function park(o: ParkOptions = {}): Scene {
  const rig = o.rig ?? {}
  const winter = !!o.winter
  const friendAt = o.friend ?? 3.2
  const friendX = xFor(o.friendX ?? 31, friendAt)
  const pathX = (d: number) => 0.6 + 2.2 * Math.sin(d / 9)

  const sky: Paint = (ctx) => {
    skyGradient(
      ctx,
      rig,
      winter
        ? [[0, '#9fb0c0'], [0.6, '#cdd6de'], [1, '#e6ebef']]
        : [[0, '#2f6fc0'], [0.55, '#86b8e4'], [1, '#d4e8f4']]
    )
    const r = rng(3)
    for (let i = 0; i < 9; i++) {
      const x = (r() * 2 - 1) * 2600
      const lift = 500 + r() * 900
      const w = 160 + r() * 260
      place(ctx, x, 3000, () => {
        for (let k = 0; k < 6; k++) {
          const dx = (r() - 0.5) * w
          const dy = (r() - 0.5) * w * 0.18
          ellipse(ctx, dx, dy, w * (0.25 + r() * 0.2), w * (0.12 + r() * 0.08), winter ? 'rgba(240,243,246,0.85)' : 'rgba(255,255,255,0.9)')
        }
      }, rig, lift)
    }
  }

  const hills: Paint = (ctx) => {
    place(ctx, 0, 1500, () => {
      ctx.fillStyle = winter ? '#aebccb' : '#7f9fb6'
      ctx.beginPath()
      ctx.moveTo(-6000, 2)
      for (let x = -6000; x <= 6000; x += 100) ctx.lineTo(x, -60 - 50 * Math.sin(x / 700) - 30 * Math.sin(x / 260 + 1))
      ctx.lineTo(6000, 2)
      ctx.fill()
    }, rig)
    place(ctx, 0, 900, () => {
      const r = rng(11)
      ctx.fillStyle = winter ? '#9daebd' : '#8aa2b5'
      for (let x = -900; x < 1300; x += 25 + r() * 30) {
        const h = 20 + r() * 70
        ctx.fillRect(x, -h, 18 + r() * 14, h + 1)
      }
    }, rig)
  }

  const trees: Paint = (ctx) => {
    const r = rng(5)
    const leaf = winter ? ['#4a5f55', '#33463d', '#e7edf1'] : ['#3f7a35', '#2a5626', '#79ad52']
    for (let x = -90; x < 90; x += 5 + r() * 4) {
      const d = 40 + r() * 16
      const h = 8 + r() * 5
      place(ctx, x, d, () => tree(ctx, Math.floor(r() * 1e6), h, leaf[0], leaf[1], leaf[2], winter ? '#4a3d33' : '#5b4636'), rig)
    }
  }

  const grass: Paint = (ctx) => {
    const hy = horizonY(rig)
    const g = ctx.createLinearGradient(0, hy, 0, 75)
    if (winter) {
      g.addColorStop(0, '#d8e0e7')
      g.addColorStop(0.4, '#eaeff3')
      g.addColorStop(1, '#f5f8fa')
    } else {
      g.addColorStop(0, '#a3bd6c')
      g.addColorStop(0.35, '#6f9a3f')
      g.addColorStop(1, '#4e7c2b')
    }
    ctx.fillStyle = g
    ctx.fillRect(-150, hy - 1, 400, 250)

    // A gravel path winding away.
    ctx.fillStyle = winter ? '#cdd6de' : '#cbb38c'
    ctx.beginPath()
    const ds: number[] = []
    for (let d = 0.4; d < 120; d *= 1.08) ds.push(d)
    ds.forEach((d, i) => {
      const s = scaleAt(d, rig)
      const x = 50 + (pathX(d) - 0.9) * s
      if (i === 0) ctx.moveTo(x, groundY(d, rig))
      else ctx.lineTo(x, groundY(d, rig))
    })
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i]
      ctx.lineTo(50 + (pathX(d) + 0.9) * scaleAt(d, rig), groundY(d, rig))
    }
    ctx.fill()

    // Blades and pebbles, spread so the screen is evenly covered.
    const r = rng(7)
    const near = 0.6, far = 90
    for (let i = 0; i < 4200; i++) {
      const d = 1 / (1 / near - r() * (1 / near - 1 / far))
      const x = (r() * 2 - 1) * d * 1.7
      const s = scaleAt(d, rig)
      const px = 50 + x * s
      const py = groundY(d, rig)
      const tone = r()
      const lean = (r() - 0.5) * 0.06
      if (py > 82 || px < -60 || px > 160) continue
      if (Math.abs(x - pathX(d)) < 0.9) {
        ellipse(ctx, px, py, 0.02 * s, 0.009 * s, winter ? '#b8c3cd' : tone < 0.5 ? '#a8936f' : '#e3d3b5')
        continue
      }
      if (winter) {
        ellipse(ctx, px, py, 0.03 * s, 0.01 * s, tone < 0.5 ? '#d3dce4' : '#ffffff')
        continue
      }
      ctx.strokeStyle = tone < 0.33 ? '#3d6b23' : tone < 0.66 ? '#5f8f35' : '#93bb5a'
      ctx.lineWidth = 0.012 * s
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + lean * s, py - (0.05 + r() * 0.06) * s)
      ctx.stroke()
    }
  }

  const branch: Paint = (ctx) => {
    place(ctx, 0.62, 1.0, () => {
      const r = rng(21)
      ctx.strokeStyle = '#4b3a2c'
      ctx.lineWidth = 0.018
      ctx.beginPath()
      ctx.moveTo(0.4, -0.05)
      ctx.quadraticCurveTo(0.1, 0.02, -0.12, 0.2)
      ctx.stroke()
      for (let i = 0; i < 26; i++) {
        const t = r()
        const x = 0.4 - t * 0.5
        const y = -0.05 + t * 0.22 + (r() - 0.3) * 0.08
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(0.8 + r() * 1.6)
        ellipse(ctx, 0, 0.04, 0.022, 0.05, winter ? (r() < 0.4 ? '#f1f4f7' : '#2f4a3c') : r() < 0.5 ? '#4f8a35' : '#6aa543')
        ctx.restore()
      }
    }, rig, 1.95)
  }

  const outfit: Outfit = winter
    ? { ...FRIEND, top: '#c62828', stripe: undefined, trousers: '#263238', shoes: '#4e342e', wave: true }
    : FRIEND

  const layers: Layer[] = [
    { id: 'sky', label: 'the sky', depth: 5000, paint: sky },
    { id: 'hills', label: 'the hills', depth: 1200, paint: hills },
    { id: 'trees', label: 'the trees', depth: 46, paint: trees },
    ...ground('grass', [0.3, 0.8, 1.4, 2.2, 3.5, 6, 12, 30, Infinity], rig, grass, winter ? 'the snow' : 'the grass'),
    {
      id: 'lamp',
      label: 'the lamp post',
      depth: 14,
      paint: (ctx) => place(ctx, 4.2, 14, () => lampPost(ctx), rig),
    },
    {
      id: 'bench',
      label: 'the bench',
      depth: 11,
      paint: (ctx) => place(ctx, 1.6, 11, () => bench(ctx, winter ? '#6d4c3b' : '#8a5a3b'), rig),
    },
  ]
  if (o.cyclist !== false) {
    layers.push({
      id: 'cyclist',
      label: 'the cyclist',
      depth: 8,
      motion: [0.32, 0],
      paint: (ctx) => place(ctx, 0.4, 8, () => cyclist(ctx), rig),
    })
  }
  layers.push({
    id: 'friend',
    version: `${friendAt}|${o.friendX}|${winter}`,
    label: 'your friend',
    depth: friendAt,
    paint: (ctx) => place(ctx, friendX, friendAt, () => person(ctx, outfit), rig),
  })
  if (o.branch !== false) layers.push({ id: 'branch', label: 'the leaves', depth: 1.0, paint: branch })

  return {
    id: winter ? 'snow' : 'park',
    // A bright afternoon with some cloud; snow in full sun is brighter.
    ev: winter ? 14 : 13,
    // Snow fools an averaging meter into making everything middle grey.
    meterEv: winter ? 15.4 : 13,
    kelvin: winter ? 6200 : 5600,
    layers,
  }
}

// ——— A street at night ———

export type NightOptions = { friend?: number; alone?: boolean; ev?: number; rig?: Rig; traffic?: boolean }

export function night(o: NightOptions = {}): Scene {
  const rig = o.rig ?? {}
  const friendAt = o.friend ?? 2.6
  const friendX = xFor(70, friendAt)

  const sky: Paint = (ctx) => skyGradient(ctx, rig, [[0, '#04060f'], [0.6, '#0b1330'], [1, '#1c2a52']])
  const stars: Paint = (ctx) => {
    const r = rng(9)
    for (let i = 0; i < 60; i++) glowDot(ctx, r() * 120 - 10, r() * 30 - 8, 0.08 + r() * 0.08, '#dfe7ff', 1.5)
    glowDot(ctx, 84, 4, 2.2, '#f4f1e6', 1.5)
  }

  const skyline = (glow: boolean): Paint => (ctx) => {
    place(ctx, 0, 300, () => {
      const r = rng(13)
      for (let x = -700; x < 700; x += 30 + r() * 20) {
        const h = 40 + r() * 110
        const w = 24 + r() * 16
        ctx.save()
        ctx.translate(x + w / 2, 0)
        building(ctx, w, h, { wall: '#0c1222', pane: '#0c1222', lit: '#ffd38a' }, Math.floor(r() * 1e6), 4, Math.round(h / 8), 0.25, glow)
        ctx.restore()
      }
    }, rig)
  }

  const fronts = [
    { x: -30, w: 12, h: 18, wall: '#3a2a2a' },
    { x: -17, w: 10, h: 12, wall: '#2c303c' },
    { x: -6, w: 12, h: 16, wall: '#3b302a' },
    { x: 6.5, w: 11, h: 11, wall: '#30283a' },
    { x: 18, w: 12, h: 20, wall: '#2b333a' },
    { x: 30, w: 12, h: 14, wall: '#3a2d2a' },
  ]
  const facades = (glow: boolean): Paint => (ctx) => {
    place(ctx, 0, 24, () => {
      fronts.forEach((b, i) => {
        ctx.save()
        ctx.translate(b.x, -3.2)
        building(ctx, b.w, b.h - 3.2, { wall: b.wall, pane: '#141821', lit: '#ffb15c' }, 40 + i, Math.round(b.w / 2.2), Math.round(b.h / 3.2), 0.4, glow)
        ctx.restore()
        // The shop on the ground floor.
        ctx.fillStyle = '#ffcf8a'
        if (!glow) {
          ctx.fillStyle = b.wall
          ctx.fillRect(b.x - b.w / 2, -3.2, b.w, 3.2)
          ctx.fillStyle = '#5e4c3a'
        }
        ctx.fillRect(b.x - b.w / 2 + 0.8, -2.8, b.w - 3, 2.3)
        if (!glow) {
          ctx.fillStyle = '#1b1b1f'
          ctx.fillRect(b.x + b.w / 2 - 1.8, -2.6, 1.1, 2.6)
        }
      })
    }, rig)
  }

  // Neon over two of the shops, on its own so it can burn brighter.
  const signs: Paint = (ctx) => {
    place(ctx, 0, 24, () => {
      const neon = (text: string, x: number, colour: string) => {
        ctx.save()
        ctx.translate(x, -3.45)
        ctx.scale(0.11, 0.11)
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.lineWidth = 1.4
        ctx.strokeStyle = colour
        ctx.strokeText(text, 0, 0)
        ctx.restore()
      }
      neon('OPEN', -6, '#ff4fa3')
      neon('CAFÉ', 18, '#3ee6ff')
    }, rig)
  }

  const street: Paint = (ctx) => {
    const hy = horizonY(rig)
    ctx.fillStyle = '#2b2b31'
    ctx.fillRect(-150, hy - 1, 400, 250)
    const band = (near: number, far: number, colour: string) => {
      ctx.fillStyle = colour
      ctx.fillRect(-150, groundY(far, rig), 400, groundY(near, rig) - groundY(far, rig))
    }
    band(20, 24, '#3a3a42')
    band(19.6, 20, '#5a5a62')
    band(8.6, 19.6, '#1e1f24')
    band(8.2, 8.6, '#5a5a62')
    band(0.3, 8.2, '#34343c')
    // Lane markings.
    ctx.fillStyle = '#c9c4b5'
    for (let x = -60; x < 60; x += 4) {
      place(ctx, x, 14, () => ctx.fillRect(0, -0.0, 2, 0.12), rig)
    }
    // Paving joints on the near pavement.
    ctx.strokeStyle = '#26262c'
    ctx.lineWidth = 0.15
    for (let d = 1; d < 8.2; d += 0.9) {
      ctx.beginPath()
      ctx.moveTo(-150, groundY(d, rig))
      ctx.lineTo(250, groundY(d, rig))
      ctx.stroke()
    }
    // Pools of lamplight.
    for (const [x, d, w] of [[-3.2, 6, 3.2], [-6, 20.5, 4], [8, 20.5, 4]] as const) {
      const s = scaleAt(d, rig)
      const g = ctx.createRadialGradient(50 + x * s, groundY(d, rig), 0, 50 + x * s, groundY(d, rig), w * s)
      g.addColorStop(0, 'rgba(255, 214, 150, 0.45)')
      g.addColorStop(1, 'rgba(255, 214, 150, 0)')
      ctx.fillStyle = g
      ctx.save()
      ctx.translate(0, groundY(d, rig))
      ctx.scale(1, 0.25)
      ctx.translate(0, -groundY(d, rig))
      ctx.fillRect(-150, groundY(d, rig) - w * s, 400, w * s * 2)
      ctx.restore()
    }
  }

  const lamp = (x: number, d: number, glow: boolean): Paint => (ctx) =>
    place(ctx, x, d, () => {
      if (glow) glowDot(ctx, 0, -3.74, 0.14, '#ffe4b0', 2)
      else lampPost(ctx, '#15171a', '#ffe9c2')
    }, rig)

  const layers: Layer[] = [
    { id: 'sky', label: 'the sky', depth: 5000, paint: sky, glow: stars, glowPower: 1.2, kelvin: 6500 },
    { id: 'skyline', label: 'the skyline', depth: 300, paint: skyline(false), glow: skyline(true), glowPower: 1.4 },
    { id: 'facades', label: 'the shops', depth: 24, paint: facades(false), glow: facades(true), glowPower: 0.75 },
    { id: 'neon', label: 'the neon sign', depth: 23.9, paint: signs, glow: signs, glowPower: 5 },
    ...ground('street', [0.3, 2.2, 4, 7, 11, 17, 24], rig, street, 'the street'),
    { id: 'lamp-far-l', label: 'a street lamp', depth: 20.5, paint: lamp(-6, 20.5, false), glow: lamp(-6, 20.5, true), glowPower: 30 },
    { id: 'lamp-far-r', label: 'a street lamp', depth: 20.5, paint: lamp(8, 20.5, false), glow: lamp(8, 20.5, true), glowPower: 30 },
  ]
  if (o.traffic !== false) {
    layers.push({
      id: 'car',
      label: 'the car',
      depth: 14,
      motion: [0.55, 0],
      paint: (ctx) => place(ctx, -0.5, 14, () => car(ctx), rig),
      glow: (ctx) => place(ctx, -0.5, 14, () => carLights(ctx), rig),
      // Headlights are far brighter than anything they light, which is
      // why they still draw bright trails when smeared across the frame.
      glowPower: 140,
    })
  }
  layers.push({ id: 'lamp-near', label: 'a street lamp', depth: 6, paint: lamp(-3.2, 6, false), glow: lamp(-3.2, 6, true), glowPower: 16 })
  if (!o.alone)
    layers.push({
      id: 'friend',
      version: `${friendAt}`,
      label: 'your friend',
      depth: friendAt,
      light: 0.75,
      // Nobody stands perfectly still; it only shows in long exposures.
      motion: [0.0015, 0],
      paint: (ctx) =>
        place(ctx, friendX, friendAt, () =>
          person(ctx, { skin: '#b98264', hair: '#1a1310', top: '#3c4a6b', trousers: '#1f2228', shoes: '#d8d8d8' }), rig),
    })

  return { id: 'night', ev: o.ev ?? 4, meterEv: (o.ev ?? 4) - 1, kelvin: 3000, layers }
}

// ——— An espresso on a café table, shot close at 2× ———

export type CafeOptions = { kelvin?: number }

export function cafe(o: CafeOptions = {}): Scene {
  const rig: Rig = { f: 140, horizon: 20, eye: 0.1 }
  const FLOOR = -0.75 // the floor, measured from the table top

  const wall = (glow: boolean): Paint => (ctx) =>
    place(ctx, 0, 4.5, () => {
      if (!glow) {
        ctx.fillStyle = '#c7a07c'
        ctx.fillRect(-4, -3.5, 8, 3.6)
        // Wainscot.
        ctx.fillStyle = '#5b3f2e'
        ctx.fillRect(-4, -0.35, 8, 0.4)
      }
      // A window onto a bright street.
      ctx.save()
      ctx.translate(-1.0, -1.45)
      if (glow) {
        ctx.fillStyle = '#eaf2ff'
        ctx.fillRect(-0.6, 0, 1.2, 1.25)
      } else {
        ctx.fillStyle = '#dfe9f5'
        ctx.fillRect(-0.6, 0, 1.2, 1.25)
        ctx.fillStyle = '#9db7c9'
        ctx.fillRect(-0.6, 0.7, 1.2, 0.55)
        ctx.fillStyle = '#3e2c22'
        ctx.fillRect(-0.66, -0.06, 1.32, 0.06)
        ctx.fillRect(-0.66, 1.25, 1.32, 0.06)
        ctx.fillRect(-0.66, 0, 0.06, 1.25)
        ctx.fillRect(0.6, 0, 0.06, 1.25)
        ctx.fillRect(-0.03, 0, 0.06, 1.25)
      }
      ctx.restore()
      if (glow) return
      // Shelves with jars and books.
      const r = rng(31)
      for (const y of [-1.0, -0.62]) {
        ctx.fillStyle = '#4a3326'
        ctx.fillRect(0.2, y, 2.4, 0.04)
        for (let x = 0.28; x < 2.5; x += 0.12 + r() * 0.1) {
          const h = 0.12 + r() * 0.14
          const c = ['#e9dcc2', '#3b6e8f', '#a33d2f', '#d8b25c', '#5f7d4e', '#f2efe8'][Math.floor(r() * 6)]
          ctx.fillStyle = c
          roundRect(ctx, x, y - h, 0.08 + r() * 0.04, h, 0.015)
          ctx.fill()
        }
      }
      // A framed print.
      ctx.fillStyle = '#2d2420'
      ctx.fillRect(1.0, -2.1, 0.8, 0.6)
      ctx.fillStyle = '#e7a35a'
      ctx.fillRect(1.05, -2.05, 0.7, 0.5)
      ctx.fillStyle = '#3c6e71'
      ctx.beginPath()
      ctx.arc(1.4, -1.6, 0.22, Math.PI, 0)
      ctx.fill()
    }, rig, FLOOR)

  const fairy = (glow: boolean): Paint => (ctx) =>
    place(ctx, 0, 4.2, () => {
      // A garland draped along the shelf and over the window.
      const pts: [number, number][] = []
      for (let i = 0; i <= 28; i++) {
        const t = i / 28
        const x = -1.9 + t * 4.4
        pts.push([x, -1.55 + 0.12 * Math.sin(t * Math.PI * 5) ** 2 + (x > 0.1 ? 0.35 : 0)])
      }
      if (!glow) {
        ctx.strokeStyle = '#3a3026'
        ctx.lineWidth = 0.01
        ctx.beginPath()
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
      }
      for (const [x, y] of pts) {
        if (glow) glowDot(ctx, x, y + 0.03, 0.025, '#ffcf7a', 2.4)
        else ellipse(ctx, x, y + 0.03, 0.022, 0.028, '#fff0c8')
      }
    }, rig, FLOOR)

  const plant: Paint = (ctx) =>
    place(ctx, -1.7, 2.6, () => {
      ctx.fillStyle = '#b5653d'
      ctx.beginPath()
      ctx.moveTo(-0.22, -0.5)
      ctx.lineTo(0.22, -0.5)
      ctx.lineTo(0.17, 0)
      ctx.lineTo(-0.17, 0)
      ctx.fill()
      const r = rng(41)
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2.2
        const len = 0.5 + r() * 0.6
        const x = Math.cos(a) * len
        const y = -0.5 + Math.sin(a) * len
        ctx.strokeStyle = '#3c6b2f'
        ctx.lineWidth = 0.02
        ctx.beginPath()
        ctx.moveTo(0, -0.5)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(a + Math.PI / 2)
        ellipse(ctx, 0, 0, 0.16, 0.12, r() < 0.5 ? '#2f6b34' : '#4a8a3f')
        ctx.restore()
      }
    }, rig, FLOOR)

  const table: Paint = (ctx) => {
    ctx.fillStyle = '#8a5a3a'
    ctx.fillRect(-150, groundY(1.25, rig), 400, 200)
    // The table's far edge.
    ctx.fillStyle = '#4b2f1f'
    ctx.fillRect(-150, groundY(1.25, rig), 400, 0.8)
    // Planks running away from us, and their grain.
    const r = rng(51)
    for (let x = -1.2; x <= 1.2; x += 0.14) {
      ctx.strokeStyle = '#5f3b26'
      ctx.lineWidth = 0.35
      ctx.beginPath()
      ctx.moveTo(50 + x * scaleAt(0.15, rig), groundY(0.15, rig))
      ctx.lineTo(50 + x * scaleAt(1.25, rig), groundY(1.25, rig))
      ctx.stroke()
    }
    for (let i = 0; i < 900; i++) {
      const d = 1 / (1 / 0.15 - r() * (1 / 0.15 - 1 / 1.25))
      const x = (r() * 2 - 1) * 1.1
      const s = scaleAt(d, rig)
      ctx.strokeStyle = r() < 0.5 ? '#7a4d31' : '#a0704b'
      ctx.lineWidth = 0.002 * s
      ctx.beginPath()
      ctx.moveTo(50 + x * s, groundY(d, rig))
      const d2 = d * 1.06
      ctx.lineTo(50 + x * scaleAt(d2, rig), groundY(d2, rig))
      ctx.stroke()
    }
  }

  const vase: Paint = (ctx) =>
    place(ctx, 0.2, 0.95, () => {
      ctx.strokeStyle = '#4c7a3a'
      ctx.lineWidth = 0.004
      const heads: [number, number, string][] = [[-0.03, -0.2, '#e85d75'], [0.025, -0.22, '#f4a259'], [0.0, -0.17, '#f7d046']]
      for (const [x, y] of heads) {
        ctx.beginPath()
        ctx.moveTo(0, -0.09)
        ctx.quadraticCurveTo(x * 0.5, (y - 0.09) / 2, x, y)
        ctx.stroke()
      }
      for (const [x, y, c] of heads) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          ellipse(ctx, x + Math.cos(a) * 0.012, y + Math.sin(a) * 0.012, 0.011, 0.011, c)
        }
        ellipse(ctx, x, y, 0.007, 0.007, '#5a3a1a')
      }
      ctx.fillStyle = '#d9e4ea'
      ctx.beginPath()
      ctx.moveTo(-0.025, -0.1)
      ctx.lineTo(0.025, -0.1)
      ctx.quadraticCurveTo(0.045, -0.04, 0.03, 0)
      ctx.lineTo(-0.03, 0)
      ctx.quadraticCurveTo(-0.045, -0.04, -0.025, -0.1)
      ctx.fill()
    }, rig)

  const croissant: Paint = (ctx) =>
    place(ctx, -0.14, 0.6, () => {
      ellipse(ctx, 0, 0, 0.1, 0.022, '#f4f1ea')
      ellipse(ctx, 0, -0.002, 0.085, 0.017, '#e6e1d6')
      ctx.fillStyle = '#c98a3e'
      for (let k = -3; k <= 3; k++) {
        const w = 0.022 - Math.abs(k) * 0.003
        ctx.beginPath()
        ctx.ellipse(k * 0.017, -0.022 + Math.abs(k) * 0.003, w, w * 1.1, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = '#8f5520'
      ctx.lineWidth = 0.003
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath()
        ctx.moveTo(k * 0.017 - 0.006, -0.04 + Math.abs(k) * 0.004)
        ctx.lineTo(k * 0.017 + 0.004, -0.008)
        ctx.stroke()
      }
    }, rig)

  const espresso: Paint = (ctx) =>
    place(ctx, 0.012, 0.3, () => {
      // Saucer.
      ellipse(ctx, 0, 0, 0.055, 0.016, '#dfe3e6')
      ellipse(ctx, 0, -0.002, 0.045, 0.012, '#f7f8f9')
      // Cup body and handle.
      ctx.strokeStyle = '#f2f3f5'
      ctx.lineWidth = 0.006
      ctx.beginPath()
      ctx.ellipse(0.036, -0.028, 0.012, 0.011, 0, -1.3, 1.3)
      ctx.stroke()
      const g = ctx.createLinearGradient(-0.03, 0, 0.03, 0)
      g.addColorStop(0, '#d9dde1')
      g.addColorStop(0.35, '#ffffff')
      g.addColorStop(1, '#c4c9ce')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-0.032, -0.048)
      ctx.lineTo(0.032, -0.048)
      ctx.quadraticCurveTo(0.03, -0.006, 0.016, -0.004)
      ctx.lineTo(-0.016, -0.004)
      ctx.quadraticCurveTo(-0.03, -0.006, -0.032, -0.048)
      ctx.fill()
      // Crema and a little heart.
      ellipse(ctx, 0, -0.048, 0.032, 0.009, '#eef0f2')
      ellipse(ctx, 0, -0.048, 0.028, 0.0075, '#b77a3e')
      ctx.fillStyle = '#f3e3c8'
      ctx.beginPath()
      ctx.moveTo(0, -0.0435)
      ctx.bezierCurveTo(-0.016, -0.05, -0.008, -0.0545, 0, -0.05)
      ctx.bezierCurveTo(0.008, -0.0545, 0.016, -0.05, 0, -0.0435)
      ctx.fill()
    }, rig)

  return {
    id: 'cafe',
    ev: 7,
    kelvin: o.kelvin ?? 3200,
    crop: 2,
    layers: [
      { id: 'wall', label: 'the back wall', depth: 4.5, paint: wall(false), glow: wall(true), glowPower: 0.5, kelvin: o.kelvin ?? 3200 },
      { id: 'fairy', label: 'the fairy lights', depth: 4.2, paint: fairy(false), glow: fairy(true), glowPower: 16 },
      { id: 'plant', label: 'the plant', depth: 2.6, paint: plant },
      ...ground('table', [0.15, 0.24, 0.3, 0.38, 0.5, 0.68, 0.95, 1.25], rig, table, 'the table'),
      { id: 'vase', label: 'the flowers', depth: 0.95, paint: vase },
      { id: 'croissant', label: 'the croissant', depth: 0.6, paint: croissant },
      { id: 'espresso', label: 'the espresso', depth: 0.3, paint: espresso },
    ],
  }
}

// ——— A waterfall in the woods ———

export function waterfall(o: { rig?: Rig } = {}): Scene {
  const rig = o.rig ?? {}
  const FALL_X = 1.2
  const TOP = 5.4

  const sky: Paint = (ctx) => skyGradient(ctx, rig, [[0, '#b9c6cf'], [1, '#e2e8eb']])

  const forest: Paint = (ctx) => {
    const r = rng(61)
    for (let x = -70; x < 70; x += 2.5 + r() * 2.5) {
      const d = 50 + r() * 20
      const h = 16 + r() * 12
      const c = r() < 0.5 ? '#2c4636' : '#38563f'
      place(ctx, x, d, () => {
        ctx.fillStyle = '#3b2f27'
        ctx.fillRect(-0.3, -h * 0.2, 0.6, h * 0.2)
        ctx.fillStyle = c
        for (let k = 0; k < 4; k++) {
          const y = -h * (0.15 + k * 0.2)
          const w = (h * 0.32) * (1 - k * 0.2)
          ctx.beginPath()
          ctx.moveTo(-w, y)
          ctx.lineTo(0, y - h * 0.38)
          ctx.lineTo(w, y)
          ctx.fill()
        }
      }, rig)
    }
  }

  const cliff: Paint = (ctx) =>
    place(ctx, 0, 11, () => {
      const r = rng(71)
      ctx.fillStyle = '#5d5852'
      ctx.beginPath()
      ctx.moveTo(-40, 0.5)
      for (let x = -40; x <= 40; x += 1.2) {
        const gap = Math.abs(x - FALL_X) < 1.6
        const top = gap ? TOP - 0.3 : TOP + 0.6 + Math.sin(x * 0.7) * 0.8 + r() * 0.9 + Math.abs(x) * 0.05
        ctx.lineTo(x, -top)
      }
      ctx.lineTo(40, 0.5)
      ctx.fill()
      // Ledges, cracks and moss.
      for (let i = 0; i < 70; i++) {
        const x = (r() * 2 - 1) * 30
        const y = -r() * TOP
        ctx.fillStyle = r() < 0.5 ? '#46423e' : '#77716a'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + 0.8 + r() * 1.6, y - 0.1)
        ctx.lineTo(x + 0.6 + r(), y + 0.25)
        ctx.fill()
      }
      for (let i = 0; i < 60; i++) ellipse(ctx, (r() * 2 - 1) * 30, -r() * TOP, 0.4 + r() * 0.6, 0.15 + r() * 0.2, r() < 0.5 ? '#4e6b3a' : '#5f7f45')
    }, rig)

  const fall: Paint = (ctx) =>
    place(ctx, FALL_X, 10.8, () => {
      const g = ctx.createLinearGradient(-1.4, 0, 1.4, 0)
      g.addColorStop(0, 'rgba(200, 218, 228, 0.85)')
      g.addColorStop(0.5, 'rgba(238, 244, 247, 0.97)')
      g.addColorStop(1, 'rgba(190, 210, 222, 0.85)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-1.2, -TOP + 0.2)
      ctx.lineTo(1.2, -TOP + 0.2)
      ctx.quadraticCurveTo(1.5, -TOP * 0.5, 1.7, 0)
      ctx.lineTo(-1.7, 0)
      ctx.quadraticCurveTo(-1.5, -TOP * 0.5, -1.2, -TOP + 0.2)
      ctx.fill()
    }, rig)

  // The moving part: streaks and drops that the shutter freezes or smears.
  const streaks: Paint = (ctx) =>
    place(ctx, FALL_X, 10.7, () => {
      const r = rng(81)
      for (let i = 0; i < 420; i++) {
        const t = r()
        const y = -TOP + 0.3 + t * (TOP - 0.3)
        const half = 1.2 + (t * t) * 0.5
        const x = (r() * 2 - 1) * half
        const len = 0.15 + r() * 0.7
        const w = 0.03 + r() * 0.09
        const tone = r()
        ctx.fillStyle = tone < 0.35 ? 'rgba(96, 124, 140, 0.75)' : tone < 0.7 ? 'rgba(255,255,255,0.95)' : 'rgba(205, 222, 232, 0.9)'
        roundRect(ctx, x - w / 2, y, w, len, w / 2)
        ctx.fill()
      }
      for (let i = 0; i < 45; i++) {
        const y = -r() * TOP
        const x = (r() < 0.5 ? -1 : 1) * (1.2 + r() * 0.7)
        ellipse(ctx, x, y, 0.04, 0.05, 'rgba(240,246,250,0.9)')
      }
    }, rig)

  const mist: Paint = (ctx) =>
    place(ctx, FALL_X, 10.2, () => {
      for (let i = 0; i < 7; i++) ellipse(ctx, (i - 3) * 0.55, -0.25 - (i % 2) * 0.15, 0.9, 0.35, 'rgba(235, 242, 246, 0.12)')
    }, rig)

  const pool: Paint = (ctx) => {
    const hy = horizonY(rig)
    ctx.fillStyle = '#4c5a46'
    ctx.fillRect(-150, hy - 1, 400, 250)
    // The pool, wider as it comes towards us.
    ctx.fillStyle = '#3f6470'
    ctx.beginPath()
    const ds = [11, 9.5, 8, 6.5, 5.2, 4.2, 3.4, 2.9]
    ds.forEach((d, i) => {
      const s = scaleAt(d, rig)
      const half = 2.2 + (11 - d) * 0.5
      const x = 50 + (FALL_X - half) * s
      if (i === 0) ctx.moveTo(x, groundY(d, rig))
      else ctx.lineTo(x, groundY(d, rig))
    })
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i]
      const half = 2.2 + (11 - d) * 0.5
      ctx.lineTo(50 + (FALL_X + half) * scaleAt(d, rig), groundY(d, rig))
    }
    ctx.fill()
    const r = rng(91)
    for (let i = 0; i < 500; i++) {
      const d = 2 + r() * 12
      const x = (r() * 2 - 1) * d * 1.6
      const s = scaleAt(d, rig)
      ellipse(ctx, 50 + x * s, groundY(d, rig), 0.08 * s, 0.03 * s, r() < 0.5 ? '#3c4a37' : '#69805a')
    }
  }

  const ripples: Paint = (ctx) => {
    const r = rng(101)
    for (let i = 0; i < 220; i++) {
      const d = 3.2 + r() * 7.6
      const half = 2.2 + (11 - d) * 0.5
      const x = FALL_X + (r() * 2 - 1) * half * 0.9
      const s = scaleAt(d, rig)
      ctx.fillStyle = r() < 0.6 ? 'rgba(210, 228, 236, 0.75)' : 'rgba(40, 70, 80, 0.6)'
      ctx.fillRect(50 + x * s, groundY(d, rig), (0.3 + r() * 0.6) * s, 0.025 * s)
    }
  }

  const rocks: Paint = (ctx) => {
    const boulder = (x: number, d: number, w: number, h: number, seed: number) =>
      place(ctx, x, d, () => {
        const r = rng(seed)
        ctx.fillStyle = '#6a645c'
        ctx.beginPath()
        ctx.moveTo(-w / 2, 0.1)
        for (let k = 0; k <= 10; k++) {
          const a = Math.PI + (k / 10) * Math.PI
          ctx.lineTo(Math.cos(a) * (w / 2) * (0.9 + r() * 0.15), Math.sin(a) * h * (0.85 + r() * 0.2))
        }
        ctx.lineTo(w / 2, 0.1)
        ctx.fill()
        ellipse(ctx, -w * 0.15, -h * 0.75, w * 0.3, h * 0.15, '#8a837a')
        ellipse(ctx, w * 0.1, -h * 0.9, w * 0.25, h * 0.1, '#567446')
      }, rig)
    boulder(-3.1, 4.6, 2.4, 1.2, 111)
    boulder(3.4, 5.2, 2.0, 0.9, 112)
  }

  const fern: Paint = (ctx) =>
    place(ctx, -1.5, 2.6, () => {
      const r = rng(121)
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 1.8
        const len = 0.6 + r() * 0.4
        ctx.save()
        ctx.rotate(a + Math.PI / 2)
        ctx.strokeStyle = '#3f6a2c'
        ctx.lineWidth = 0.015
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, -len)
        ctx.stroke()
        for (let t = 0.1; t < 1; t += 0.07) {
          const l = 0.12 * (1 - t)
          ctx.fillStyle = r() < 0.5 ? '#4d8a35' : '#3f7a2c'
          ctx.beginPath()
          ctx.ellipse(-l / 2, -len * t, l / 2, 0.012, -0.4, 0, Math.PI * 2)
          ctx.ellipse(l / 2, -len * t, l / 2, 0.012, 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }, rig)

  return {
    id: 'waterfall',
    ev: 11,
    kelvin: 6800,
    layers: [
      { id: 'sky', label: 'the sky', depth: 5000, paint: sky },
      { id: 'forest', label: 'the forest', depth: 58, paint: forest },
      { id: 'cliff', label: 'the cliff', depth: 11, paint: cliff },
      ...ground('banks', [0.3, 2.3, 3.4, 5, 7.5, 11], rig, pool, 'the pool'),
      { id: 'fall', label: 'the waterfall', depth: 10.8, paint: fall },
      { id: 'streaks', label: 'the waterfall', depth: 10.7, paint: streaks, motion: [0, 0.85] },
      { id: 'mist', label: 'the spray', depth: 10.2, paint: mist },
      { id: 'ripples', label: 'the pool', depth: 6, paint: ripples, motion: [0.05, 0] },
      { id: 'rocks', label: 'the rocks', depth: 4.8, paint: rocks },
      { id: 'fern', label: 'the fern', depth: 2.6, paint: fern },
    ],
  }
}

export const SCENES = {
  park: () => park(),
  snow: () => park({ winter: true }),
  night: () => night(),
  cafe: () => cafe(),
  waterfall: () => waterfall(),
}
export type SceneName = keyof typeof SCENES
