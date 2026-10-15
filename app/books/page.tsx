import type { Metadata } from 'next'
import { BooksTabs, type BooksTab } from './components/tabs'
import { ReadingList } from './components/reading-list'
import { FinishedList } from './components/finished-list'
import { getBooks } from './lib/data'
import { groupFinishedByYear, sortReading } from './lib/map'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Books',
  description: "What I'm reading right now.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

function tabFromSearch(value: string | string[] | undefined): BooksTab {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'finished' ? 'finished' : 'reading'
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab: tabParam } = await searchParams
  const tab = tabFromSearch(tabParam)
  const books = await getBooks()
  const reading = sortReading(books)
  const finished = groupFinishedByYear(books)

  return (
    <section>
      <h1 className="font-semibold text-2xl tracking-tighter">Books</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mt-2">
        What I&apos;m reading right now.
      </p>
      <BooksTabs active={tab} />
      {tab === 'finished' ? (
        <FinishedList groups={finished} />
      ) : (
        <ReadingList books={reading} />
      )}
    </section>
  )
}
