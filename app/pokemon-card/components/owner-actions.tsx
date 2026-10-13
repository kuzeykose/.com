import Link from 'next/link'

type OwnerLink = {
  href: string
  label: string
}

/** Add/Scan entry points. Visible in local dev, and in production after the owner cookie. */
export const OWNER_LINKS: OwnerLink[] = [
  { href: '/pokemon-card/add', label: 'Add card' },
  { href: '/pokemon-card/scan', label: 'Scan' },
]

export function OwnerActions({
  owner,
  links = OWNER_LINKS,
}: {
  owner: boolean
  links?: readonly OwnerLink[]
}) {
  if (!owner || links.length === 0) return null

  return (
    <nav aria-label="Collection tools" className="flex items-center gap-3 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-neutral-600 dark:text-neutral-400 underline decoration-neutral-400 dark:decoration-neutral-600 underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
