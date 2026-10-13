import { PRINTING_LABELS } from './constants'

export function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatMoney(value: number | null | undefined, unit?: string | null) {
  if (value == null || Number.isNaN(value)) return '—'
  if (unit === 'EUR') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }
  return formatUsd(value)
}

export function priceCaption(unit?: string | null, variant?: string | null) {
  if (unit === 'EUR' || variant === 'cardmarket') return 'Cardmarket · EUR'
  if (unit === 'USD') return 'TCGplayer market · USD · near mint'
  return 'price unknown'
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCopyCount(copies: number, unique: number) {
  return `${formatCount(copies)} cards · ${formatCount(unique)} unique`
}

export function formatFilteredCount(
  filteredUnique: number,
  unique: number,
  filteredCopies: number,
  copies: number
) {
  return `${formatCount(filteredUnique)} of ${formatCount(unique)} unique · ${formatCount(filteredCopies)} of ${formatCount(copies)} cards`
}

export function formatLongDate(iso: string) {
  const date = parseDay(iso)
  if (!date) return iso
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(iso: string) {
  const date = parseDay(iso)
  if (!date) return iso
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatUpdated(raw?: string | null) {
  if (!raw) return null
  return raw.replaceAll('-', '/')
}

export function printingLabel(key?: string | null) {
  if (!key) return null
  return PRINTING_LABELS[key] ?? key
}

function parseDay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}
