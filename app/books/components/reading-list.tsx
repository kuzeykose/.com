import { Cover } from './cover'
import { ProgressRing } from './progress-ring'
import {
  coverSrc,
  pageLabel,
  readingPercent,
  type Book,
} from '../lib/map'

export function ReadingList({ books }: { books: Book[] }) {
  if (books.length === 0) {
    return (
      <p className="text-neutral-600 dark:text-neutral-400">
        Nothing here right now.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {books.map((book) => {
        const percent = readingPercent(book.currentPage, book.totalPages)
        const pages = pageLabel(book.currentPage, book.totalPages)
        return (
          <div key={book.id} className="flex items-center gap-4">
            <Cover src={coverSrc(book)} title={book.title} />
            <div className="min-w-0 flex-1">
              <div className="tracking-tight text-neutral-900 dark:text-neutral-100">
                {book.title}
              </div>
              {book.author ? (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  {book.author}
                </div>
              ) : null}
              {pages ? (
                <div className="text-xs text-neutral-600 dark:text-neutral-400 tabular-nums mt-1.5">
                  {pages}
                </div>
              ) : null}
            </div>
            {percent != null ? <ProgressRing percent={percent} /> : null}
          </div>
        )
      })}
    </div>
  )
}
