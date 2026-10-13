import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POKEMON_OWNER_PASSWORD = 'test-password'
process.env.POKEMON_OWNER_SECRET = 'test-secret'

const { passwordsMatch, safeNext, signOwnerToken, verifyOwnerToken } = await import('./owner-token.ts')

test('passwordsMatch is true only for the same string', () => {
  assert.equal(passwordsMatch('test-password', 'test-password'), true)
  assert.equal(passwordsMatch('nope', 'test-password'), false)
})

test('signed owner tokens verify and expire', () => {
  const token = signOwnerToken()
  assert.equal(verifyOwnerToken(token), true)
  assert.equal(verifyOwnerToken('v1.1.deadbeef'), false)
  assert.equal(verifyOwnerToken(undefined), false)
  const stale = signOwnerToken(Date.now() - 31 * 24 * 60 * 60 * 1000)
  assert.equal(verifyOwnerToken(stale), false)
})

test('safeNext only allows add and scan paths', () => {
  assert.equal(safeNext('/pokemon-card/scan?mode=upload'), '/pokemon-card/scan?mode=upload')
  assert.equal(safeNext('/pokemon-card/add?id=sv8-40'), '/pokemon-card/add?id=sv8-40')
  assert.equal(safeNext('https://evil.example/pokemon-card/add'), '/pokemon-card/add')
  assert.equal(safeNext('/pokemon-card'), '/pokemon-card/add')
})
