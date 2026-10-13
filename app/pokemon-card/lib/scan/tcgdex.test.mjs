import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCardById } from '../tcg.ts'
import {
  canonicalCardId,
  cardIdVariants,
  clearTcgdexCache,
  fetchTcgdexCard,
  fetchTcgdexPromo,
  toTcgdexId,
} from '../tcgdex.ts'
import { quoteFor } from '../prices.ts'
import { BEST_THRESHOLD, clearScanCache, matchScan } from './match.ts'
import { distinctiveMatch, scoreMatch } from './parse.ts'

test('canonical ids use native padded TCGdex ids', () => {
  assert.equal(canonicalCardId('mep', '072'), 'mep-072')
  assert.equal(canonicalCardId('mep', '72'), 'mep-072')
  assert.equal(canonicalCardId('me4', '87'), 'me04-087')
  assert.ok(cardIdVariants('mep-72').includes('mep-072'))
  assert.ok(cardIdVariants('mep-072').includes('mep-72'))
})

test('legacy pokemontcg.io collection ids map to TCGdex', () => {
  assert.equal(toTcgdexId('sv8-40'), 'sv08-040')
  assert.equal(toTcgdexId('sv8pt5-30'), 'sv08.5-030')
  assert.equal(toTcgdexId('swsh9-29'), 'swsh9-029')
  assert.equal(toTcgdexId('dp1-1'), 'dp1-1')
  assert.equal(toTcgdexId('me4-87'), 'me04-087')
  assert.equal(toTcgdexId('mep-72'), 'mep-072')
})

test('live TCGdex has MEP 072 Mega Clefable ex with an image', { timeout: 30_000 }, async () => {
  clearTcgdexCache()
  const card = await fetchTcgdexPromo('mep', '72')
  assert.ok(card, 'TCGdex returned no mep-072')
  assert.equal(card.id, 'mep-072')
  assert.equal(card.set.id, 'mep')
  assert.equal(String(Number(card.number)), '72')
  assert.match(card.name, /mega clefable ex/i)
  assert.equal(card.hp, '320')
  assert.equal(card.source, 'tcgdex')
  assert.ok(card.images?.small, 'no small image')
  assert.ok(card.images?.large, 'no large image')
  assert.equal(card.tcgplayer, undefined)

  const res = await fetch(card.images.small, { method: 'HEAD' })
  assert.equal(res.ok, true, `image HEAD ${res.status} ${card.images.small}`)
})

test('fetchCardById uses live TCGdex for mep-72 and mep-072', { timeout: 30_000 }, async () => {
  const padded = await fetchCardById('mep-072')
  const legacy = await fetchCardById('mep-72')
  assert.ok(padded)
  assert.equal(padded.id, 'mep-072')
  assert.equal(padded.source, 'tcgdex')
  assert.match(padded.name, /clefable/i)
  assert.ok(padded.images?.small)
  assert.equal(legacy?.id, 'mep-072')
})

test('live matchScan promo lock returns mep-072 from TCGdex, not me03-031', { timeout: 120_000 }, async () => {
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
  assert.equal(picked.id, 'mep-072')
  assert.equal(picked.setId, 'mep')
  assert.equal(String(Number(picked.number)), '72')
  assert.equal(picked.source, 'tcgdex')
  assert.ok(picked.image)
  assert.ok(result.confidence >= BEST_THRESHOLD)
  assert.equal(result.best?.id, 'mep-072')
  assert.ok(result.candidates.every((c) => c.id !== 'me03-031' && c.setId === 'mep'))
})

test('fetchTcgdexCard accepts unpadded MEP ids', { timeout: 20_000 }, async () => {
  const card = await fetchTcgdexCard('mep-72')
  assert.equal(card?.id, 'mep-072')
})

test('promo catalog snapshot has an image; USD price unknown when tcgplayer is empty', { timeout: 20_000 }, async () => {
  const card = await fetchTcgdexPromo('mep', '72')
  assert.ok(card)
  const quote = quoteFor(card)
  assert.equal(card.set.id, 'mep')
  assert.equal(String(Number(card.number)), '72')
  assert.ok(card.images?.small)
  if (card.tcgplayer) {
    assert.ok(quote.market != null)
    assert.equal(quote.unit, 'USD')
  } else if (card.cardmarket?.avg != null) {
    assert.equal(quote.market, card.cardmarket.avg)
    assert.equal(quote.unit, 'EUR')
  } else {
    assert.equal(quote.market, null)
  }
})

test('live Kuzey cards resolve on TCGdex with images', { timeout: 60_000 }, async () => {
  clearTcgdexCache()
  const expected = [
    { id: 'me04-087', name: /chespin/i },
    { id: 'me03-031', name: /clefable/i },
    { id: 'me03-006', name: /serperior/i },
    { id: 'mep-072', name: /clefable/i },
  ]
  for (const spec of expected) {
    const card = await fetchTcgdexCard(spec.id)
    assert.ok(card, `missing ${spec.id}`)
    assert.equal(card.id, spec.id)
    assert.match(card.name, spec.name)
    assert.ok(card.images?.small, `${spec.id} missing image`)
  }
})

test('distinctive number+total+attack can auto-pick without a clean name', () => {
  const card = {
    name: 'Chespin',
    number: '087',
    printedTotal: 86,
    setId: 'me04',
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
