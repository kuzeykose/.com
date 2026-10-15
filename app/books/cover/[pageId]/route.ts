import { NextResponse } from 'next/server'
import {
  createNotionClient,
  isBooksConfigured,
  loadFreshCoverUrl,
  type NotionClientLike,
} from '../../lib/notion'

export const dynamic = 'force-dynamic'

const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

const CACHE_CONTROL =
  'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400'

export async function GET(
  _request: Request,
  context: { params: Promise<{ pageId: string }> }
) {
  if (!isBooksConfigured()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { pageId } = await context.params
  if (!PAGE_ID.test(pageId)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const book = await loadFreshCoverUrl(
      pageId,
      createNotionClient() as unknown as NotionClientLike
    )
    const url = book?.coverUrl
    if (!url) return new NextResponse('Not found', { status: 404 })

    const image = await fetch(url, { redirect: 'follow' })
    if (!image.ok || !image.body) {
      return new NextResponse('Not found', { status: 404 })
    }

    const contentType = image.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', CACHE_CONTROL)
    const length = image.headers.get('content-length')
    if (length) headers.set('Content-Length', length)

    return new NextResponse(image.body, { status: 200, headers })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
