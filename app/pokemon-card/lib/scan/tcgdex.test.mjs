import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCardById } from '../tcg.ts'
import {
  canonicalCardId,
  cardIdVariants,
  clearTcgdexCache,
  fetchTcgdexCard,
  fetchTcgdexPromo,
} from '../tcgdex.ts'
import { catalogFromCard } from '../collection.ts'
import { BEST_THRESHOLD, clearScanCache, matchScan } from './match.ts'
import { distinctiveMatch, scoreMatch } from './parse.ts'

test('canonical ids strip promo padding to pokemontcg.io style', () => {
  assert.equal(canonicalCardId('mep', '072'), 'mep-72')
  assert.equal(canonicalCardId('mep', '72'), 'mep-72')
  assert.ok(cardIdVariants('mep-72').includes('mep-072'))
  assert.ok(cardIdVariants('mep-072').includes('mep-72'))
})

test('live TCGdex has MEP 072 Mega Clefable ex with an image', { timeout: 30_000 }, async () => {
  clearTcgdexCache()
  const card = await fetchTcgdexPromo('mep', '72')
  assert.ok(card, 'TCGdex returned no mep-72')
  assert.equal(card.id, 'mep-72')
  assert.equal(card.set.id, 'mep')
  assert.equal(card.number, '72')
  assert.match(card.name, /mega clefable ex/i)
  assert.equal(card.hp, '320')
  assert.equal(card.source, 'tcgdex')
  assert.ok(card.images?.small, 'no small image')
  assert.ok(card.images?.large, 'no large image')
  assert.equal(card.tcgplayer, undefined)

  const res = await fetch(card.images.small, { method: 'HEAD' })
  assert.equal(res.ok, true, `image HEAD ${res.status} ${card.images.small}`)
})

test('fetchCardById falls back to live TCGdex for mep-72', { timeout: 30_000 }, async () => {
  const card = await fetchCardById('mep-72')
  assert.ok(card)
  assert.equal(card.id, 'mep-72')
  assert.equal(card.source, 'tcgdex')
  assert.match(card.name, /clefable/i)
  assert.ok(card.images?.small)
})

test('live matchScan promo lock returns mep-72 from TCGdex, not me3-31', { timeout: 120_000 }, async () => {
  clearScanCache()
  clearTcgdexCache()
  const result = await matchScan({
    name: 'Clefable',
    number: '72',
    kind: 'promo',
    setCode: 'MEP',
    hp: '320',
    attacks: ['Shooting Moons'],
    abilities: ['Luminous Wing'],
    agreement: 0.8,
    rawText: ['MEP EN 072', 'Mega Clefable', 'Luminous Wing', 'Shooting Moons'],
  })
  const picked = result.best || result.candidates[0]
  assert.ok(picked, JSON.stringify(result))
  assert.equal(picked.id, 'mep-72')
  assert.equal(picked.setId, 'mep')
  assert.equal(String(Number(picked.number)), '72')
  assert.equal(picked.source, 'tcgdex')
  assert.ok(picked.image)
  assert.ok(result.confidence >= BEST_THRESHOLD)
  assert.equal(result.best?.id, 'mep-72')
  assert.ok(result.candidates.every((c) => c.id !== 'me3-31' && c.setId === 'mep'))
  assert.deepEqual(picked.quotes ?? {}, {})
})

test('fetchTcgdexCard accepts padded MEP ids', { timeout: 20_000 }, async () => {
  const card = await fetchTcgdexCard('mep-072')
  assert.equal(card?.id, 'mep-72')
})

test('fallback catalog snapshot has an image and unknown USD price', { timeout: 20_000 }, async () => {
  const card = await fetchTcgdexPromo('mep', '72')
  assert.ok(card)
  const catalog = catalogFromCard(card)
  assert.equal(catalog.setId, 'mep')
  assert.equal(catalog.number, '72')
  assert.equal(catalog.market, undefined)
  assert.ok(catalog.image)
})

test('distinctive number+total+attack can auto-pick without a clean name', () => {
  const card = {
    name: 'Chespin',
    number: '87',
    printedTotal: 86,
    setId: 'me4',
    hp: '70',
    attacks: [{ name: 'Spike Sting' }],
  }
  const query = {
    name: 'Boikelicing',
    number: '87',
    total: '86',
    kind: 'std',
    hp: '70',
    attacks: ['Spike Sting'],
    rawText: ['Spike Sting', 'HP 70', '87/86'],
    agreement: 1,
  }
  assert.equal(distinctiveMatch(card, query), true)
  assert.ok(scoreMatch(card, query) >= 0.9)
  const other = scoreMatch({ name: 'Gimmighoul', number: '87', printedTotal: 162, setId: 'rsv10pt5' }, query)
  assert.ok(other < 0.6)
})
