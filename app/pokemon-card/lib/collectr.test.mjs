import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mapCondition,
  mapPrinting,
  mergeRows,
  normalizeSetName,
  parseCollectrCsv,
  parseCsv,
  rowNotes,
  splitNumber,
} from './collectr.ts'

const HEADER =
  'Portfolio Name,Category,Set,Product Name,Card Number,Rarity,Variance,Grade,Card Condition,Average Cost Paid,Quantity,Market Price (As of 2026-11-03),Price Override,Watchlist,Date Added,Notes'

const SAMPLE = [
  HEADER,
  'Main,Pokemon,30th Celebration,Gengar ex,154/128,Special Illustration Rare,Holofoil,Ungraded,Near Mint,0.0000,1,62.08,0,false,2026-11-01,',
  'Main,Pokemon,Chaos Rising,Chespin,087/086,Illustration Rare,Holofoil,Ungraded,Near Mint,0.0000,1,2.67,0,false,2026-11-01,',
  "Main,Pokemon,Pitch Black,Misty's Vitality,111/084,Ultra Rare,Holofoil,Ungraded,Near Mint,0.0000,1,9.4,0,false,2026-11-02,",
  'Main,Pokemon,Pitch Black,Goldeen,087/084,Illustration Rare,Holofoil,PSA 10,Lightly Played,0.0000,2,3.87,0,false,2026-11-02,"Pulled, not bought"',
  'Main,Magic,Some Set,Not a Pokémon,001/100,Rare,Normal,Ungraded,Near Mint,0,1,1,0,false,2026-11-02,',
  '',
].join('\r\n')

test('parseCsv handles quotes, escaped quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n'), [
    ['a', 'b, c', 'd "e"'],
    ['1', '2', '3'],
  ])
})

test('parses a Collectr export and drops non-Pokémon rows and price columns', () => {
  const rows = parseCollectrCsv(SAMPLE)
  assert.equal(rows.length, 4)
  const [gengar, chespin, misty, goldeen] = rows
  assert.equal(gengar.name, 'Gengar ex')
  assert.equal(gengar.set, '30th Celebration')
  assert.equal(gengar.number, '154')
  assert.equal(gengar.printedTotal, 128)
  assert.equal(gengar.condition, 'NM')
  assert.equal(gengar.added, '2026-11-01')
  assert.equal(chespin.number, '087')
  assert.equal(misty.name, "Misty's Vitality")
  assert.equal(goldeen.quantity, 2)
  assert.equal(goldeen.condition, 'LP')
  assert.equal(goldeen.notes, 'Pulled, not bought')
  assert.equal(rowNotes(goldeen), 'Pulled, not bought · Graded: PSA 10')
  assert.equal(rowNotes(gengar), undefined)
  for (const row of rows) assert.ok(!('market' in row) && !('price' in row))
})

test('rejects files that are not Collectr exports', () => {
  assert.throws(() => parseCollectrCsv('foo,bar\n1,2\n'), /Not a Collectr export/)
})

test('maps conditions, printings and numbers', () => {
  assert.equal(mapCondition('Moderately Played'), 'MP')
  assert.equal(mapCondition('Damaged'), 'DMG')
  assert.equal(mapCondition(''), 'NM')
  assert.equal(mapPrinting('Reverse Holofoil'), 'reverseHolofoil')
  assert.equal(mapPrinting('Holofoil'), 'holofoil')
  assert.equal(mapPrinting(''), undefined)
  assert.deepEqual(splitNumber('SWSH050'), { number: 'SWSH050', printedTotal: undefined })
  assert.deepEqual(splitNumber('087/086'), { number: '087', printedTotal: 86 })
})

test('set names normalize across Collectr and TCGdex spellings', () => {
  assert.equal(normalizeSetName('ME04: Chaos Rising'), normalizeSetName('Chaos Rising'))
  assert.equal(normalizeSetName('Pokémon Scarlet & Violet'), 'scarlet and violet')
})

test('duplicate rows for the same card add up', () => {
  const twice = [HEADER, SAMPLE.split('\r\n')[1], SAMPLE.split('\r\n')[1].replace('2026-11-01', '2026-10-20')].join('\n')
  const merged = mergeRows(parseCollectrCsv(twice))
  assert.equal(merged.length, 1)
  assert.equal(merged[0].quantity, 2)
  assert.equal(merged[0].added, '2026-10-20')
})
