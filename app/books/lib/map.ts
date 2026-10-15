export type BookStatus = 'Reading' | 'Finished'

export type CoverKind = 'notion' | 'external' | null

export type Book = {
  id: string
  title: string
  author: string
  status: BookStatus
  currentPage: number | null
  totalPages: number | null
  finishedDate: string | null
  coverKind: CoverKind
  coverUrl: string | null
}

export type NotionPageLike = {
  id: string
  object?: string
  archived?: boolean
  in_trash?: boolean
  properties?: Record<string, unknown>
}

export const BOOK_PROPS = {
  title: 'Title',
  author: 'Author',
  status: 'Status',
  currentPage: 'Current page',
  totalPages: 'Total pages',
  cover: 'Cover',
  finishedDate: 'Finished date',
} as const

const STATUSES: BookStatus[] = ['Reading', 'Finished']

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function richPlainText(value: unknown) {
  const prop = asRecord(value)
  if (!prop) return ''
  const items =
    (Array.isArray(prop.title) && prop.title) ||
    (Array.isArray(prop.rich_text) && prop.rich_text) ||
    []
  return items
    .map((item) => {
      const record = asRecord(item)
      return typeof record?.plain_text === 'string' ? record.plain_text : ''
    })
    .join('')
    .trim()
}

function numberOf(value: unknown) {
  const prop = asRecord(value)
  return typeof prop?.number === 'number' && Number.isFinite(prop.number)
    ? prop.number
    : null
}

function selectName(value: unknown) {
  const prop = asRecord(value)
  const select = asRecord(prop?.select)
  return typeof select?.name === 'string' ? select.name : ''
}

function dateStart(value: unknown) {
  const prop = asRecord(value)
  const date = asRecord(prop?.date)
  return typeof date?.start === 'string' ? date.start.slice(0, 10) : null
}

export function isNotionHostedUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return (
      host.endsWith('amazonaws.com') ||
      host.endsWith('notion.so') ||
      host.endsWith('notion-static.com') ||
      host.includes('notion-static')
    )
  } catch {
    return false
  }
}

function coverOf(value: unknown): { kind: CoverKind; url: string | null } {
  const prop = asRecord(value)
  if (!prop) return { kind: null, url: null }

  if (typeof prop.url === 'string' && prop.url.trim()) {
    const url = prop.url.trim()
    return { kind: isNotionHostedUrl(url) ? 'notion' : 'external', url }
  }

  const files = Array.isArray(prop.files) ? prop.files : []
  for (const item of files) {
    const file = asRecord(item)
    if (!file) continue
    if (file.type === 'file') {
      const nested = asRecord(file.file)
      const url = typeof nested?.url === 'string' ? nested.url.trim() : ''
      if (url) return { kind: 'notion', url }
    }
    if (file.type === 'external') {
      const nested = asRecord(file.external)
      const url = typeof nested?.url === 'string' ? nested.url.trim() : ''
      if (url) {
        return { kind: isNotionHostedUrl(url) ? 'notion' : 'external', url }
      }
    }
  }

  return { kind: null, url: null }
}

export function pageToBook(page: NotionPageLike): Book | null {
  if (page.archived || page.in_trash) return null
  const properties = page.properties ?? {}
  const title = richPlainText(properties[BOOK_PROPS.title])
  const status = selectName(properties[BOOK_PROPS.status]) as BookStatus
  if (!title || !STATUSES.includes(status)) return null

  const cover = coverOf(properties[BOOK_PROPS.cover])
  return {
    id: page.id,
    title,
    author: richPlainText(properties[BOOK_PROPS.author]),
    status,
    currentPage: numberOf(properties[BOOK_PROPS.currentPage]),
    totalPages: numberOf(properties[BOOK_PROPS.totalPages]),
    finishedDate: dateStart(properties[BOOK_PROPS.finishedDate]),
    coverKind: cover.kind,
    coverUrl: cover.url,
  }
}

export function readingPercent(
  currentPage: number | null,
  totalPages: number | null
): number | null {
  if (totalPages == null || totalPages <= 0) return null
  const current = currentPage ?? 0
  return Math.min(100, Math.round((current / totalPages) * 100))
}

export function pageLabel(
  currentPage: number | null,
  totalPages: number | null
): string | null {
  if (totalPages == null || totalPages <= 0) {
    if (currentPage == null) return null
    return `page ${currentPage}`
  }
  return `page ${currentPage ?? 0} of ${totalPages}`
}

export function coverSrc(book: Book): string | null {
  if (book.coverKind === 'notion') return `/books/cover/${book.id}`
  if (book.coverKind === 'external' && book.coverUrl) return book.coverUrl
  return null
}

export function sortReading(books: Book[]): Book[] {
  return books
    .filter((book) => book.status === 'Reading')
    .slice()
    .sort((a, b) => {
      const pa = readingPercent(a.currentPage, a.totalPages)
      const pb = readingPercent(b.currentPage, b.totalPages)
      if (pa == null && pb == null) return a.title.localeCompare(b.title)
      if (pa == null) return 1
      if (pb == null) return -1
      if (pb !== pa) return pb - pa
      return a.title.localeCompare(b.title)
    })
}

export type FinishedYearGroup = {
  year: string
  books: Book[]
}

export function groupFinishedByYear(books: Book[]): FinishedYearGroup[] {
  const finished = books.filter((book) => book.status === 'Finished')
  const groups = new Map<string, Book[]>()
  const undated: Book[] = []

  for (const book of finished) {
    const year = book.finishedDate?.slice(0, 4) ?? ''
    if (!year) {
      undated.push(book)
      continue
    }
    const list = groups.get(year) ?? []
    list.push(book)
    groups.set(year, list)
  }

  const byDateThenTitle = (a: Book, b: Book) => {
    const date = (b.finishedDate ?? '').localeCompare(a.finishedDate ?? '')
    return date !== 0 ? date : a.title.localeCompare(b.title)
  }

  Array.from(groups.values()).forEach((list) => list.sort(byDateThenTitle))
  undated.sort(byDateThenTitle)

  const years = Array.from(groups.keys()).sort((a, b) => Number(b) - Number(a))
  const result = years.map((year) => ({ year, books: groups.get(year)! }))
  if (undated.length) result.push({ year: '', books: undated })
  return result
}

export function formatFinishedOn(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return `finished ${isoDate}`
  const date = new Date(Date.UTC(year, month - 1, day))
  const monthLabel = date.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `finished ${monthLabel} ${day}`
}
