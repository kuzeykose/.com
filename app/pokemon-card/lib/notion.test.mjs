import assert from 'node:assert/strict'
import test from 'node:test'

const {
  entryToProperties,
  isNotionConfigured,
  isRateLimited,
  pageToEntry,
  retryAfterMs,
  withNotionRetry,
} = await import('./notion.ts')

test('isNotionConfigured requires both env vars', () => {
  const token = process.env.NOTION_TOKEN
  const db = process.env.NOTION_POKEMON_DB_ID
  delete process.env.NOTION_TOKEN
  delete process.env.NOTION_POKEMON_DB_ID
  assert.equal(isNotionConfigured(), false)
  process.env.NOTION_TOKEN = 'secret'
  assert.equal(isNotionConfigured(), false)
  process.env.NOTION_POKEMON_DB_ID = 'db'
  assert.equal(isNotionConfigured(), true)
  if (token === undefined) delete process.env.NOTION_TOKEN
  else process.env.NOTION_TOKEN = token
  if (db === undefined) delete process.env.NOTION_POKEMON_DB_ID
  else process.env.NOTION_POKEMON_DB_ID = db
})

test('pageToEntry reads the collection schema', () => {
  const entry = pageToEntry({
    id: 'page-1',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Mantine' }] },
      'Card ID': { type: 'rich_text', rich_text: [{ plain_text: 'sv08-040' }] },
      Set: { type: 'rich_text', rich_text: [{ plain_text: 'Surging Sparks' }] },
      Number: { type: 'rich_text', rich_text: [{ plain_text: '40' }] },
      Rarity: { type: 'rich_text', rich_text: [{ plain_text: 'Common' }] },
      Type: { type: 'rich_text', rich_text: [{ plain_text: 'Water' }] },
      Quantity: { type: 'number', number: 3 },
      Condition: { type: 'select', select: { name: 'NM' } },
      Notes: { type: 'rich_text', rich_text: [{ plain_text: 'Binder copy' }] },
      Added: { type: 'date', date: { start: '2026-10-09' } },
    },
  })
  assert.deepEqual(entry, {
    id: 'sv08-040',
    quantity: 3,
    condition: 'NM',
    notes: 'Binder copy',
    added: '2026-10-09',
    catalog: {
      name: 'Mantine',
      number: '40',
      rarity: 'Common',
      types: ['Water'],
      setName: 'Surging Sparks',
    },
  })
})

test('entryToProperties writes Name, Card ID, Quantity, Condition, Added', () => {
  const props = entryToProperties({
    id: 'sv08-040',
    quantity: 2,
    condition: 'LP',
    notes: 'Trade',
    added: '2026-10-01',
    catalog: { name: 'Mantine', number: '40', setName: 'Surging Sparks', types: ['Water'] },
  })
  assert.equal(props.Name.title[0].text.content, 'Mantine')
  assert.equal(props['Card ID'].rich_text[0].text.content, 'sv08-040')
  assert.equal(props.Quantity.number, 2)
  assert.equal(props.Condition.select.name, 'LP')
  assert.equal(props.Added.date.start, '2026-10-01')
})

test('fallback TCGdex promo ids save on the Card ID property', () => {
  const props = entryToProperties({
    id: 'mep-072',
    quantity: 1,
    condition: 'NM',
    notes: '',
    added: '2026-10-13',
    catalog: {
      name: 'Mega Clefable ex',
      number: '72',
      setId: 'mep',
      setName: 'MEP Black Star Promos',
      rarity: 'Promo',
      types: ['Psychic'],
      image: 'https://product-images.tcgplayer.com/fit-in/437x437/696607.jpg',
    },
  })
  assert.equal(props['Card ID'].rich_text[0].text.content, 'mep-072')
  assert.equal(props.Name.title[0].text.content, 'Mega Clefable ex')
  assert.equal(props.Number.rich_text[0].text.content, '72')
  assert.equal(props.Set.rich_text[0].text.content, 'MEP Black Star Promos')
})

test('withNotionRetry backs off on 429 then succeeds', async () => {
  let calls = 0
  const waits = []
  const result = await withNotionRetry(
    async () => {
      calls += 1
      if (calls < 3) {
        throw Object.assign(new Error('rate limited'), { status: 429 })
      }
      return 'ok'
    },
    {
      sleep: async (ms) => {
        waits.push(ms)
      },
    }
  )
  assert.equal(result, 'ok')
  assert.equal(calls, 3)
  assert.equal(waits.length, 2)
  assert.ok(waits[0] >= 200)
  assert.ok(isRateLimited({ status: 429 }))
  assert.equal(isRateLimited({ status: 400 }), false)
  assert.ok(retryAfterMs({ headers: { get: () => '2' } }, 0) >= 2000)
})
