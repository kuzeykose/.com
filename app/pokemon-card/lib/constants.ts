export const TYPE_COLORS: Record<string, string> = {
  Grass: '#4ADE80',
  Fire: '#F97316',
  Water: '#38BDF8',
  Lightning: '#FACC15',
  Psychic: '#C084FC',
  Fighting: '#D97706',
  Darkness: '#64748B',
  Metal: '#D4D4D8',
  Dragon: '#A3A33A',
  Fairy: '#F9A8D4',
  Colorless: '#A3A3A3',
}

export const CONDITION_LABELS: Record<string, string> = {
  NM: 'Near Mint (NM)',
  LP: 'Lightly Played (LP)',
  MP: 'Moderately Played (MP)',
  HP: 'Heavily Played (HP)',
  DMG: 'Damaged (DMG)',
}

export const PRINTING_LABELS: Record<string, string> = {
  holofoil: 'Holofoil',
  reverseHolofoil: 'Reverse holo',
  normal: 'Normal',
  '1stEditionHolofoil': '1st edition holo',
  '1stEditionNormal': '1st edition',
  unlimitedHolofoil: 'Unlimited holo',
  unlimited: 'Unlimited',
  cardmarket: 'Cardmarket',
}

export const PRINTING_ORDER = [
  'holofoil',
  'reverseHolofoil',
  'normal',
  '1stEditionHolofoil',
  '1stEditionNormal',
  'unlimitedHolofoil',
  'unlimited',
]

export const TCGDEX_API = 'https://api.tcgdex.net/v2/en'
export const PRICE_REVALIDATE = 86400

const RARITY_RANKS: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  promo: 2,
  'black white rare': 2,
  'holo rare': 3,
  'rare holo': 3,
  'rare holo v': 4,
  'holo rare v': 4,
  'double rare': 4,
  'ace spec rare': 4,
  'shiny rare': 5,
  'ultra rare': 5,
  'rare ultra': 5,
  'holo rare vmax': 5,
  'holo rare vstar': 5,
  'illustration rare': 6,
  'shiny ultra rare': 6,
  'secret rare': 7,
  'rare secret': 7,
  'special illustration rare': 7,
  'rare rainbow': 7,
  'hyper rare': 8,
  'mega hyper rare': 9,
}

/** Higher is rarer. Unknown rarities sit just above Rare. */
export function rarityRank(rarity?: string | null) {
  if (!rarity) return -1
  return RARITY_RANKS[rarity.trim().toLowerCase()] ?? 2.5
}
