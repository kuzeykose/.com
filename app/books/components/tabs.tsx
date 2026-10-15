import Link from 'next/link'

export type BooksTab = 'reading' | 'finished'

const tabs: { id: BooksTab; href: string; label: string }[] = [
  { id: 'reading', href: '/books?tab=reading', label: 'reading' },
  { id: 'finished', href: '/books?tab=finished', label: 'finished' },
]

export function BooksTabs({ active }: { active: BooksTab }) {
  return (
    <div className="flex gap-4 mt-6 mb-8 text-sm">
      {tabs.map((tab) => {
        const on = tab.id === active
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={
              on
                ? 'underline underline-offset-4 decoration-orange-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
