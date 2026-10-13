import assert from 'node:assert/strict'
import test from 'node:test'
import { rotateK } from './image.ts'
import { COMMON_TOTALS, parseNumbers, parseRawText, pickNameToken, voteNumber } from './parse.ts'

function first(text, totals) {
  return parseNumbers(text, totals)[0]
}

test('secret rares parse above the set total', () => {
  const read = first('201/165')
  assert.deepEqual([read.number, read.total], ['201', '165'])
})

test('name junk around a number is ignored', () => {
  const read = first('G  245/198  ')
  assert.deepEqual([read.number, first('245/198').total], ['245', '198'])
})

test('trainer gallery and galarian gallery codes parse', () => {
  assert.deepEqual([first('TG05/TG30').number, first('TG05/TG30').total], ['TG05', '30'])
  assert.deepEqual([first('GG35 / GG70').number, first('GG35/GG70').total], ['GG35', '70'])
})

test('promo codes parse', () => {
  const swsh = first('SWSH020')
  assert.equal(swsh.number, '20')
  assert.equal(swsh.setCode, 'SWSH')
  assert.equal(swsh.kind, 'promo')
  const svp = first('SVP 045')
  assert.equal(svp.number, '45')
  assert.equal(svp.setCode, 'SVP')
})

test('title-case Pokémon names beat all-caps OCR junk', () => {
  assert.equal(pickNameToken('CLANS Chespin x'), 'Chespin')
  assert.equal(pickNameToken('Mega Clefable ex'), 'Clefable')
})

test('MEP Black Star promo codes parse with EN language stamp', () => {
  const mep = first('J MEP EN 072')
  assert.equal(mep.number, '72')
  assert.equal(mep.setCode, 'MEP')
  assert.equal(mep.kind, 'promo')
  assert.equal(first('MEP-072').setCode, 'MEP')
  assert.equal(first('JEN 72').setCode, 'MEP')
  assert.equal(first('JEN 72').number, '72')
  assert.equal(first('POR EN 031/088').kind, 'std')
  assert.equal(first('POR EN 031/088').number, '31')
})

test('holo slash 0317088 repairs to 31/88 with common totals', () => {
  const read = first('LJ0317088', COMMON_TOTALS)
  assert.equal(read.number, '31')
  assert.equal(read.total, '88')
})

test('OCR letter repairs', () => {
  assert.equal(first('O25/I65').number, '25')
})

test('known totals trim junk and repair a missing slash', () => {
  const totals = new Set([165, 198, 146, 30, 70])
  assert.deepEqual([first('42/1460 Ne', totals).number, first('42/1460', totals).total], ['42', '146'])
  assert.deepEqual([first('2017165, rg', totals).number, first('2017165', totals).total], ['201', '165'])
  assert.equal(first('1IGO5/1G30', totals).number, 'TG05')
  assert.equal(first('GG35/GGZ0N', totals).number, 'GG35')
})

test('full-art slash repairs against known totals', () => {
  const totals = new Set([165, 193])
  assert.deepEqual([first('1997,165', totals).number, first('1997,165', totals).total], ['199', '165'])
  assert.deepEqual([first('2564193', totals).number, first('2564193', totals).total], ['256', '193'])
})

test('vote credits a dropped leading digit to the longer secret rare', () => {
  assert.equal(
    voteNumber([
      { number: '199', total: '165', kind: 'std' },
      { number: '99', total: '165', kind: 'std' },
    ]).pick.number,
    '199'
  )
})

test('raw text recovers a number the client vote missed', () => {
  const parsed = parseRawText(['PRAT', '1997,165'], new Set([165]))
  assert.equal(parsed.reads[0].number, '199')
  assert.equal(parsed.reads[0].total, '165')
})

test('rotate 90/180/270 maps a marker pixel', () => {
  const img = {
    width: 2,
    height: 3,
    data: new Uint8ClampedArray(2 * 3 * 4),
  }
  img.data[0] = 255
  const cw = rotateK(img, 1)
  assert.equal(cw.width, 3)
  assert.equal(cw.height, 2)
  const i = (0 * cw.width + (3 - 1 - 0)) * 4
  assert.equal(cw.data[i], 255)
  const full = rotateK(img, 4)
  assert.equal(full.width, 2)
  assert.equal(full.data[0], 255)
})

test('a 2-digit extra leading 1 does not beat a 1-digit set number', () => {
  assert.equal(
    voteNumber([
      { number: '6', total: '88', kind: 'std' },
      { number: '6', total: '88', kind: 'std' },
      { number: '16', total: '88', kind: 'std' },
    ]).pick.number,
    '6'
  )
})

test('vote prefers the majority and drops implausible secret-rare reads', () => {
  assert.equal(
    voteNumber([
      { number: '25', total: '165', kind: 'std' },
      { number: '25', total: '165', kind: 'std' },
      { number: '223', total: '165', kind: 'std' },
    ]).pick.number,
    '25'
  )
  assert.equal(
    voteNumber([
      { number: '923', total: '165', kind: 'std' },
      { number: '25', total: '165', kind: 'std' },
    ]).pick.number,
    '25'
  )
})
