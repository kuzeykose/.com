import 'server-only'
import { unstable_cache } from 'next/cache'
import { FIXTURE_BOOKS, fixtureBooksEnabled } from './fixtures'
import { isBooksConfigured, loadBooksFromNotion, BOOKS_CACHE_TAG, BOOKS_REVALIDATE } from './notion'
import type { Book } from './map'

const getCachedBooks = unstable_cache(
  async () => loadBooksFromNotion(),
  ['books-notion'],
  { revalidate: BOOKS_REVALIDATE, tags: [BOOKS_CACHE_TAG] }
)

export async function getBooks(): Promise<Book[]> {
  if (fixtureBooksEnabled()) return FIXTURE_BOOKS
  if (!isBooksConfigured()) return []
  try {
    return await getCachedBooks()
  } catch {
    return []
  }
}
