import { PRINTING_ORDER } from './constants'
import type { MarketQuote, PriceUnit, TcgCard } from './types'

export function quoteFor(card: TcgCard | null | undefined, preferred?: string | null): MarketQuote {
  const prices = card?.tcgplayer?.prices ?? {}
  const updatedAt = card?.tcgplayer?.updatedAt ?? null

  if (preferred && preferred !== 'cardmarket' && prices[preferred]?.market != null) {
    return { market: prices[preferred].market ?? null, variant: preferred, updatedAt, unit: 'USD' }
  }

  for (const key of PRINTING_ORDER) {
    const market = prices[key]?.market
    if (market != null) {
      return { market, variant: key, updatedAt, unit: 'USD' }
    }
  }

  for (const [key, value] of Object.entries(prices)) {
    if (value?.market != null) {
      return { market: value.market, variant: key, updatedAt, unit: 'USD' }
    }
  }

  if (card?.cardmarket?.avg != null) {
    return {
      market: card.cardmarket.avg,
      variant: 'cardmarket',
      updatedAt: card.cardmarket.updatedAt ?? null,
      unit: 'EUR',
    }
  }

  return { market: null, variant: preferred ?? null, updatedAt, unit: null }
}

export function availablePrintings(card: TcgCard | null | undefined) {
  const prices = card?.tcgplayer?.prices ?? {}
  const keys = Object.keys(prices)
  if (keys.length) {
    const ranked = PRINTING_ORDER.filter((key) => keys.includes(key))
    const extra = keys.filter((key) => !PRINTING_ORDER.includes(key))
    return [...ranked, ...extra]
  }
  if (card?.cardmarket?.avg != null) return ['cardmarket']
  return []
}

export function usdMarket(quote: { market: number | null; unit?: string | null } | null | undefined) {
  if (quote?.market == null) return null
  if (quote.unit && quote.unit !== 'USD') return null
  return quote.market
}

export function lineValue(quantity: number, market: number | null, unit?: PriceUnit | null) {
  if (market == null) return null
  if (unit && unit !== 'USD') return null
  return market * quantity
}
