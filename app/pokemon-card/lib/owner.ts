import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import {
  OWNER_COOKIE,
  isDevOpen,
  ownerCookieOptions,
  ownerPassword,
  safeNext,
  signOwnerToken,
  verifyOwnerToken,
} from './owner-token'

export {
  OWNER_COOKIE,
  OWNER_COOKIE_MAX_AGE,
  isDevOpen,
  isProduction,
  ownerCookieOptions,
  ownerPassword,
  passwordsMatch,
  safeNext,
  signOwnerToken,
  verifyOwnerToken,
} from './owner-token'

export async function hasOwnerCookie() {
  if (isDevOpen()) return true
  if (!ownerPassword()) return false
  const jar = await cookies()
  return verifyOwnerToken(jar.get(OWNER_COOKIE)?.value)
}

/** Show Add/Scan entry points in local dev, or in production after a valid cookie. */
export async function canShowOwnerTools() {
  return hasOwnerCookie()
}

export async function gateOwnerPage(nextPath: string) {
  if (isDevOpen()) return
  if (!ownerPassword()) notFound()
  if (!(await hasOwnerCookie())) {
    redirect(`/pokemon-card/unlock?next=${encodeURIComponent(safeNext(nextPath))}`)
  }
}

export async function gateOwnerApi() {
  if (isDevOpen()) return null
  if (!(await hasOwnerCookie())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function setOwnerCookie() {
  const jar = await cookies()
  jar.set(OWNER_COOKIE, signOwnerToken(), ownerCookieOptions())
}
