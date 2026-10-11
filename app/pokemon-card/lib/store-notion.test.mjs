import assert from 'node:assert/strict'
import test from 'node:test'

const { getCardStore } = await import('./store.ts')
const { createNotionStore } = await import('./store-notion.ts')
const { entryToProperties } = await import('./notion.ts')

function pageFor(entry, pageId = `page-${entry.id}`) {
  const properties = {
    Name: { type: 'title', title: [{ plain_text: entry.catalog?.name ?? entry.id }] },
    'Card ID': { type: 'rich_text', rich_text: [{ plain_text: entry.id }] },
    Set: { type: 'rich_text', rich_text: [{ plain_text: entry.catalog?.setName ?? '' }] },
    Number: { type: 'rich_text', rich_text: [{ plain_text: entry.catalog?.number ?? '' }] },
    Rarity: { type: 'rich_text', rich_text: [{ plain_text: entry.catalog?.rarity ?? '' }] },
    Type: { type: 'rich_text', rich_text: [{ plain_text: entry.catalog?.types?.[0] ?? '' }] },
    Quantity: { type: 'number', number: entry.quantity },
    Condition: { type: 'select', select: { name: entry.condition } },
    Notes: { type: 'rich_text', rich_text: [{ plain_text: entry.notes ?? '' }] },
    Added: { type: 'date', date: { start: entry.added } },
  }
  return { id: pageId, object: 'page', properties }
}

const mantine = {
  id: 'sv8-40',
  quantity: 2,
  condition: 'NM',
  notes: 'Binder',
  added: '2026-10-09',
  catalog: { name: 'Mantine', number: '40', setName: 'Surging Sparks', types: ['Water'] },
}

function mockClient(seed = []) {
  const pages = new Map(seed.map((entry) => [entry.id, pageFor(entry)]))
  const calls = { query: [], create: [], update: [], retrieve: 0 }

  return {
    calls,
    pages,
    client: {
      databases: {
        retrieve: async () => {
          calls.retrieve += 1
          return { id: 'db1', data_sources: [{ id: 'ds1', name: 'Pokémon cards' }] }
        },
        create: async () => ({ id: 'db1', data_sources: [{ id: 'ds1' }] }),
      },
      dataSources: {
        query: async (args) => {
          calls.query.push(args)
          const filterId = args.filter?.rich_text?.equals
          if (filterId) {
            const page = pages.get(filterId)
            return { results: page ? [page] : [], has_more: false, next_cursor: null }
          }
          const all = [...pages.values()]
          if (args.start_cursor === 'page-2') {
            return { results: all.slice(1), has_more: false, next_cursor: null }
          }
          return {
            results: all.slice(0, 1),
            has_more: all.length > 1,
            next_cursor: all.length > 1 ? 'page-2' : null,
          }
        },
      },
      pages: {
        create: async ({ properties }) => {
          calls.create.push(properties)
          const id = properties['Card ID'].rich_text[0].text.content
          const entry = {
            id,
            quantity: properties.Quantity.number,
            condition: properties.Condition.select.name,
            notes: properties.Notes.rich_text[0].text.content,
            added: properties.Added.date.start,
            catalog: { name: properties.Name.title[0].text.content, number: '' },
          }
          const page = pageFor(entry)
          pages.set(id, page)
          return page
        },
        update: async ({ page_id, properties, archived }) => {
          calls.update.push({ page_id, properties, archived })
          if (archived) {
            for (const [id, page] of pages) {
              if (page.id === page_id) pages.delete(id)
            }
            return { id: page_id, archived: true }
          }
          for (const [id, page] of pages) {
            if (page.id !== page_id) continue
            const next = {
              id,
              quantity: properties.Quantity?.number ?? page.properties.Quantity.number,
              condition: properties.Condition?.select?.name ?? page.properties.Condition.select.name,
              notes: properties.Notes?.rich_text?.[0]?.text.content ?? page.properties.Notes.rich_text[0].plain_text,
              added: properties.Added?.date?.start ?? page.properties.Added.date.start,
              catalog: { name: properties.Name?.title?.[0]?.text.content ?? page.properties.Name.title[0].plain_text, number: '' },
            }
            const updated = pageFor(next, page_id)
            pages.set(id, updated)
            return updated
          }
          return { id: page_id }
        },
      },
    },
  }
}

function storeFor(seed = []) {
  const mocked = mockClient(seed)
  return {
    ...mocked,
    store: createNotionStore({
      client: mocked.client,
      databaseId: 'db1',
      dataSourceId: 'ds1',
      throttle: async () => {},
    }),
  }
}

test('getCardStore falls back to JSON when Notion env is unset', () => {
  const token = process.env.NOTION_TOKEN
  const db = process.env.NOTION_POKEMON_DB_ID
  delete process.env.NOTION_TOKEN
  delete process.env.NOTION_POKEMON_DB_ID
  assert.equal(getCardStore().kind, 'json')
  if (token !== undefined) process.env.NOTION_TOKEN = token
  if (db !== undefined) process.env.NOTION_POKEMON_DB_ID = db
})

test('Notion list paginates every data source page', async () => {
  const second = { ...mantine, id: 'sv5-81', quantity: 1, catalog: { name: 'Iron Crown ex', number: '81' } }
  const { store, calls } = storeFor([mantine, second])
  const cards = await store.list()
  assert.equal(cards.length, 2)
  assert.equal(cards[0].id, 'sv8-40')
  assert.equal(cards[1].id, 'sv5-81')
  assert.equal(calls.query.length, 2)
  assert.equal(calls.query[1].start_cursor, 'page-2')
})

test('adding an existing Card ID increments quantity', async () => {
  const { store, calls } = storeFor([mantine])
  const next = await store.add({ ...mantine, quantity: 1, notes: 'Extra' })
  assert.equal(next.quantity, 3)
  assert.equal(calls.create.length, 0)
  assert.equal(calls.update.length, 1)
  assert.equal(calls.update[0].properties.Quantity.number, 3)
})

test('adding a new Card ID creates a row', async () => {
  const { store, calls } = storeFor([])
  const next = await store.add(mantine)
  assert.equal(next.id, 'sv8-40')
  assert.equal(calls.create.length, 1)
  assert.equal(calls.create[0]['Card ID'].rich_text[0].text.content, 'sv8-40')
})

test('put is safe to run twice for the same Card ID', async () => {
  const { store, calls } = storeFor([])
  const first = await store.put(mantine)
  const second = await store.put({ ...mantine, notes: 'Still two' })
  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(second.entry.quantity, 2)
  assert.equal(calls.create.length, 1)
  assert.equal(calls.update.length, 1)
})

test('update writes condition, quantity and notes', async () => {
  const { store } = storeFor([mantine])
  const next = await store.update('sv8-40', { quantity: 5, condition: 'LP', notes: 'Played' })
  assert.equal(next.quantity, 5)
  assert.equal(next.condition, 'LP')
  assert.equal(next.notes, 'Played')
})

test('remove archives the Notion page', async () => {
  const { store, calls, pages } = storeFor([mantine])
  assert.equal(await store.remove('sv8-40'), true)
  assert.equal(pages.size, 0)
  assert.equal(calls.update[0].archived, true)
  assert.equal(await store.remove('missing'), false)
})

test('undo decrements and archives at zero', async () => {
  const { store, pages } = storeFor([mantine])
  const remaining = await store.undo('sv8-40', 1)
  assert.equal(remaining.quantity, 1)
  const gone = await store.undo('sv8-40', 1)
  assert.equal(gone, null)
  assert.equal(pages.size, 0)
})

test('429 on query retries with backoff', async () => {
  const mocked = mockClient([mantine])
  let failures = 0
  const original = mocked.client.dataSources.query
  mocked.client.dataSources.query = async (args) => {
    if (failures < 2) {
      failures += 1
      throw Object.assign(new Error('rate limited'), { status: 429 })
    }
    return original(args)
  }
  const waits = []
  const store = createNotionStore({
    client: mocked.client,
    databaseId: 'db1',
    dataSourceId: 'ds1',
    throttle: async () => {},
    sleep: async (ms) => {
      waits.push(ms)
    },
  })
  const cards = await store.list()
  assert.equal(cards.length, 1)
  assert.equal(failures, 2)
  assert.equal(waits.length, 2)
})

test('entry properties stay within the documented Notion schema', () => {
  const keys = Object.keys(entryToProperties(mantine))
  assert.deepEqual(keys, [
    'Name',
    'Card ID',
    'Set',
    'Number',
    'Rarity',
    'Type',
    'Quantity',
    'Condition',
    'Notes',
    'Added',
  ])
})

test('Notion store can add a TCGdex fallback promo id', async () => {
  const { store, calls } = storeFor()
  const entry = await store.add({
    id: 'mep-72',
    quantity: 1,
    condition: 'NM',
    notes: 'Promo from scan',
    added: '2026-10-13',
    catalog: {
      name: 'Mega Clefable ex',
      number: '72',
      setName: 'MEP Black Star Promos',
      types: ['Psychic'],
    },
  })
  assert.equal(entry.id, 'mep-72')
  assert.equal(calls.create.length, 1)
  assert.equal(calls.create[0]['Card ID'].rich_text[0].text.content, 'mep-72')
  const found = await store.get('mep-72')
  assert.equal(found?.id, 'mep-72')
})
