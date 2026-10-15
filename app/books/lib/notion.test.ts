import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isBooksConfigured,
  pageBelongsToBooksDatabase,
  queryBookPages,
  type NotionClientLike,
} from './notion.ts'

test('isBooksConfigured requires NOTION_TOKEN and NOTION_BOOKS_DB_ID', () => {
  const token = process.env.NOTION_TOKEN
  const db = process.env.NOTION_BOOKS_DB_ID
  delete process.env.NOTION_TOKEN
  delete process.env.NOTION_BOOKS_DB_ID
  assert.equal(isBooksConfigured(), false)
  process.env.NOTION_TOKEN = 'secret'
  assert.equal(isBooksConfigured(), false)
  process.env.NOTION_BOOKS_DB_ID = 'db'
  assert.equal(isBooksConfigured(), true)
  if (token === undefined) delete process.env.NOTION_TOKEN
  else process.env.NOTION_TOKEN = token
  if (db === undefined) delete process.env.NOTION_BOOKS_DB_ID
  else process.env.NOTION_BOOKS_DB_ID = db
})

test('queryBookPages uses databases.query when the client exposes it', async () => {
  const calls: unknown[] = []
  const client: NotionClientLike = {
    databases: {
      retrieve: async () => {
        throw new Error('should not retrieve when databases.query exists')
      },
      query: async (args) => {
        calls.push(args)
        if (!args.start_cursor) {
          return {
            results: [{ id: 'p1', object: 'page' }, { id: 'ds', object: 'data_source' }],
            has_more: true,
            next_cursor: 'cursor-2',
          }
        }
        return {
          results: [{ id: 'p2', object: 'page' }],
          has_more: false,
          next_cursor: null,
        }
      },
    },
    dataSources: {
      query: async () => {
        throw new Error('should not use dataSources.query')
      },
    },
    pages: {
      retrieve: async () => ({ id: 'p1' }),
    },
  }

  const pages = await queryBookPages(client, 'db-1')
  assert.deepEqual(
    pages.map((page) => page.id),
    ['p1', 'p2']
  )
  assert.equal(calls.length, 2)
})

test('queryBookPages falls back to dataSources.query after databases.retrieve', async () => {
  const client: NotionClientLike = {
    databases: {
      retrieve: async ({ database_id }) => {
        assert.equal(database_id, 'db-1')
        return { data_sources: [{ id: 'ds-1' }] }
      },
    },
    dataSources: {
      query: async ({ data_source_id }) => {
        assert.equal(data_source_id, 'ds-1')
        return {
          results: [{ id: 'p1', object: 'page' }],
          has_more: false,
          next_cursor: null,
        }
      },
    },
    pages: {
      retrieve: async () => ({ id: 'p1' }),
    },
  }

  const pages = await queryBookPages(client, 'db-1')
  assert.deepEqual(
    pages.map((page) => page.id),
    ['p1']
  )
})

test('pageBelongsToBooksDatabase accepts database or data source parents', () => {
  assert.equal(
    pageBelongsToBooksDatabase(
      { id: 'p', parent: { type: 'database_id', database_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ),
    true
  )
  assert.equal(
    pageBelongsToBooksDatabase(
      { id: 'p', parent: { type: 'data_source_id', data_source_id: 'ds-1' } },
      'db-1',
      'ds-1'
    ),
    true
  )
  assert.equal(
    pageBelongsToBooksDatabase(
      { id: 'p', parent: { type: 'data_source_id', data_source_id: 'other' } },
      'db-1',
      'ds-1'
    ),
    false
  )
})
