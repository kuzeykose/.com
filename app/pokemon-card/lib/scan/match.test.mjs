import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQueries, scoreMatch } from './parse.ts'
import { STAGE2_PASS_CAP } from './ocrPlan.ts'

const BEST_THRESHOLD = 0.9

test('high name + number + total agreement is a single match', () => {
  const score = scoreMatch(
    { name: 'Pikachu', number: '25', printedTotal: 165 },
    { name: 'Pikachu', number: '25', total: '165', kind: 'std', agreement: 0.7 }
  )
  assert.ok(score >= BEST_THRESHOLD)
})

test('secret rares still rank when the number is above the set total', () => {
  const score = scoreMatch(
    { name: 'Zapdos ex', number: '201', printedTotal: 165 },
    { name: 'Zapdos', number: '201', total: '165', kind: 'std', agreement: 1 }
  )
  assert.ok(score >= 0.8)
})

test('promo queries search the promo set id and skip unscoped name fallbacks', () => {
  const queries = buildQueries({ name: 'Pikachu', number: '45', kind: 'promo', setCode: 'SVP' })
  assert.ok(queries.some((q) => q.includes('set.id:svp') && q.includes('number:45')))
  assert.ok(queries.some((q) => q.includes('number:SVP045')))
  assert.ok(!queries.includes('name:"Pikachu"'))
})

test('MEP promo queries lock to set.id:mep', () => {
  const queries = buildQueries({
    name: 'Clefable',
    number: '72',
    kind: 'promo',
    setCode: 'MEP',
  })
  assert.ok(queries.some((q) => q.startsWith('set.id:mep number:72')))
  assert.ok(queries.every((q) => !q.startsWith('name:')))
})

test('low name similarity stays below the single-match threshold', () => {
  const score = scoreMatch(
    { name: 'Bulbasaur', number: '1', printedTotal: 165 },
    { name: 'Pikachu', number: '25', total: '165', kind: 'std' }
  )
  assert.ok(score < BEST_THRESHOLD)
})

test('substring name still matches Mega Clefable ex', () => {
  const score = scoreMatch(
    { name: 'Mega Clefable ex', number: '31', printedTotal: 88 },
    { name: 'Clefable', number: '31', total: '88', kind: 'std', agreement: 0.7 }
  )
  assert.ok(score >= BEST_THRESHOLD)
})

test('HP and attack text tie-break when the number is missing', () => {
  const score = scoreMatch(
    {
      name: 'Chespin',
      number: '87',
      printedTotal: 86,
      hp: '70',
      attacks: [{ name: 'Spike Sting' }, { name: 'Beat' }],
    },
    { name: 'Chespin', hp: '70', attacks: ['Spike Sting'], rawText: ['Spike Sting', 'HP 70'] }
  )
  assert.ok(score >= 0.5)
})

test('MEP promo outranks the regular-set Mega Clefable ex', () => {
  const query = {
    name: 'Clefable',
    number: '72',
    kind: 'promo',
    setCode: 'MEP',
    hp: '320',
    attacks: ['Shooting Moons', 'Luminous Wing'],
    rawText: ['MEP EN 072', 'Luminous Wing', 'Shooting Moons'],
  }
  const promo = scoreMatch(
    {
      name: 'Mega Clefable ex',
      number: '72',
      setId: 'mep',
      hp: '320',
      attacks: [{ name: 'Shooting Moons' }],
      abilities: [{ name: 'Luminous Wing' }],
    },
    query
  )
  const regular = scoreMatch(
    {
      name: 'Mega Clefable ex',
      number: '31',
      printedTotal: 88,
      setId: 'me3',
      hp: '320',
      attacks: [{ name: 'Shooting Moons' }],
      abilities: [{ name: 'Luminous Wing' }],
    },
    query
  )
  assert.ok(promo > regular)
  assert.ok(promo >= BEST_THRESHOLD)
  assert.ok(regular < 0.6)
})

test('stage-2 full-art OCR stays capped at 24 passes', () => {
  assert.equal(STAGE2_PASS_CAP, 24)
})

test('matchScan promo lock returns mep-72 not me3-31', async () => {
  const { clearScanCache, matchScan } = await import('./match.ts')
  clearScanCache()
  const mep72 = {
    id: 'mep-72',
    name: 'Mega Clefable ex',
    number: '72',
    hp: '320',
    rarity: 'Promo',
    attacks: [{ name: 'Shooting Moons' }],
    abilities: [{ name: 'Luminous Wing' }],
    set: { id: 'mep', name: 'MEP Black Star Promos', printedTotal: 113 },
    images: {},
  }
  const me331 = {
    id: 'me3-31',
    name: 'Mega Clefable ex',
    number: '31',
    hp: '320',
    rarity: 'Double Rare',
    attacks: [{ name: 'Shooting Moons' }],
    abilities: [{ name: 'Luminous Wing' }],
    set: { id: 'me3', name: 'Perfect Order', printedTotal: 88 },
    images: {},
  }
  const orig = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = String(url)
    let data = []
    if (u.includes('/sets?')) {
      data = [
        { id: 'mep', name: 'MEP Black Star Promos', printedTotal: 113, total: 113 },
        { id: 'me3', name: 'Perfect Order', printedTotal: 88, total: 124 },
        { id: 'svp', name: 'Scarlet & Violet Black Star Promos', printedTotal: 215, total: 196 },
      ]
    } else if (u.includes('set.id:mep') && u.includes('number:72')) data = [mep72]
    else if (u.includes('name') && u.includes('Clef')) data = [me331, mep72]
    else if (u.includes('number:31')) data = [me331]
    const body = { data }
    return { ok: true, status: 200, json: async () => body }
  }
  try {
    const result = await matchScan({
      name: 'Clefable',
      number: '72',
      kind: 'promo',
      setCode: 'MEP',
      hp: '320',
      attacks: ['Shooting Moons'],
      agreement: 0.8,
      rawText: ['MEP EN 072', 'Mega Clefable', 'Luminous Wing'],
    })
    assert.equal(result.best?.id, 'mep-72')
    assert.equal(result.best?.setId, 'mep')
    assert.equal(result.best?.number, '72')
    assert.ok(result.confidence >= 0.9)
    assert.ok(result.candidates.every((c) => c.id !== 'me3-31'))
  } finally {
    globalThis.fetch = orig
    clearScanCache()
  }
})
