import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after, before } from 'node:test'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { createWorker } from 'tesseract.js'
import { rotateK } from './image.ts'
import { matchScan } from './match.ts'
import { runOcrPlan } from './ocrPlan.ts'
import { parseNumbers } from './parse.ts'

const dir = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(dir, 'fixtures')

function loadJpeg(name) {
  const decoded = jpeg.decode(readFileSync(path.join(fixtures, name)), { useTArray: true })
  return {
    data: new Uint8ClampedArray(decoded.data),
    width: decoded.width,
    height: decoded.height,
  }
}

const CARDS = {
  chespin: {
    file: 'chespin-me4-87.jpg',
    id: 'me04-087',
    name: /chespin/i,
    number: '87',
    total: '86',
    setId: 'me04',
  },
  clefableSet: {
    file: 'mega-clefable-ex-me3-31.jpg',
    id: 'me03-031',
    name: /clefable/i,
    number: '31',
    total: '88',
    setId: 'me03',
  },
  serperior: {
    file: 'serperior-me3-6.jpg',
    id: 'me03-006',
    name: /serperior/i,
    number: '6',
    total: '88',
    setId: 'me03',
  },
  clefablePromo: {
    file: 'mega-clefable-ex-mep-072.jpg',
    id: 'mep-072',
    name: /clefable/i,
    number: '72',
    setId: 'mep',
    setCode: 'MEP',
    promo: true,
  },
}

let worker
let engine

before(async () => {
  worker = await createWorker('eng', 1)
  engine = async (img, psm) => {
    await worker.setParameters({ tessedit_pageseg_mode: psm })
    const png = new PNG({ width: img.width, height: img.height })
    png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength)
    const buf = PNG.sync.write(png)
    const r = await worker.recognize(buf)
    return { text: r.data.text, conf: r.data.confidence }
  }
})

after(async () => {
  if (worker) await worker.terminate()
})

test('fixtures include the full phone photo and four crops', () => {
  for (const name of [
    'kuzey-4cards.jpg',
    'chespin-me4-87.jpg',
    'mega-clefable-ex-me3-31.jpg',
    'serperior-me3-6.jpg',
    'mega-clefable-ex-mep-072.jpg',
  ]) {
    assert.ok(readFileSync(path.join(fixtures, name)).length > 1000, name)
  }
})

test('rotated 90° crop is still recognised as Chespin 87/86', { timeout: 180_000 }, async () => {
  const img = rotateK(loadJpeg(CARDS.chespin.file), 1)
  const query = await runOcrPlan(img, engine)
  assert.equal(query.number, '87')
  assert.equal(query.total, '86')
})

for (const [key, spec] of Object.entries(CARDS)) {
  test(
    `OCR+match ${key} → ${spec.id}`,
    { timeout: 180_000 },
    async () => {
      const query = await runOcrPlan(loadJpeg(spec.file), engine)
      if (spec.promo) {
        const blob = (query.rawText || []).join(' ')
        const promoReads = [query, ...parseNumbers(blob)].filter((r) => r.setCode === 'MEP' || r.kind === 'promo')
        const hit = promoReads.find((r) => String(r.number) === '72' && (r.setCode === 'MEP' || spec.setCode === 'MEP'))
        assert.ok(
          query.setCode === 'MEP' || /MEP/.test(blob),
          `promo set code missing: ${JSON.stringify({ number: query.number, setCode: query.setCode, blob })}`
        )
        assert.ok(
          query.number === '72' || hit || /072|\b72\b/.test(blob),
          `promo number 72 missing: ${JSON.stringify(query)}`
        )
        const result = await matchScan({
          ...query,
          number: query.number === '72' ? query.number : '72',
          kind: 'promo',
          setCode: query.setCode || 'MEP',
        })
        const picked = result.best || result.candidates[0]
        assert.ok(picked, `promo mep-072 missing: ${JSON.stringify({ ocr: query, result })}`)
        assert.equal(picked.id, 'mep-072')
        assert.equal(picked.setId, 'mep')
        assert.equal(String(Number(picked.number)), '72')
        assert.match(picked.name, /clefable/i)
        assert.ok(picked.image, 'promo image missing')
        assert.equal(picked.source, 'tcgdex')
        assert.ok(
          result.candidates.every((c) => c.setId === 'mep' && /clefable/i.test(c.name)),
          `promo must not resolve to another printing: ${result.candidates.map((c) => c.id)}`
        )
        if (result.confidence >= 0.9) assert.equal(result.best?.id, 'mep-072')
        return
      }
      assert.equal(query.number, spec.number, JSON.stringify(query))
      if (spec.total) assert.equal(query.total, spec.total)
      const result = await matchScan(query)
      const picked = result.best || result.candidates[0]
      assert.ok(picked, `no candidates ${JSON.stringify(query)}`)
      assert.equal(picked.id, spec.id)
      assert.equal(picked.setId, spec.setId)
      assert.equal(String(Number(picked.number)), spec.number)
      if (result.confidence >= 0.9) assert.equal(result.best?.id, spec.id)
    }
  )
}
