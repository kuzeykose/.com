export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
export type Condition = (typeof CONDITIONS)[number]

export type PriceUnit = 'USD' | 'EUR'

export type CatalogSnapshot = {
  name: string
  number: string
  rarity?: string
  types?: string[]
  setId?: string
  setName?: string
  printedTotal?: number
  image?: string
  imageLarge?: string
  market?: number
  currency?: PriceUnit
  variant?: string
  updatedAt?: string
}

export type CollectionEntry = {
  id: string
  quantity: number
  condition: Condition
  printing?: string
  notes?: string
  added: string
  catalog?: CatalogSnapshot
}

export type CollectionFile = {
  cards: CollectionEntry[]
}

export type TcgPrice = {
  low?: number
  mid?: number
  high?: number
  market?: number
  directLow?: number
}

export type TcgAttack = {
  name: string
  damage?: string
  text?: string
}

export type TcgAbility = {
  name: string
  text?: string
}

export type TcgCard = {
  id: string
  name: string
  number: string
  hp?: string
  rarity?: string
  types?: string[]
  attacks?: TcgAttack[]
  abilities?: TcgAbility[]
  images?: {
    small?: string
    large?: string
  }
  set: {
    id: string
    name: string
    printedTotal?: number
    series?: string
    releaseDate?: string
  }
  tcgplayer?: {
    url?: string
    updatedAt?: string
    prices?: Record<string, TcgPrice>
  }
  cardmarket?: {
    unit?: string
    avg?: number
    updatedAt?: string
  }
  source?: 'tcgdex'
}

export type TcgSet = {
  id: string
  name: string
  printedTotal?: number
  releaseDate?: string
  series?: string
}

export type MarketQuote = {
  market: number | null
  variant: string | null
  updatedAt: string | null
  unit?: PriceUnit | null
}

export type EnrichedCard = CollectionEntry & {
  tcg: TcgCard | null
  quote: MarketQuote
}

export type SearchCard = {
  id: string
  name: string
  number: string
  rarity?: string
  types?: string[]
  setName: string
  setId: string
  printedTotal?: number
  image?: string
  printings: string[]
  quotes: Record<string, number>
  quoteUnit?: PriceUnit
  updatedAt: string | null
}
