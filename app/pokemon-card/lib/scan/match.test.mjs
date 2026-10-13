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

function tcgdexPayload(card) {
  return {
    id: card.id,
    localId: card.number,
    name: card.name,
    hp: card.hp,
    rarity: card.rarity,
    attacks: card.attacks,
    abilities: card.abilities,
    set: {
      id: card.set.id,
      name: card.set.name,
      cardCount: { official: card.set.printedTotal, total: card.set.printedTotal },
    },
  }
}

function mockTcgdex({ sets, cards }) {
  return async (url) => {
    const u = decodeURIComponent(String(url))
    const inSet = u.match(/\/sets\/([^/?]+)\/([^/?]+)/)
    if (inSet) {
      const card = cards.find(
        (row) =>
          row.set.id === inSet[1] &&
          (String(row.number) === inSet[2] || String(Number(row.number)) === String(Number(inSet[2])))
      )
      return card
        ? { ok: true, status: 200, json: async () => tcgdexPayload(card) }
        : { ok: false, status: 404, json: async () => ({}) }
    }
    if (/\/v2\/en\/sets\/?(\?|$)/.test(u) || u.endsWith('/v2/en/sets')) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          sets.map((row) => ({
            id: row.id,
            name: row.name,
            cardCount: { official: row.printedTotal, total: row.total ?? row.printedTotal },
          })),
      }
    }
    const byId = u.match(/\/cards\/([^/?]+)$/)
    if (byId) {
      const card = cards.find((row) => row.id === byId[1])
      return card
        ? { ok: true, status: 200, json: async () => tcgdexPayload(card) }
        : { ok: false, status: 404, json: async () => ({}) }
    }
    if (u.includes('/cards?')) {
      const set = u.match(/[?&]set=([^&]+)/)?.[1]
      const localId = u.match(/[?&]localId=([^&]+)/)?.[1]
      const name = u.match(/[?&]name=([^&]+)/)?.[1]
      let filtered = cards
      if (set) filtered = filtered.filter((row) => row.set.id === set)
      if (localId) {
        filtered = filtered.filter(
          (row) => String(row.number) === localId || String(Number(row.number)) === String(Number(localId))
        )
      }
      if (name) filtered = filtered.filter((row) => row.name.toLowerCase().includes(name.toLowerCase()))
      return { ok: true, status: 200, json: async () => filtered.map(tcgdexPayload) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
}

test('same number+total across different sets does not auto-pick on a junk name', async () => {
  const { clearScanCache, matchScan } = await import('./match.ts')
  const rows = [
    { id: 'me04-087', name: 'Chespin', number: '087', set: { id: 'me04', name: 'Chaos Rising', printedTotal: 86 } },
    { id: 'sv10.5b-087', name: 'Gimmighoul', number: '087', set: { id: 'sv10.5b', name: 'Phantasmal Flames', printedTotal: 86 } },
  ]
  const orig = globalThis.fetch
  globalThis.fetch = mockTcgdex({
    sets: [
      { id: 'me04', printedTotal: 86, total: 108, name: 'Chaos Rising' },
      { id: 'sv10.5b', printedTotal: 86, total: 108, name: 'Phantasmal Flames' },
    ],
    cards: rows,
  })
  try {
    clearScanCache()
    const result = await matchScan({
      name: 'Boikelicing',
      number: '87',
      total: '86',
      kind: 'std',
      agreement: 1,
    })
    assert.equal(result.best, null)
    assert.ok(result.confidence < BEST_THRESHOLD)
    assert.ok(result.candidates.some((c) => c.id === 'me04-087'))
    assert.ok(result.candidates.some((c) => c.id === 'sv10.5b-087'))
  } finally {
    globalThis.fetch = orig
    clearScanCache()
  }
})

test('unique number+total among same-number printings can auto-pick', async () => {
  const { clearScanCache, matchScan } = await import('./match.ts')
  const me04087 = {
    id: 'me04-087',
    name: 'Chespin',
    number: '087',
    set: { id: 'me04', name: 'Chaos Rising', printedTotal: 86 },
  }
  const other87 = {
    id: 'rsv10pt5-087',
    name: 'Gimmighoul',
    number: '087',
    set: { id: 'rsv10pt5', name: 'Phantasmal Flames', printedTotal: 94 },
  }
  const orig = globalThis.fetch
  globalThis.fetch = mockTcgdex({
    sets: [
      { id: 'me04', printedTotal: 86, total: 108, name: 'Chaos Rising' },
      { id: 'rsv10pt5', printedTotal: 94, total: 108, name: 'Phantasmal Flames' },
    ],
    cards: [me04087, other87],
  })
  try {
    clearScanCache()
    const result = await matchScan({
      name: 'Boikelicing',
      number: '87',
      total: '86',
      kind: 'std',
      agreement: 1,
    })
    assert.equal(result.best?.id, 'me04-087')
    assert.ok(result.confidence >= BEST_THRESHOLD)
    assert.ok(!result.candidates.some((c) => c.id === 'rsv10pt5-087'))
  } finally {
    globalThis.fetch = orig
    clearScanCache()
  }
})

test('number+total+attack reaches auto-pick even with a garbled name', () => {
  const score = scoreMatch(
    {
      name: 'Serperior',
      number: '6',
      printedTotal: 88,
      setId: 'me3',
      hp: '160',
      attacks: [{ name: 'Regal Command' }, { name: 'Solar Coiling' }],
    },
    {
      name: 'SerperiofiNL',
      number: '6',
      total: '88',
      kind: 'std',
      hp: '160',
      attacks: ['Regal Command', 'Solar Coiling'],
      rawText: ['Regal Command', 'Solar Coiling'],
      agreement: 0.8,
    }
  )
  assert.ok(score >= BEST_THRESHOLD)
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

test('matchScan promo lock returns mep-072 not me03-031', async () => {
  const { clearScanCache, matchScan } = await import('./match.ts')
  clearScanCache()
  const mep072 = {
    id: 'mep-072',
    name: 'Mega Clefable ex',
    number: '072',
    hp: '320',
    rarity: 'Promo',
    attacks: [{ name: 'Shooting Moons' }],
    abilities: [{ name: 'Luminous Wing' }],
    set: { id: 'mep', name: 'MEP Black Star Promos', printedTotal: 113 },
  }
  const me03031 = {
    id: 'me03-031',
    name: 'Mega Clefable ex',
    number: '031',
    hp: '320',
    rarity: 'Double Rare',
    attacks: [{ name: 'Shooting Moons' }],
    abilities: [{ name: 'Luminous Wing' }],
    set: { id: 'me03', name: 'Perfect Order', printedTotal: 88 },
  }
  const orig = globalThis.fetch
  globalThis.fetch = mockTcgdex({
    sets: [
      { id: 'mep', name: 'MEP Black Star Promos', printedTotal: 113, total: 113 },
      { id: 'me03', name: 'Perfect Order', printedTotal: 88, total: 124 },
      { id: 'svp', name: 'Scarlet & Violet Black Star Promos', printedTotal: 215, total: 196 },
    ],
    cards: [mep072, me03031],
  })
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
    assert.equal(result.best?.id, 'mep-072')
    assert.equal(result.best?.setId, 'mep')
    assert.equal(String(Number(result.best?.number)), '72')
    assert.ok(result.confidence >= 0.9)
    assert.ok(result.candidates.every((c) => c.id !== 'me03-031'))
  } finally {
    globalThis.fetch = orig
    clearScanCache()
  }
})
