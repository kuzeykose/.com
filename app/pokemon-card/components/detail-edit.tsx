'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CONDITIONS, type Condition } from '../lib/types'
import { GhostButton, OptionPill, PrimaryButton } from './ui'

export function DetailEdit({
  id,
  quantity: initialQuantity,
  condition: initialCondition,
  notes: initialNotes,
}: {
  id: string
  quantity: number
  condition: Condition
  notes?: string
}) {
  const router = useRouter()
  const [quantity, setQuantity] = useState(initialQuantity)
  const [condition, setCondition] = useState<Condition>(initialCondition)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pokemon-card/collection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity, condition, notes, mode: 'edit' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not save')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (saving) return
    if (!window.confirm('Remove this card from the collection?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pokemon-card/collection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mode: 'remove' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not remove')
      router.push('/pokemon-card/collection')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Condition</div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CONDITIONS.map((item) => (
          <OptionPill key={item} selected={condition === item} onClick={() => setCondition(item)}>
            {item}
          </OptionPill>
        ))}
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Quantity</div>
      <div className="flex flex-wrap gap-1.5 items-center mb-4">
        <OptionPill onClick={() => setQuantity((n) => Math.max(1, n - 1))}>−</OptionPill>
        <span className="px-2 text-sm tabular-nums">{quantity}</span>
        <OptionPill onClick={() => setQuantity((n) => Math.min(99, n + 1))}>+</OptionPill>
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Notes</div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Where it came from, grading plans…"
        rows={3}
        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm bg-transparent outline-none focus:border-orange-600 mb-4"
      />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </PrimaryButton>
        <GhostButton type="button" disabled={saving} onClick={remove}>
          Remove
        </GhostButton>
      </div>
      {error ? <p className="text-sm text-orange-600 mt-3">{error}</p> : null}
    </div>
  )
}
