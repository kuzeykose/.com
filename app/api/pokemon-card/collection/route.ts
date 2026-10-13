import { NextResponse } from 'next/server'
import { gateOwnerApi } from 'app/pokemon-card/lib/owner'
import { getCardSaver, type SaveMode } from 'app/pokemon-card/lib/save'
import { CONDITIONS, type CatalogSnapshot, type Condition } from 'app/pokemon-card/lib/types'

export const runtime = 'nodejs'

type CollectionBody = {
  id?: string
  quantity?: number
  condition?: string
  printing?: string
  notes?: string
  mode?: SaveMode
  catalog?: CatalogSnapshot
}

function inputFrom(body: CollectionBody, fallbackMode: SaveMode) {
  return {
    id: typeof body.id === 'string' ? body.id : '',
    quantity: Number(body.quantity),
    condition: body.condition as Condition,
    printing: typeof body.printing === 'string' ? body.printing : undefined,
    notes: typeof body.notes === 'string' ? body.notes : '',
    mode:
      body.mode === 'edit' || body.mode === 'undo' || body.mode === 'remove'
        ? body.mode
        : fallbackMode,
    catalog: body.catalog,
  }
}

function errorStatus(error: string, condition?: string) {
  if (error === 'unauthorized') return 401
  if (error.includes('local development') || error.includes('not writable')) return 403
  if (error === 'Card not found') return 404
  if (condition && !CONDITIONS.includes(condition as Condition)) return 400
  return 400
}

async function handle(body: CollectionBody, fallbackMode: SaveMode) {
  const saver = getCardSaver()
  const result = await saver.save(inputFrom(body, fallbackMode))
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: errorStatus(result.error, body.condition) }
    )
  }
  return NextResponse.json({ ok: true })
}

async function readBody(request: Request) {
  try {
    return (await request.json()) as CollectionBody
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const denied = await gateOwnerApi()
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  return handle(body, 'add')
}

export async function PATCH(request: Request) {
  const denied = await gateOwnerApi()
  if (denied) return denied
  const body = await readBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  return handle({ ...body, mode: body.mode ?? 'edit' }, 'edit')
}

export async function DELETE(request: Request) {
  const denied = await gateOwnerApi()
  if (denied) return denied

  let body: CollectionBody = {}
  try {
    body = (await request.json()) as CollectionBody
  } catch {
    const url = new URL(request.url)
    body = { id: url.searchParams.get('id') ?? '' }
  }

  return handle({ ...body, mode: 'remove' }, 'remove')
}
