/**
 * Pure RGBA image ops (no DOM, no node deps). Works on ImageData-shaped objects so the
 * same code runs in the browser (canvas ImageData) and in node tests.
 * Replaces the sharp steps the prototype used: trim, resize, extract, grayscale, normalize, threshold.
 * (EXIF orientation is handled by createImageBitmap(..., { imageOrientation: 'from-image' }).)
 */
export type Img = { data: Uint8ClampedArray; width: number; height: number }

const make = (width: number, height: number): Img => ({ data: new Uint8ClampedArray(width * height * 4), width, height })

/** Crop by fractions of width/height. */
export function crop(img: Img, left: number, top: number, w: number, h: number): Img {
  const sx = Math.max(0, Math.round(img.width * left)), sy = Math.max(0, Math.round(img.height * top))
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(img.width * w)))
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(img.height * h)))
  const out = make(sw, sh)
  for (let y = 0; y < sh; y++) out.data.set(img.data.subarray(((sy + y) * img.width + sx) * 4, ((sy + y) * img.width + sx + sw) * 4), y * sw * 4)
  return out
}

/** Bilinear resize. */
export function resize(img: Img, width: number, height: number): Img {
  const out = make(width, height)
  const rx = img.width / width, ry = img.height / height
  for (let y = 0; y < height; y++) {
    const fy = Math.min(img.height - 1, (y + 0.5) * ry - 0.5), y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(img.height - 1, y0 + 1), wy = Math.max(0, fy - y0)
    for (let x = 0; x < width; x++) {
      const fx = Math.min(img.width - 1, (x + 0.5) * rx - 0.5), x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(img.width - 1, x0 + 1), wx = Math.max(0, fx - x0)
      for (let c = 0; c < 4; c++) {
        const a = img.data[(y0 * img.width + x0) * 4 + c], b = img.data[(y0 * img.width + x1) * 4 + c]
        const d = img.data[(y1 * img.width + x0) * 4 + c], e = img.data[(y1 * img.width + x1) * 4 + c]
        out.data[(y * width + x) * 4 + c] = (a * (1 - wx) + b * wx) * (1 - wy) + (d * (1 - wx) + e * wx) * wy
      }
    }
  }
  return out
}

export const scaleToWidth = (img: Img, width: number) => resize(img, width, Math.max(1, Math.round((img.height * width) / img.width)))

/** Trim a uniform background (colour of the corners) - same idea as sharp.trim(). */
export function trimBorder(img: Img, tol = 30): Img {
  const { data, width, height } = img
  const ref = [0, 1, 2].map((c) => (data[c] + data[(width - 1) * 4 + c] + data[((height - 1) * width) * 4 + c] + data[(height * width - 1) * 4 + c]) / 4)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4
    if (Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2]) > tol * 3) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  const w = maxX - minX, h = maxY - minY
  if (w < width * 0.5 || h < height * 0.5) return img // nothing sensible to trim
  return crop(img, minX / width, minY / height, (w + 1) / width, (h + 1) / height)
}

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

/** Grayscale + percentile contrast stretch (sharp.grayscale().normalize()). */
export function grayNormalize(img: Img): Img {
  const out = make(img.width, img.height), n = img.width * img.height, hist = new Array(256).fill(0), g = new Uint8Array(n)
  for (let p = 0; p < n; p++) { g[p] = lum(img.data, p * 4); hist[g[p]]++ }
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.01) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.01) { hi = v; break } }
  const span = Math.max(1, hi - lo)
  for (let p = 0; p < n; p++) { const v = ((g[p] - lo) * 255) / span; out.data[p * 4] = out.data[p * 4 + 1] = out.data[p * 4 + 2] = v; out.data[p * 4 + 3] = 255 }
  return out
}

function otsu(img: Img) {
  const hist = new Array(256).fill(0), n = img.width * img.height
  for (let p = 0; p < n; p++) hist[img.data[p * 4]]++
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v]
  let sumB = 0, wB = 0, best = 0, t = 128
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue
    const wF = n - wB; if (!wF) break
    sumB += v * hist[v]
    const diff = sumB / wB - (sum - sumB) / wF
    const between = wB * wF * diff * diff
    if (between > best) { best = between; t = v }
  }
  return t
}

/** Binarize a gray image. 'otsu' picks the threshold. invert=true makes light text dark. */
export function threshold(img: Img, t: number | 'otsu' = 'otsu', invert = false): Img {
  const th = t === 'otsu' ? otsu(img) : t
  const out = make(img.width, img.height)
  for (let p = 0; p < img.width * img.height; p++) {
    const on = img.data[p * 4] > th
    const v = on !== invert ? 255 : 0
    out.data[p * 4] = out.data[p * 4 + 1] = out.data[p * 4 + 2] = v; out.data[p * 4 + 3] = 255
  }
  return out
}

/** White/near-white low-saturation pixels -> black text on white (full-art / SIR numbers over art). */
export function whiteText(img: Img, minLum = 190, maxSat = 60): Img {
  const out = make(img.width, img.height), d = img.data
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p * 4, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
    const v = lum(d, i) >= minLum && mx - mn <= maxSat ? 0 : 255
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v; out.data[i + 3] = 255
  }
  return out
}

/** Pad with white so glyphs touching the edge are recognised. */
export function pad(img: Img, px = 20): Img {
  const out = make(img.width + px * 2, img.height + px * 2); out.data.fill(255)
  for (let y = 0; y < img.height; y++) out.data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), ((y + px) * out.width + px) * 4)
  return out
}

/** Clockwise 90°. */
export function rotate90cw(img: Img): Img {
  const out = make(img.height, img.width)
  const { data, width, height } = img
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const di = (x * out.width + (height - 1 - y)) * 4
      out.data[di] = data[si]
      out.data[di + 1] = data[si + 1]
      out.data[di + 2] = data[si + 2]
      out.data[di + 3] = data[si + 3]
    }
  }
  return out
}

export function rotate180(img: Img): Img {
  const out = make(img.width, img.height)
  const n = img.width * img.height
  for (let p = 0; p < n; p++) {
    const q = n - 1 - p
    out.data[q * 4] = img.data[p * 4]
    out.data[q * 4 + 1] = img.data[p * 4 + 1]
    out.data[q * 4 + 2] = img.data[p * 4 + 2]
    out.data[q * 4 + 3] = img.data[p * 4 + 3]
  }
  return out
}

/** Rotate by `k` quarter-turns clockwise (0/1/2/3). */
export function rotateK(img: Img, k: number): Img {
  const n = ((k % 4) + 4) % 4
  if (n === 0) return img
  if (n === 1) return rotate90cw(img)
  if (n === 2) return rotate180(img)
  return rotate90cw(rotate180(img))
}
