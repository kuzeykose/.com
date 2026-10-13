import type { NumberRead, ScanQuery } from './types'

const STOP =
  /^(basic|stage|evolves|from|hp|put|on|the|v|ex|gx|vmax|vstar|trainer|gallery|luminous|shooting|moons|command|coiling|encouragement|prevent|discard|resistance|retreat|weakness|forest|nintendo|creatures)$/i

export function levenshtein(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = next
    }
  }
  return d[b.length]
}

export function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function nameSim(a: string, b: string) {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return 0
  const words = [right, ...right.split(/(?=ex$|vstar$|vmax$|gx$)/)]
  let best = Math.max(
    ...words.map((word) => 1 - levenshtein(left, word) / Math.max(left.length, word.length)),
    right.startsWith(left) && left.length >= 4 ? 0.95 : 0
  )
  // "Clefable" vs "Mega Clefable ex", "Mega" vs "Mega Clefable ex"
  if (left.length >= 4 && right.includes(left)) best = Math.max(best, 0.9)
  if (right.length >= 4 && left.includes(right)) best = Math.max(best, 0.85)
  return best
}

function nameQuality(word: string) {
  if (/^[A-Z][a-z]{3,}(?:[A-Z][a-z]+)?$/.test(word)) return 3
  if (/^[A-Z][a-z]{2,}/.test(word) && word.length >= 5) return 2
  if (word.length >= 6) return 1
  return 0
}

export function pickNameToken(text: string) {
  return text
    .replace(/[^A-Za-z'.\-é ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.test(word))
    .sort((a, b) => nameQuality(b) - nameQuality(a) || b.length - a.length)[0]
}

/**
 * Parse one OCR'd bottom strip. `totals` = known set.printedTotal values
 * used to trim trailing junk ("42/1460" -> 42/146) and to repair "/"
 * misread as 7 or 1 ("2017165" -> 201/165).
 */
export function parseNumbers(text: string, totals?: Set<number>): NumberRead[] {
  const cleaned = text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/(?<=\d)[Zz]|[Zz](?=\d)/g, '2')
    .replace(/\s*\/\s*/g, '/')
    .replace(/G\s+G/g, 'GG')

  const okTotal = (value: string) => !totals || totals.has(Number(value))
  const out: NumberRead[] = []

  for (const match of Array.from(cleaned.matchAll(/(TG|1G|GG)\s?(\d{2})\/(?:TG|1G|GG)?\s?(\d{2})/gi))) {
    out.push({
      number: match[1].toUpperCase().replace('1G', 'TG') + match[2],
      total: String(Number(match[3])),
      kind: 'subset',
    })
  }

  const pushStd = (number: string, total: string) => {
    for (const len of [3, 2]) {
      const next = total.slice(0, len)
      if (next.length === len && okTotal(next)) {
        out.push({ number: String(Number(number)), total: String(Number(next)), kind: 'std' })
        return
      }
    }
  }

  for (const match of Array.from(cleaned.matchAll(/(?<![A-Z\d])(\d{1,3})\/(\d{2,4})/gi))) {
    pushStd(match[1], match[2])
  }
  if (!out.length && totals) {
    // "/" misread as 7, 1 or 4, often with stray "," "." "%" (full-art italics): "1997,165" -> 199/165, "2564193" -> 256/193.
    // Scan digit runs for <n:1-3><sep><total:2-3>, keep only known totals and plausible n (<= 1.6 x total).
    for (const run of cleaned.replace(/(?<=\d)[,.%'](?=\d)/g, '').match(/\d{5,}/g) ?? []) {
      const found: NumberRead[] = []
      for (let i = 0; i < run.length; i++) {
        for (const nl of [3, 2, 1]) {
          const sep = run[i + nl]
          if (sep !== '7' && sep !== '1' && sep !== '4') continue
          for (const tl of [3, 2]) {
            const n = run.slice(i, i + nl), t = run.slice(i + nl + 1, i + nl + 1 + tl)
            if (n.length !== nl || t.length !== tl) continue
            if (totals.has(Number(t)) && Number(t) >= 10 && Number(n) >= 1 && Number(n) <= Number(t) * 1.6) {
              found.push({ number: String(Number(n)), total: String(Number(t)), kind: 'std' })
            }
          }
        }
      }
      // keep only the longest-number window(s) of a run (avoid "99/165" from "1997165")
      const maxLen = Math.max(0, ...found.map((r) => r.number.length))
      out.push(...found.filter((r) => r.number.length === maxLen).slice(0, 1))
    }
  }
  // Promo codes: "MEP EN 072", "SVP 045", "SWSH020", plus 1-edit OCR ("JEN 72").
  // Regular "POR EN 031/088" still wins via std matches above.
  for (const match of Array.from(
    cleaned.matchAll(/(?<![A-Z])([A-Z]{3}|MEP|SVP|SWSH|SM|XY|BW|DP|HGSS)(?:\s*EN)?\s*-?\s*(\d{1,3})(?!\d)/gi)
  )) {
    const rawCode = match[1].toUpperCase()
    const setCode = PROMO_SET_ID[rawCode] ? rawCode : PROMO_ALIAS[rawCode]
    if (!setCode) continue
    out.push({
      number: String(Number(match[2])),
      setCode,
      kind: 'promo',
    })
  }
  if (!out.length) {
    for (const match of Array.from(cleaned.matchAll(/\b(SVP|SWSH|SM|XY|BW|DP|HGSS)\s?-?(\d{1,3})\b/gi))) {
      out.push({
        number: match[1].toUpperCase() + match[2].padStart(3, '0'),
        setCode: match[1].toUpperCase(),
        kind: 'promo',
      })
    }
  }

  return out
}

/** Black Star promo set ids on pokemontcg.io (MEP may land after the live set list). */
export const PROMO_SET_ID: Record<string, string> = {
  MEP: 'mep',
  SVP: 'svp',
  SWSH: 'swshp',
  SM: 'smp',
  XY: 'xyp',
  BW: 'bwp',
  DP: 'dpp',
  HGSS: 'hsp',
}

/** OCR aliases seen on sleeved Mega Evolution promo stamps (MEP EN 072 → JEN 72). */
const PROMO_ALIAS: Record<string, string> = {
  JEN: 'MEP',
  NEP: 'MEP',
  MEN: 'MEP',
  MFP: 'MEP',
  MEF: 'MEP',
  '5VP': 'SVP',
  SYP: 'SVP',
}

export const COMMON_TOTALS = new Set([86, 88, 94, 102, 108, 132, 146, 159, 165, 193, 198, 202, 215])

export const PROMO_SET_IDS = Array.from(new Set(Object.values(PROMO_SET_ID)))

export function splitPromo(number: string, setCode?: string) {
  const prefixed = number.match(/^(MEP|SVP|SWSH|SM|XY|BW|DP|HGSS)(\d+)$/i)
  const code = (setCode || prefixed?.[1] || '').toUpperCase()
  const digits = prefixed ? prefixed[2] : /^\d+$/.test(number) ? number : ''
  const n = digits ? String(Number(digits)) : number
  return { setCode: code || undefined, n, setId: code ? PROMO_SET_ID[code] || code.toLowerCase() : undefined }
}

export function voteNumber(reads: NumberRead[]) {
  const tally = new Map<string, NumberRead & { votes: number }>()
  for (const read of reads) {
    const key = `${read.kind}|${read.setCode ?? ''}|${read.number}|${read.total ?? ''}`
    const existing = tally.get(key) ?? { ...read, votes: 0 }
    existing.votes += 1
    if (read.setCode && !existing.setCode) existing.setCode = read.setCode
    tally.set(key, existing)
  }

  // A dropped leading digit ("99/165" vs "199/165") supports the longer secret-rare.
  // Do not credit "16/88" from "6/88" — that OCR error is the other direction.
  const rows = Array.from(tally.values())
  for (const long of rows) for (const short of rows)
    if (long !== short && long.kind === 'std' && short.kind === 'std' && long.total === short.total &&
        long.number.length === 3 && short.number.length === 2 &&
        long.number.endsWith(short.number) && Number(long.number) > Number(long.total)) long.votes += short.votes

  const plausible = (read: NumberRead) =>
    read.kind !== 'std' ||
    (Number(read.number) >= 1 &&
      Number(read.number) <= Number(read.total) * 1.6 &&
      Number(read.total) >= 10)

  const ranked = Array.from(tally.values())
    .filter(plausible)
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        (a.kind === 'promo' ? 1 : 0) - (b.kind === 'promo' ? 1 : 0) ||
        b.number.length - a.number.length
    )

  return {
    pick: ranked[0],
    agreement: ranked[0] ? ranked[0].votes / reads.length : 0,
    alts: ranked.slice(1, 3),
  }
}

export function readsFromQuery(query: ScanQuery): NumberRead[] {
  const primary = query.number
    ? {
        number: query.number,
        total: query.total,
        kind: query.kind ?? (query.setCode || !query.total ? 'promo' : 'std'),
        setCode: query.setCode,
      }
    : undefined
  return [primary, ...(query.alts ?? [])].filter((read): read is NumberRead => Boolean(read?.number))
}

export function buildQueries(query: ScanQuery): string[] {
  const name = query.name
  const tries: string[] = []
  const promoLock = Boolean(query.setCode || query.kind === 'promo')
  for (const candidate of readsFromQuery(query)) {
    const promo = splitPromo(candidate.number, candidate.setCode || query.setCode)
    if (candidate.kind === 'promo' || promo.setId) {
      const n = promo.n
      const padded = /^\d+$/.test(n) ? n.padStart(3, '0') : n
      const combined = promo.setCode ? `${promo.setCode}${padded}` : candidate.number
      if (promo.setId) {
        if (name) tries.push(`set.id:${promo.setId} number:${n} name:"${name}*"`)
        tries.push(`set.id:${promo.setId} number:${n}`)
        if (padded !== n) tries.push(`set.id:${promo.setId} number:${padded}`)
      }
      if (name) tries.push(`number:${combined} name:"${name}*"`)
      tries.push(`number:${combined}`)
      if (n !== combined && name) tries.push(`number:${n} name:"${name}*"`)
    } else if (candidate.kind !== 'std') {
      if (name) tries.push(`number:${candidate.number} name:"${name}*"`)
      tries.push(`number:${candidate.number}`)
    } else {
      if (name) {
        tries.push(`number:${candidate.number} set.printedTotal:${candidate.total} name:"${name}*"`)
      }
      tries.push(`number:${candidate.number} set.printedTotal:${candidate.total}`)
      if (name) tries.push(`number:${candidate.number} name:"${name}*"`)
    }
  }
  // Unscoped name search would collapse a promo (MEP 072) onto the regular-set printing.
  if (name && !promoLock) tries.push(`name:"${name}"`, `name:${name.slice(0, 4)}*`)
  return Array.from(new Set(tries))
}

function numbersEqual(cardNumber: string, pick: NumberRead) {
  if (cardNumber.toUpperCase() === pick.number.toUpperCase()) return true
  const promo = splitPromo(pick.number, pick.setCode)
  if (/^\d+$/.test(cardNumber) && /^\d+$/.test(promo.n) && Number(cardNumber) === Number(promo.n)) return true
  if (promo.setCode) {
    const combined = `${promo.setCode}${promo.n.padStart(3, '0')}`
    if (cardNumber.toUpperCase() === combined) return true
    if (cardNumber.toUpperCase() === `${promo.setCode}${promo.n}`) return true
  }
  return false
}

function blobOf(query: ScanQuery) {
  return [query.rawText?.join(' '), ...(query.attacks ?? []), ...(query.abilities ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export type ScoreCard = {
  name: string
  number: string
  printedTotal?: number
  hp?: string
  attacks?: { name?: string }[]
  abilities?: { name?: string }[]
  setId?: string
  rarity?: string
}

export function matchSignals(card: ScoreCard, query: ScanQuery) {
  const pick = readsFromQuery(query)[0]
  const name = query.name
  const agreement = query.agreement ?? 0
  const similarity = name ? nameSim(name, card.name) : 0
  const numberOk = Boolean(pick && numbersEqual(card.number, pick))
  const totalOk =
    pick && pick.kind !== 'std' ? numberOk : Boolean(pick && String(card.printedTotal) === pick.total)
  const promo = pick ? splitPromo(pick.number, pick.setCode || query.setCode) : { setId: undefined, setCode: query.setCode }
  const setOk = Boolean(promo.setId && card.setId && card.setId.toLowerCase() === promo.setId)
  const hpOk = Boolean(query.hp && card.hp && String(query.hp) === String(card.hp))
  const blob = blobOf(query)
  const moveOk = [...(card.attacks ?? []), ...(card.abilities ?? [])].some(
    (row) => row.name && blob.includes(row.name.toLowerCase())
  )
  return { pick, promo, agreement, similarity, numberOk, totalOk, setOk, hpOk, moveOk }
}

/** Number+set/total plus HP, attack, or a decent name — unique enough to auto-pick. */
export function distinctiveMatch(card: ScoreCard, query: ScanQuery) {
  const s = matchSignals(card, query)
  const uniquePrint = s.numberOk && (s.totalOk || s.setOk)
  const corroboration = s.hpOk || s.moveOk || s.similarity >= 0.75
  return uniquePrint && corroboration
}

export function scoreMatch(card: ScoreCard, query: ScanQuery) {
  const s = matchSignals(card, query)
  let score = 0.1 + 0.25 * s.similarity
  if (s.numberOk) score += 0.25
  if (s.numberOk && s.totalOk) score += 0.2
  if (s.numberOk && s.totalOk && s.similarity >= 0.8) score += 0.1
  if (s.numberOk && s.totalOk && s.agreement >= 0.5) score += 0.05
  if (s.setOk) score += 0.15
  if (s.hpOk) score += 0.08
  if (s.moveOk) score += 0.08
  // Exact printing + HP/attack is enough even when the name OCR is junk.
  if (s.numberOk && (s.totalOk || s.setOk) && (s.hpOk || s.moveOk)) score += 0.18
  // Number OCR weak: HP / attack / ability still separates Chespin vs Serperior vs Clefable.
  if (!s.numberOk && s.similarity >= 0.8 && (s.hpOk || s.moveOk)) score += 0.12
  // Promo lock: a regular-set printing of the same Pokémon must not outrank the promo.
  if (s.promo.setId && card.setId && card.setId.toLowerCase() !== s.promo.setId) score -= 0.45
  return Number(Math.min(1, Math.max(0, score)).toFixed(3))
}

export function parseHp(text: string): string | undefined {
  const cleaned = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
  const tagged = cleaned.match(/\bHP\s*[:.]?\s*(\d{2,3})\b/i)
  const lone = tagged ? tagged[1] : cleaned.match(/\b(\d{2,3})\b/)?.[1]
  if (!lone) return undefined
  const n = Number(lone)
  if (n >= 30 && n <= 400) return String(n)
  return undefined
}

const NOISE = /^(pok[eé]mon|rule|when|your|knocked|opponent|takes|prize|cards?|illus|nintendo|creatures|game|freak|weakness|resistance|retreat|ability|damage|attack|this|that|energy|card|turn)$/i

/** All plausible name tokens in a line, longest first (for fallbacks). */
export function nameTokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .replace(/[^A-Za-z'.\-é ]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
        .filter((w) => w.length >= 4 && !STOP.test(w) && !NOISE.test(w))
    )
  ).sort((a, b) => b.length - a.length)
}

/** Lenient number scan of raw text: any "a/b", subset, promo, else lone 1-3 digit groups. */
export function parseRawText(lines: string[], totals?: Set<number>) {
  const reads: NumberRead[] = []
  const names: string[] = []
  const loose: string[] = []
  const joined = lines.join(' ')
  for (const line of [...lines, joined]) {
    reads.push(...parseNumbers(line, totals))
    names.push(...nameTokens(line))
    for (const m of Array.from(line.matchAll(/(?<![\d/])(\d{2,3})(?![\d/])/g))) loose.push(String(Number(m[1])))
  }
  return { reads, names: Array.from(new Set(names)), loose: Array.from(new Set(loose)).slice(0, 4) }
}

/** Best fuzzy matches of an OCR token against a list of real names. */
export function fuzzyNames(token: string, names: Iterable<string>, limit = 5, min = 0.55) {
  const out: { name: string; sim: number }[] = []
  for (const name of Array.from(names)) {
    const sim = nameSim(token, name)
    if (sim >= min) out.push({ name, sim })
  }
  return out.sort((a, b) => b.sim - a.sim).slice(0, limit)
}
