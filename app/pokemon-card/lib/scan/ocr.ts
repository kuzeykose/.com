'use client'
/**
 * Browser OCR: canvas only (no sharp). Decodes with EXIF orientation, runs the shared pure plan
 * (trim -> 1000x1400 -> name band + bottom strips -> full-art/SIR fallback), returns TEXT only.
 * Pixels never leave the device; nothing is persisted.
 */
import type { Img } from './image'
import { runOcrPlan, type Engine, type Psm } from './ocrPlan'
import type { ScanQuery } from './types'

/** Same shape as PR #8 so scan-flow.tsx needs no change. */
export type OcrProgress = { name?: boolean; number?: boolean; ocr?: ScanQuery }
type TesseractMod = typeof import('tesseract.js')
type TessWorker = Awaited<ReturnType<TesseractMod['createWorker']>>
let workerPromise: Promise<TessWorker> | null = null

function getWorker() {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js')
    return createWorker('eng', 1, { workerBlobURL: true })
  })()
  return workerPromise
}

/** Decode with EXIF orientation applied (replaces sharp.rotate()). Caps the long edge to save memory. */
async function decode(blob: Blob, maxEdge = 2000): Promise<Img> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bitmap.close()
  }
}

function toCanvas(img: Img): OffscreenCanvas {
  const c = new OffscreenCanvas(img.width, img.height)
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
  return c
}

const engine: Engine = async (img, psm: Psm) => {
  const worker = await getWorker()
  await worker.setParameters({ tessedit_pageseg_mode: psm as never })
  const r = await worker.recognize(toCanvas(img) as unknown as HTMLCanvasElement)
  return { text: r.data.text, conf: r.data.confidence }
}

let totalsPromise: Promise<Set<number> | undefined> | null = null
function knownTotals() {
  totalsPromise ??= fetch('/api/pokemon-card/sets')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((b: { sets?: { printedTotal?: number }[] }) => {
      const s = new Set((b.sets ?? []).map((x) => x.printedTotal).filter((n): n is number => n != null))
      return s.size ? s : undefined
    })
    .catch(() => { totalsPromise = null; return undefined })
  return totalsPromise
}

export async function ocrCard(blob: Blob, onProgress?: (p: OcrProgress) => void): Promise<ScanQuery> {
  const [img, totals] = await Promise.all([decode(blob), knownTotals(), getWorker()])
  const { passes: _passes, ...query } = await runOcrPlan(img, engine, totals, (stage, partial) => {
    if (stage === 'name') onProgress?.({ name: true, ocr: partial })
  })
  onProgress?.({ name: true, number: true, ocr: query })
  return query
}
