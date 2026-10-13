/**
 * Pure OCR plan shared by browser (ocr.ts) and node tests. Engine is injected, so no DOM/node deps.
 * Stage 1: name band + full-width bottom strips (cheap, normal cards).
 * Stage 2 (only if stage 1 found no number): full-art / SIR - bottom-left box over art, upscaled,
 *          white-text mask + inverted Otsu, PSM 7 and 11. Early exit once two passes agree.
 * Orientation: try 0/90/180/270 with a cheap name-band probe (not counted against STAGE2_PASS_CAP).
 */
import { crop, grayNormalize, pad, rotateK, scaleToWidth, threshold, trimBorder, whiteText, resize, type Img } from './image'
import { COMMON_TOTALS, nameTokens, parseHp, parseNumbers, pickNameToken, voteNumber } from './parse'
import type { NumberRead, ScanQuery } from './types'

export type Psm = '6' | '7' | '11'
export type Engine = (img: Img, psm: Psm) => Promise<{ text: string; conf: number }>
export const CARD_W = 1000, CARD_H = 1400
/** Extra Tesseract calls allowed when stage 1 has no agreeing number. */
export const STAGE2_PASS_CAP = 24

export function normalizeCard(img: Img): Img {
  return resize(trimBorder(img), CARD_W, CARD_H)
}

type Variant = 'gray' | 'otsu' | 'otsuInv' | 'white'
function prep(card: Img, l: number, t: number, w: number, h: number, v: Variant, width = 1600): Img {
  const g = scaleToWidth(crop(card, l, t, w, h), width)
  if (v === 'white') return pad(whiteText(g))
  const n = grayNormalize(g)
  return pad(v === 'gray' ? n : threshold(n, 'otsu', v === 'otsuInv'))
}

async function scoreTopName(img: Img, run: Engine) {
  const card = normalizeCard(img)
  let best = { n: '', conf: 0, title: false }
  for (const v of ['gray', 'otsuInv'] as Variant[]) {
    const r = await run(prep(card, 0.04, 0.03, 0.72, 0.1, v), '7')
    const n = pickNameToken(r.text)
    const title = Boolean(n && /^[A-Z][a-z]{3,}/.test(n))
    if (n && (title > best.title || (title === best.title && n.length > best.n.length))) {
      best = { n, conf: r.conf, title }
    }
  }
  return best.title ? best.n.length * Math.max(1, best.conf) : best.n.length * 0.2
}

/** Portrait crops stay portrait (0/180). Landscape card photos try 90/270. Never put a card on its side. */
async function detectUpright(source: Img, run: Engine): Promise<Img> {
  const landscape = source.width > source.height * 1.05
  const ks = landscape ? [1, 3] : [0, 2]
  let best = { k: ks[0], score: -1 }
  for (const k of ks) {
    const score = await scoreTopName(rotateK(source, k), run)
    if (score > best.score) best = { k, score }
  }
  if (!landscape && best.score < 30) return source
  return rotateK(source, best.k)
}

export async function runOcrPlan(
  source: Img,
  engine: Engine,
  totals?: Set<number>,
  onStage?: (s: 'name' | 'number' | 'fullart', partial: ScanQuery) => void
): Promise<ScanQuery & { passes: number }> {
  const raw: string[] = []
  let passes = 0
  const run: Engine = async (img, psm: Psm) => { passes++; const r = await engine(img, psm); if (r.text.trim()) raw.push(r.text.replace(/\s+/g, ' ').trim().slice(0, 200)); return r }

  const card = normalizeCard(await detectUpright(source, run))

  // Name: dark-on-light (gray/otsu), light-on-dark (white/otsuInv). Extra y for loose sleeve crops.
  const names: { n: string; conf: number }[] = []
  for (const v of ['gray', 'otsuInv', 'white'] as Variant[])
    for (const t of [0.03, 0.07, 0.12, 0.17]) {
      const r = await run(prep(card, 0.04, t, 0.72, 0.08, v), '7')
      const n = pickNameToken(r.text)
      if (n) names.push({ n, conf: r.conf * (n.length >= 4 ? 1 : 0.5) })
    }
  names.sort((a, b) => {
    const qa = /^[A-Z][a-z]{3,}/.test(a.n) ? 1 : 0
    const qb = /^[A-Z][a-z]{3,}/.test(b.n) ? 1 : 0
    return qb - qa || b.conf - a.conf || b.n.length - a.n.length
  })
  onStage?.('name', { name: names[0]?.n })

  const known = totals && totals.size ? totals : COMMON_TOTALS
  const reads: NumberRead[] = []
  for (const v of ['gray', 'otsu'] as Variant[])
    for (const t of [0.86, 0.9, 0.925, 0.94]) reads.push(...parseNumbers((await run(prep(card, 0, t, 1, 0.07, v), '11')).text, known))
  onStage?.('number', { name: names[0]?.n })

  const first = voteNumber(reads).pick as (NumberRead & { votes: number }) | undefined
  if (!first || first.votes < 2) {
    onStage?.('fullart', { name: names[0]?.n })
    const stage2Start = passes
    // number sits bottom-left over art on SV/SWSH full-arts & SIRs: tight boxes, 4-5x upscale
    outer: for (const t of [0.935, 0.945, 0.925])
      for (const [l, w] of [[0.12, 0.26], [0.02, 0.32]] as const)
        for (const v of ['white', 'otsu', 'otsuInv'] as Variant[])
          for (const psm of ['11', '7'] as Psm[]) {
            if (passes - stage2Start >= STAGE2_PASS_CAP) break outer
            reads.push(...parseNumbers((await run(prep(card, l, t, w, 0.04, v, 1800), psm)).text, known))
            const { pick } = voteNumber(reads)
            if (pick && (pick as NumberRead & { votes: number }).votes >= 2) break outer
          }
  }

  // HP (top-right) + attack/ability band: tie-break when the collector number is weak.
  let hp: string | undefined
  for (const v of ['gray', 'white', 'otsuInv'] as Variant[]) {
    for (const t of [0.02, 0.055]) {
      const r = await run(prep(card, 0.58, t, 0.38, 0.08, v, 800), '7')
      hp = hp || parseHp(r.text)
      if (hp) break
    }
    if (hp) break
  }
  const moveTexts: string[] = []
  for (const v of ['otsu', 'gray', 'otsuInv'] as Variant[]) {
    const r = await run(prep(card, 0.06, 0.42, 0.88, 0.42, v, 1200), '6')
    if (r.text.trim()) moveTexts.push(r.text.replace(/\s+/g, ' ').trim())
  }
  const attacks = Array.from(
    new Set(
      moveTexts.flatMap((text) =>
        (text.match(/\b[A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,2}\b/g) ?? []).map((s) => s.trim())
      )
    )
  )
    .filter((s) => s.length >= 5 && s.length <= 28 && !/^(Abilit|Energy|Pokemon|When|Your)/i.test(s))
    .slice(0, 6)

  const { pick, agreement, alts } = voteNumber(reads)
  let name = names[0]?.n
  if (!name || name.length < 5) {
    const fallback = nameTokens(raw.join(' ')).find((t) => t.length >= 6)
    if (fallback) name = fallback
  }
  return {
    name,
    number: pick?.number,
    total: pick?.total,
    kind: pick?.kind,
    setCode: pick?.setCode,
    alts,
    agreement,
    hp,
    attacks: attacks.length ? attacks : undefined,
    rawText: raw.slice(0, 24),
    passes,
  }
}
