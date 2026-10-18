'use client'

// Real photographs as scenes. Each photo comes with a depth map (how far
// away every pixel is), a label map (what the main things are), a "plate"
// (the photo with its foreground painted out) and soft masks for anything
// that moves. Here they're cut into slices by distance, and each slice
// becomes a darkroom layer, so focus, blur, flash and motion work on them
// just as they would on a real scene.

import { useEffect, useMemo, useState } from 'react'
import type { Layer, Scene } from './darkroom'

export type PhotoSpec = {
  id: string
  ev: number
  meterEv?: number
  kelvin: number
  // Crop into the photo: 2 is the middle half, centred on `center` (0–1).
  zoom?: number
  center?: [number, number]
  // Slice boundaries in metres, near to far.
  edges: number[]
  // Pixels brighter than `threshold` (0–1) are lamps and signs: they glow.
  lights?: { threshold: number; power: number }
  // Things that move. `flow` is for water: it moves within its own shape,
  // so its blur stays inside it.
  objects?: { id: string; depth: number; motion?: [number, number]; label: string; flow?: boolean }[]
  // Whether there's a plate: the photo with its moving things painted out.
  plate?: boolean
  labels?: Record<number, string>
  // What to call unlabelled pixels, near and far.
  ground: string
  far: string
}

const W = 640
const H = 480
const DMIN = 0.2
const DMAX = 100

type Assets = {
  photo: Uint8ClampedArray
  plate: Uint8ClampedArray
  depth: Float32Array
  labels: Uint8Array
  masks: Record<string, Uint8Array>
}

const images = new Map<string, Promise<HTMLImageElement>>()
function image(src: string) {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Could not load ${src}`))
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

function pixels(img: HTMLImageElement, spec: PhotoSpec, smooth: boolean) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = smooth
  ctx.imageSmoothingQuality = 'high'
  const z = spec.zoom ?? 1
  const [cx, cy] = spec.center ?? [0.5, 0.5]
  const sw = img.naturalWidth / z
  const sh = img.naturalHeight / z
  const sx = Math.min(img.naturalWidth - sw, Math.max(0, cx * img.naturalWidth - sw / 2))
  const sy = Math.min(img.naturalHeight - sh, Math.max(0, cy * img.naturalHeight - sh / 2))
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
  return ctx.getImageData(0, 0, W, H).data
}

const assetCache = new Map<string, Promise<Assets>>()
function assets(spec: PhotoSpec) {
  const key = `${spec.id}|${spec.zoom ?? 1}|${spec.center ?? ''}`
  let p = assetCache.get(key)
  if (!p) {
    const base = `/photography/${spec.id}`
    p = (async () => {
      const [photo, plate, depth, labels, ...masks] = await Promise.all([
        image(`${base}/photo.jpg`),
        image(`${base}/${spec.plate ? 'plate' : 'photo'}.jpg`),
        image(`${base}/depth.png`),
        image(`${base}/labels.png`),
        ...(spec.objects ?? []).map((o) => image(`${base}/${o.id}.png`)),
      ])
      const d8 = pixels(depth, spec, false)
      const l8 = pixels(labels, spec, false)
      const n = W * H
      const d = new Float32Array(n)
      const l = new Uint8Array(n)
      const k = Math.log(DMAX / DMIN) / 255
      for (let i = 0; i < n; i++) {
        d[i] = DMIN * Math.exp(d8[i * 4] * k)
        l[i] = l8[i * 4]
      }
      const m: Record<string, Uint8Array> = {}
      ;(spec.objects ?? []).forEach((o, j) => {
        const px = pixels(masks[j], spec, true)
        const a = new Uint8Array(n)
        for (let i = 0; i < n; i++) a[i] = px[i * 4]
        m[o.id] = a
      })
      return { photo: pixels(photo, spec, true), plate: pixels(plate, spec, true), depth: d, labels: l, masks: m }
    })()
    assetCache.set(key, p)
  }
  return p
}

function canvasFrom(data: Uint8ClampedArray) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  c.getContext('2d')!.putImageData(new ImageData(data, W, H), 0, 0)
  return c
}

const draw = (c: HTMLCanvasElement) => (ctx: CanvasRenderingContext2D) => ctx.drawImage(c, 0, 0, 100, 75)

// How much of a pixel is lamp: nothing below the threshold, all of it at
// full brightness. (The brightest channel, so red tail lights count too.)
function glowOf(r: number, g: number, b: number, threshold: number) {
  const y = Math.max(r, g, b) / 255
  if (y <= threshold) return 0
  const t = (y - threshold) / (1 - threshold)
  return t * t * (3 - 2 * t)
}

// Fill in the pixels a slice doesn't own by spreading the colours it does
// own outwards (pull-push). Behind a blurred edge in front, the slice then
// shows something that matches itself rather than a hard-coded backdrop.
function fill(photo: Uint8ClampedArray, own: Uint8Array) {
  type Level = { w: number; h: number; c: Float32Array; a: Float32Array }
  const levels: Level[] = []
  let c = new Float32Array(W * H * 3)
  let a = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    if (!own[i]) continue
    a[i] = 1
    c[i * 3] = photo[i * 4]
    c[i * 3 + 1] = photo[i * 4 + 1]
    c[i * 3 + 2] = photo[i * 4 + 2]
  }
  let w = W
  let h = H
  levels.push({ w, h, c, a })
  // Pull: average down to a single pixel, keeping track of coverage.
  while (w > 1 || h > 1) {
    const nw = Math.max(1, (w + 1) >> 1)
    const nh = Math.max(1, (h + 1) >> 1)
    const nc = new Float32Array(nw * nh * 3)
    const na = new Float32Array(nw * nh)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const j = (y >> 1) * nw + (x >> 1)
        na[j] += a[i]
        nc[j * 3] += c[i * 3]
        nc[j * 3 + 1] += c[i * 3 + 1]
        nc[j * 3 + 2] += c[i * 3 + 2]
      }
    for (let j = 0; j < nw * nh; j++)
      if (na[j] > 1) {
        nc[j * 3] /= na[j]
        nc[j * 3 + 1] /= na[j]
        nc[j * 3 + 2] /= na[j]
        na[j] = 1
      }
    w = nw
    h = nh
    c = nc
    a = na
    levels.push({ w, h, c, a })
  }
  // Push: fill each level's gaps from the level above it.
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l]
    const g = levels[l + 1]
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x
        const k = 1 - f.a[i]
        if (k <= 0) continue
        const j = (y >> 1) * g.w + (x >> 1)
        const ga = g.a[j] || 1
        f.c[i * 3] += (k * g.c[j * 3]) / ga
        f.c[i * 3 + 1] += (k * g.c[j * 3 + 1]) / ga
        f.c[i * 3 + 2] += (k * g.c[j * 3 + 2]) / ga
        f.a[i] = 1
      }
  }
  return levels[0].c
}

type Built = { layers: (Layer & { order: number })[]; pick: (fx: number, fy: number) => { depth: number; label: string } }
const builtCache = new Map<string, Promise<Built>>()

function build(spec: PhotoSpec): Promise<Built> {
  const key = `${spec.id}|${spec.zoom ?? 1}|${spec.center ?? ''}|${spec.edges.join(',')}|${spec.lights?.threshold ?? ''}`
  let p = builtCache.get(key)
  if (p) return p
  p = assets(spec).then((a) => {
    const n = W * H
    const objects = spec.objects ?? []
    // Where a moving thing covers the photo, the slices behind it (and the
    // one it stands in) show the plate, so there's something to see when it
    // smears; the slices in front of it show nothing there.
    const moving = new Float32Array(n)
    for (const o of objects) {
      const m = a.masks[o.id]
      for (let i = 0; i < n; i++) if (m[i] > 24 && (!moving[i] || o.depth < moving[i])) moving[i] = o.depth
    }
    const layers: (Layer & { order: number })[] = []
    const edges = [...spec.edges, Infinity]
    const lights = spec.lights
    for (let k = edges.length - 2; k >= 0; k--) {
      const near = edges[k]
      const far = edges[k + 1]
      const body = new Uint8ClampedArray(n * 4)
      const glow = lights ? new Uint8ClampedArray(n * 4) : null
      let any = false
      const own = new Uint8Array(n)
      for (let i = 0; i < n; i++) own[i] = !moving[i] && a.depth[i] >= near && a.depth[i] < far ? 1 : 0
      // Under nearer things the slice shows its own colours spread out;
      // under moving things, the plate (what's really behind them).
      const filled = fill(a.photo, own)
      for (let i = 0; i < n; i++) {
        const d = a.depth[i]
        if ((moving[i] || d) >= far) continue
        const o = i * 4
        if (own[i] || moving[i]) {
          const src = own[i] ? a.photo : a.plate
          body[o] = src[o]
          body[o + 1] = src[o + 1]
          body[o + 2] = src[o + 2]
        } else {
          body[o] = filled[i * 3]
          body[o + 1] = filled[i * 3 + 1]
          body[o + 2] = filled[i * 3 + 2]
        }
        body[o + 3] = 255
        if (own[i]) any = true
        if (glow && own[i]) {
          const g = glowOf(body[o], body[o + 1], body[o + 2], lights!.threshold)
          if (g > 0) {
            glow[o] = body[o]
            glow[o + 1] = body[o + 1]
            glow[o + 2] = body[o + 2]
            glow[o + 3] = g * 255
          }
        }
      }
      if (!any) continue
      layers.push({
        id: `${spec.id}-${k}`,
        version: key,
        order: far === Infinity ? 1e9 : far,
        depth: far === Infinity ? near * 2 : Math.sqrt(near * far),
        paint: draw(canvasFrom(body)),
        glow: glow ? draw(canvasFrom(glow)) : undefined,
        glowPower: lights?.power,
      })
    }
    for (const o of objects) {
      const m = a.masks[o.id]
      const body = new Uint8ClampedArray(n * 4)
      const glow = lights ? new Uint8ClampedArray(n * 4) : null
      for (let i = 0; i < n; i++) {
        if (!m[i]) continue
        const q = i * 4
        body[q] = a.photo[q]
        body[q + 1] = a.photo[q + 1]
        body[q + 2] = a.photo[q + 2]
        body[q + 3] = m[i]
        if (glow) {
          const g = glowOf(a.photo[q], a.photo[q + 1], a.photo[q + 2], lights!.threshold)
          glow[q] = a.photo[q]
          glow[q + 1] = a.photo[q + 1]
          glow[q + 2] = a.photo[q + 2]
          glow[q + 3] = g * m[i]
        }
      }
      layers.push({
        id: `${spec.id}-${o.id}`,
        version: key,
        label: o.label,
        order: o.depth,
        depth: o.depth,
        motion: o.motion,
        clip: o.flow,
        paint: draw(canvasFrom(body)),
        glow: glow ? draw(canvasFrom(glow)) : undefined,
        glowPower: lights?.power,
      })
    }
    // Far to near. A moving thing goes in front of the slice it stands in.
    layers.sort((x, y) => y.order - x.order)
    const pick = (fx: number, fy: number) => {
      const i = Math.min(H - 1, Math.floor(fy * H)) * W + Math.min(W - 1, Math.floor(fx * W))
      for (const o of objects) if (a.masks[o.id][i] > 127) return { depth: o.depth, label: o.label }
      const d = a.depth[i]
      const label = spec.labels?.[a.labels[i]] ?? (d > 12 ? spec.far : spec.ground)
      return { depth: d, label }
    }
    return { layers, pick }
  })
  builtCache.set(key, p)
  return p
}

// The scene for a photo, or null while it loads.
export function usePhoto(spec: PhotoSpec | null): Scene | null {
  const [built, setBuilt] = useState<{ key: string; b: Built } | null>(null)
  const key = spec ? `${spec.id}|${spec.zoom ?? 1}|${spec.center ?? ''}|${spec.edges.join(',')}` : ''
  useEffect(() => {
    if (!spec) return
    let live = true
    build(spec).then((b) => live && setBuilt({ key, b }))
    return () => {
      live = false
    }
  }, [key])
  const ready = spec && built && built.key === key ? built.b : null
  return useMemo(
    () =>
      ready && spec
        ? { id: key, ev: spec.ev, meterEv: spec.meterEv, kelvin: spec.kelvin, crop: spec.zoom ?? 1, layers: ready.layers, pick: ready.pick }
        : null,
    [ready, key, spec?.ev, spec?.meterEv, spec?.kelvin]
  )
}

// Load a photo's plain pixels (for demos that don't need the darkroom).
export function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let live = true
    image(src).then((i) => live && setImg(i))
    return () => {
      live = false
    }
  }, [src])
  return img
}

export const photoAssets = assets
