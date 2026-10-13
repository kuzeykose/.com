/** One distinct printing (pokemontcg.io-style `{setId}-{number}`, unpadded). */
export type Match = {
  id: string
  name: string
  number: string
  set: string
  setId: string
  printedTotal: number
  rarity?: string
  image?: string
  imageLarge?: string
  score: number
  types?: string[]
  printings?: string[]
  quotes?: Record<string, number>
  updatedAt?: string | null
  source?: 'pokemontcg' | 'tcgdex'
}

/**
 * best: SUGGESTION only, set only when confidence >= 0.9.
 * The user ALWAYS confirms/picks the printing from `candidates`
 * (best, if set, is candidates[0]).
 * candidates: distinct printings, highest score first (<= 8).
 * Scope: one card per photo, English cards only.
 * Photos are processed in memory and never stored.
 */
export type ScanResult = {
  best: Match | null
  candidates: Match[]
  confidence: number
  ocr: { name?: string; number?: string; total?: string }
  query?: string
  /** Which stage produced candidates: 'exact' | 'set-total' | 'fuzzy-name' | 'number-only' | 'raw-text' | 'tcgdex' | 'none' */
  stage?: string
}

export type RecognizeOptions = {
  apiKey?: string
}

/** Parsed OCR fields the browser POSTs. The API never receives a photo. */
export type ScanQuery = {
  name?: string
  number?: string
  total?: string
  kind?: NumberRead['kind']
  /** Promo set prefix from the card (MEP, SVP, SWSH, …), when OCR saw one. */
  setCode?: string
  alts?: NumberRead[]
  agreement?: number
  hp?: string
  attacks?: string[]
  abilities?: string[]
  /** Raw OCR lines (name band + number strips), used only for server fallbacks. Text only, never pixels. Max 24 x 200 chars. */
  rawText?: string[]
}

export type NumberRead = {
  number: string
  total?: string
  kind: 'std' | 'subset' | 'promo'
  /** MEP / SVP / SWSH / … when the read is a Black Star promo code. */
  setCode?: string
  votes?: number
}
