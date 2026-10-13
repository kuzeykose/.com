const MAX_EDGE = 1400
const JPEG_QUALITY = 0.84

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

function drawCoverCrop(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  dest: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number
) {
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
  dest.width = Math.max(1, Math.round(sw * scale))
  dest.height = Math.max(1, Math.round(sh * scale))
  const ctx = dest.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dest.width, dest.height)
}

/** Map the on-screen 63:88 guide back onto the live video frame. */
export async function cropVideoToGuide(video: HTMLVideoElement, guide: HTMLElement): Promise<Blob> {
  const videoRect = video.getBoundingClientRect()
  const guideRect = guide.getBoundingClientRect()
  const scaleX = video.videoWidth / videoRect.width
  const scaleY = video.videoHeight / videoRect.height
  const sx = Math.max(0, (guideRect.left - videoRect.left) * scaleX)
  const sy = Math.max(0, (guideRect.top - videoRect.top) * scaleY)
  const sw = Math.min(video.videoWidth - sx, guideRect.width * scaleX)
  const sh = Math.min(video.videoHeight - sy, guideRect.height * scaleY)
  const canvas = document.createElement('canvas')
  drawCoverCrop(video, video.videoWidth, video.videoHeight, canvas, sx, sy, sw, sh)
  return toBlob(canvas)
}

/** Downscale an uploaded photo before client-side OCR. Photos are never uploaded. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const canvas = document.createElement('canvas')
    drawCoverCrop(bitmap, bitmap.width, bitmap.height, canvas, 0, 0, bitmap.width, bitmap.height)
    return toBlob(canvas)
  } finally {
    bitmap.close()
  }
}
