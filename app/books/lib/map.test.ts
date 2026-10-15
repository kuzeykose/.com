import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coverSrc,
  formatFinishedOn,
  groupFinishedByYear,
  isNotionHostedUrl,
  pageLabel,
  pageToBook,
  readingPercent,
  sortReading,
  type Book,
  type NotionPageLike,
} from './map.ts'

function page(
  properties: Record<string, unknown>,
  extra: Partial<NotionPageLike> = {}
): NotionPageLike {
  return { id: extra.id ?? 'page-1', ...extra, properties }
}

function title(text: string) {
  return { type: 'title', title: [{ plain_text: text }] }
}

function rich(text: string) {
  return { type: 'rich_text', rich_text: [{ plain_text: text }] }
}

function select(name: string | null) {
  return { type: 'select', select: name ? { name } : null }
}

function number(value: number | null) {
  return { type: 'number', number: value }
}

function date(start: string | null) {
  return { type: 'date', date: start ? { start } : null }
}

test('pageToBook maps Title, Author, Status, pages, Cover, Finished date', () => {
  const book = pageToBook(
    page(
      {
        Title: title('The Quiet Harbor'),
        Author: rich('A. Example'),
        Status: select('Reading'),
        'Current page': number(212),
        'Total pages': number(340),
        Cover: {
          type: 'files',
          files: [
            {
              type: 'file',
              file: {
                url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/cover.jpg?X-Amz-Expires=3600',
              },
            },
          ],
        },
        'Finished date': date(null),
      },
      { id: 'abc-123' }
    )
  )

  assert.deepEqual(book, {
    id: 'abc-123',
    title: 'The Quiet Harbor',
    author: 'A. Example',
    status: 'Reading',
    currentPage: 212,
    totalPages: 340,
    finishedDate: null,
    coverKind: 'notion',
    coverUrl:
      'https://prod-files-secure.s3.us-west-2.amazonaws.com/cover.jpg?X-Amz-Expires=3600',
  })
  assert.equal(coverSrc(book!), '/books/cover/abc-123')
})

test('pageToBook skips missing title, unknown status, and archived pages', () => {
  assert.equal(
    pageToBook(page({ Title: title(''), Status: select('Reading') })),
    null
  )
  assert.equal(
    pageToBook(page({ Title: title('Draft'), Status: select('Want') })),
    null
  )
  assert.equal(
    pageToBook(
      page({ Title: title('Gone'), Status: select('Finished') }, { archived: true })
    ),
    null
  )
})

test('external Cover files and URL properties pass through', () => {
  const file = pageToBook(
    page({
      Title: title('Open Book'),
      Status: select('Reading'),
      Cover: {
        type: 'files',
        files: [
          { type: 'external', external: { url: 'https://covers.example/a.jpg' } },
        ],
      },
    })
  )
  assert.equal(file?.coverKind, 'external')
  assert.equal(coverSrc(file!), 'https://covers.example/a.jpg')

  const url = pageToBook(
    page({
      Title: title('Open Book'),
      Status: select('Reading'),
      Cover: { type: 'url', url: 'https://covers.example/b.jpg' },
    })
  )
  assert.equal(url?.coverKind, 'external')
  assert.equal(coverSrc(url!), 'https://covers.example/b.jpg')
})

test('Notion-hosted Cover URLs are proxied even on a URL property', () => {
  const book = pageToBook(
    page(
      {
        Title: title('Hosted'),
        Status: select('Reading'),
        Cover: {
          type: 'url',
          url: 'https://www.notion.so/image/cover.png',
        },
      },
      { id: 'page-9' }
    )
  )
  assert.equal(book?.coverKind, 'notion')
  assert.equal(coverSrc(book!), '/books/cover/page-9')
  assert.equal(isNotionHostedUrl('https://covers.example/a.jpg'), false)
})

test('percentage is round(current / total × 100), capped at 100', () => {
  assert.equal(readingPercent(212, 340), 62)
  assert.equal(readingPercent(88, 412), 21)
  assert.equal(readingPercent(301, 318), 95)
  assert.equal(readingPercent(50, 100), 50)
  assert.equal(readingPercent(2, 3), 67)
  assert.equal(readingPercent(120, 100), 100)
  assert.equal(readingPercent(0, 240), 0)
})

test('missing or invalid total hides the ring and shows page X', () => {
  assert.equal(readingPercent(12, null), null)
  assert.equal(readingPercent(12, 0), null)
  assert.equal(readingPercent(12, -10), null)
  assert.equal(pageLabel(12, null), 'page 12')
  assert.equal(pageLabel(12, 0), 'page 12')
  assert.equal(pageLabel(212, 340), 'page 212 of 340')
  assert.equal(pageLabel(null, 340), 'page 0 of 340')
  assert.equal(pageLabel(null, null), null)
})

test('reading list sorts by percentage descending, missing totals last', () => {
  const books: Book[] = [
    {
      id: 'a',
      title: 'The Quiet Harbor',
      author: 'A. Example',
      status: 'Reading',
      currentPage: 212,
      totalPages: 340,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
    {
      id: 'b',
      title: 'Notes on Small Systems',
      author: 'J. Sample',
      status: 'Reading',
      currentPage: 88,
      totalPages: 412,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
    {
      id: 'c',
      title: 'A Field Guide to Fog',
      author: 'M. Placeholder',
      status: 'Reading',
      currentPage: 301,
      totalPages: 318,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
    {
      id: 'd',
      title: 'No Total',
      author: 'Z. Missing',
      status: 'Reading',
      currentPage: 40,
      totalPages: null,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
    {
      id: 'e',
      title: 'Done already',
      author: 'X',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: '2026-01-01',
      coverKind: null,
      coverUrl: null,
    },
  ]

  assert.deepEqual(
    sortReading(books).map((book) => book.title),
    ['A Field Guide to Fog', 'The Quiet Harbor', 'Notes on Small Systems', 'No Total']
  )
})

test('finished books group by year, newest first, and include every year', () => {
  const books: Book[] = [
    {
      id: '1',
      title: 'Harbor Lights',
      author: 'C. Demo',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: '2025-09-09',
      coverKind: null,
      coverUrl: null,
    },
    {
      id: '2',
      title: 'A Field Guide to Winter',
      author: 'M. Placeholder',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: '2026-10-09',
      coverKind: null,
      coverUrl: null,
    },
    {
      id: '3',
      title: 'Cold Open',
      author: 'B. Example',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: '2025-12-28',
      coverKind: null,
      coverUrl: null,
    },
    {
      id: '4',
      title: 'Small Engines',
      author: 'T. Example',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: '2026-09-22',
      coverKind: null,
      coverUrl: null,
    },
    {
      id: '5',
      title: 'Still reading',
      author: 'A',
      status: 'Reading',
      currentPage: 1,
      totalPages: 10,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
    {
      id: '6',
      title: 'Undated',
      author: 'Q',
      status: 'Finished',
      currentPage: null,
      totalPages: null,
      finishedDate: null,
      coverKind: null,
      coverUrl: null,
    },
  ]

  const groups = groupFinishedByYear(books)
  assert.deepEqual(
    groups.map((group) => [group.year, group.books.map((book) => book.title)]),
    [
      ['2026', ['A Field Guide to Winter', 'Small Engines']],
      ['2025', ['Cold Open', 'Harbor Lights']],
      ['', ['Undated']],
    ]
  )
  assert.equal(formatFinishedOn('2026-10-09'), 'finished Oct 9')
  assert.equal(formatFinishedOn('2025-12-28'), 'finished Dec 28')
  assert.equal(formatFinishedOn('2026-08-30'), 'finished Aug 30')
})
