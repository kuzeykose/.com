import { NextResponse } from 'next/server'
import { getCardSaver, type SaveMode } from 'app/pokemon-card/lib/save'
import { CONDITIONS, type CatalogSnapshot, type Condition } from 'app/pokemon-card/lib/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    id?: string
    quantity?: number
    condition?: string
    printing?: string
    notes?: string
    mode?: SaveMode
    catalog?: CatalogSnapshot
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const saver = getCardSaver()
  const result = saver.save({
    id: typeof body.id === 'string' ? body.id : '',
    quantity: Number(body.quantity),
    condition: body.condition as Condition,
    printing: typeof body.printing === 'string' ? body.printing : undefined,
    notes: typeof body.notes === 'string' ? body.notes : '',
    mode: body.mode === 'edit' || body.mode === 'undo' ? body.mode : 'add',
    catalog: body.catalog,
  })

  if (!result.ok) {
    const status =
      result.error.includes('local development') ? 403 : !CONDITIONS.includes(body.condition as Condition) ? 400 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
