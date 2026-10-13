import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const OWNER_COOKIE = 'pokemon_owner'
export const OWNER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

export function ownerPassword() {
  return process.env.POKEMON_OWNER_PASSWORD || ''
}

export function ownerSecret() {
  return process.env.POKEMON_OWNER_SECRET || ownerPassword()
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function isDevOpen() {
  return !isProduction()
}

function hmac(data: string) {
  return createHmac('sha256', ownerSecret()).update(data).digest()
}

function equalBytes(left: Buffer, right: Buffer) {
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function signOwnerToken(now = Date.now()) {
  const payload = `v1.${now}`
  return `${payload}.${hmac(payload).toString('hex')}`
}

export function verifyOwnerToken(token: string | undefined) {
  if (!token || !ownerSecret()) return false
  const split = token.lastIndexOf('.')
  if (split <= 0) return false
  const payload = token.slice(0, split)
  const sig = token.slice(split + 1)
  const expected = hmac(payload).toString('hex')
  if (!equalBytes(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) return false
  const parts = payload.split('.')
  if (parts[0] !== 'v1' || parts.length !== 2) return false
  const issued = Number(parts[1])
  if (!Number.isFinite(issued)) return false
  if (issued > Date.now() + 60_000) return false
  if (Date.now() - issued > OWNER_COOKIE_MAX_AGE * 1000) return false
  return true
}

export function passwordsMatch(submitted: string, expected: string) {
  const left = createHash('sha256').update(submitted).digest()
  const right = createHash('sha256').update(expected).digest()
  return equalBytes(left, right)
}

export function safeNext(value: string | undefined) {
  if (!value || value.includes('://') || value.startsWith('//')) return '/pokemon-card/add'
  if (value.startsWith('/pokemon-card/add') || value.startsWith('/pokemon-card/scan')) {
    return value
  }
  return '/pokemon-card/add'
}

export function ownerCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    maxAge: OWNER_COOKIE_MAX_AGE,
    path: '/',
  }
}
