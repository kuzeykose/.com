import {
  formatFinishedOn,
  type FinishedYearGroup,
} from '../lib/map'

export function FinishedList({ groups }: { groups: FinishedYearGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-neutral-600 dark:text-neutral-400">
        Nothing here right now.
      </p>
    )
  }

  return (
    <div>
      {groups.map((group, index) => (
        <section key={group.year || 'undated'} className={index === 0 ? '' : 'mt-10'}>
          {group.year ? (
            <h2 className="text-sm font-normal text-neutral-500 dark:text-neutral-500 mb-3">
              {group.year}
            </h2>
          ) : null}
          <div className="flex flex-col gap-6">
            {group.books.map((book) => (
              <div key={book.id}>
                <div className="tracking-tight text-neutral-900 dark:text-neutral-100">
                  {book.title}
                  {book.author ? (
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {' '}
                      · {book.author}
                    </span>
                  ) : null}
                </div>
                {book.finishedDate ? (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
                    {formatFinishedOn(book.finishedDate)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
