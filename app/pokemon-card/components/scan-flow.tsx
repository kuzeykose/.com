'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Lightning, Prohibit, UploadSimple } from '@phosphor-icons/react'
import {
  BackLink,
  CardArt,
  GhostButton,
  OptionPill,
  PageIntro,
  PrimaryButton,
  PrivateBadge,
  SourceCredit,
} from './ui'
import { cropVideoToGuide, preparePhoto } from '../lib/scan/crop'
import type { Match, ScanQuery, ScanResult } from '../lib/scan/types'
import { CONDITIONS, type Condition } from '../lib/types'
import { formatUsd, printingLabel } from '../lib/format'

type Stage =
  | 'camera'
  | 'blocked'
  | 'upload'
  | 'reading'
  | 'match'
  | 'candidates'
  | 'confirm'
  | 'saved'

type SessionItem = {
  id: string
  name: string
  set: string
  number: string
  printedTotal?: number
  quantity: number
  printing: string
  condition: string
  image?: string
  at: number
}

function padNumber(value?: string | number | null) {
  if (value == null || value === '') return ''
  const text = String(value)
  return /^\d+$/.test(text) ? text.padStart(3, '0') : text
}

function numberLine(number?: string | number | null, total?: string | number | null) {
  const n = padNumber(number)
  if (!n) return ''
  return total ? `${n}/${total}` : n
}

function ocrDetected(ocr: ScanResult['ocr']) {
  const name = ocr.name ? `“${ocr.name}”` : '“?”'
  if (ocr.number && ocr.total) return `${name} · ${numberLine(ocr.number, ocr.total)}`
  if (ocr.number) return `${name} · ${ocr.number}`
  return `${name} · ?`
}

function preferUpload(mode?: string) {
  if (mode === 'upload') return true
  if (mode === 'camera') return false
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 640px)').matches
}

function relativeTime(at: number) {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 min ago'
  return `${minutes} min ago`
}

async function postScan(query: ScanQuery, signal?: AbortSignal): Promise<ScanResult> {
  const res = await fetch('/api/pokemon-card/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
    signal,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Scan failed')
  return json as ScanResult
}

export function ScanFlow({
  writable,
  mode,
}: {
  writable: boolean
  mode?: string
}) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [cameraGen, setCameraGen] = useState(0)

  const [stage, setStage] = useState<Stage>(preferUpload(mode) ? 'upload' : 'camera')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [ocrPreview, setOcrPreview] = useState<ScanResult['ocr']>({})
  const [selected, setSelected] = useState<Match | null>(null)
  const [printing, setPrinting] = useState('')
  const [condition, setCondition] = useState<Condition>('NM')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [checks, setChecks] = useState({ name: false, number: false, matching: false })
  const [session, setSession] = useState<SessionItem[]>([])

  const printings = selected?.printings?.length ? selected.printings : ['normal', 'reverseHolofoil', 'holofoil']
  const activePrinting = printing && printings.includes(printing) ? printing : printings[0]
  const market = selected?.quotes?.[activePrinting] ?? null

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setTorchOn(false)
    setHasTorch(false)
  }

  function requestCamera() {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStage('upload')
      return
    }
    setCameraGen((n) => n + 1)
    setStage('camera')
  }

  useEffect(() => {
    return () => {
      stopCamera()
      abortRef.current?.abort()
      if (preview) URL.revokeObjectURL(preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetCapture() {
    abortRef.current?.abort()
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFileName(null)
    setFileSize(null)
    setResult(null)
    setOcrPreview({})
    setSelected(null)
    setPrinting('')
    setCondition('NM')
    setQuantity(1)
    setNotes('')
    setError(null)
    setSaving(false)
    setChecks({ name: false, number: false, matching: false })
  }

  function goRescan() {
    resetCapture()
    setStage(preferUpload(mode) ? 'upload' : 'camera')
  }

  async function recognizeBlob(blob: Blob, nextPreview: string) {
    setPreview(nextPreview)
    setStage('reading')
    setError(null)
    setChecks({ name: false, number: false, matching: false })
    setOcrPreview({})
    const abort = new AbortController()
    abortRef.current = abort
    try {
      const { ocrCard } = await import('../lib/scan/ocr')
      const query = await ocrCard(blob, (progress) => {
        if (progress.ocr) {
          setOcrPreview({
            name: progress.ocr.name,
            number: progress.ocr.number,
            total: progress.ocr.total,
          })
        }
        setChecks((current) => ({
          ...current,
          name: current.name || Boolean(progress.name),
          number: current.number || Boolean(progress.number),
        }))
      })
      setOcrPreview({ name: query.name, number: query.number, total: query.total })
      setChecks({ name: true, number: true, matching: true })
      if (!query.name && !query.number && !query.rawText?.length) {
        throw new Error('Could not read a name or set number from that photo')
      }
      const next = await postScan(query, abort.signal)
      setResult(next)
      if (next.best && next.confidence >= 0.9) {
        setSelected(next.best)
        setPrinting(next.best.printings?.[0] ?? '')
        setStage('match')
      } else {
        setSelected(next.candidates[0] ?? null)
        setPrinting(next.candidates[0]?.printings?.[0] ?? '')
        setStage('candidates')
      }
    } catch (err) {
      if (abort.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Scan failed')
      setStage(preferUpload(mode) ? 'upload' : 'camera')
    }
  }

  async function capture() {
    if (!videoRef.current || !guideRef.current) return
    try {
      const blob = await cropVideoToGuide(videoRef.current, guideRef.current)
      stopCamera()
      const url = URL.createObjectURL(blob)
      await recognizeBlob(blob, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not capture')
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`)
    try {
      const prepared = await preparePhoto(file).catch(() => file)
      const url = URL.createObjectURL(prepared)
      stopCamera()
      await recognizeBlob(prepared, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo')
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn((on) => !on)
    } catch {
      setHasTorch(false)
    }
  }

  async function save() {
    if (!writable || !selected || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pokemon-card/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          quantity,
          condition,
          printing: activePrinting,
          notes,
          mode: 'add',
          catalog: {
            name: selected.name,
            number: selected.number,
            rarity: selected.rarity,
            types: selected.types,
            setId: selected.setId,
            setName: selected.set,
            printedTotal: selected.printedTotal || undefined,
            image: selected.image,
            imageLarge: selected.imageLarge ?? selected.image,
            market: selected.quotes?.[activePrinting],
            variant: activePrinting,
            updatedAt: selected.updatedAt ?? undefined,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not save')
      setSession((items) => [
        {
          id: selected.id,
          name: selected.name,
          set: selected.set,
          number: selected.number,
          printedTotal: selected.printedTotal,
          quantity,
          printing: activePrinting,
          condition,
          image: selected.image,
          at: Date.now(),
        },
        ...items,
      ])
      setStage('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function undoLast() {
    const last = session[0]
    if (!writable || !last || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/pokemon-card/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: last.id,
          quantity: last.quantity,
          condition: last.condition,
          mode: 'undo',
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not undo')
      setSession((items) => items.slice(1))
      goRescan()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo')
    } finally {
      setSaving(false)
    }
  }

  const stepLabel = useMemo(() => {
    if (stage === 'camera' || stage === 'blocked' || stage === 'upload') {
      return stage === 'blocked' ? 'Camera access' : 'Step 1 · Fit the card in the frame'
    }
    if (stage === 'reading') return 'Step 2 · Reading'
    if (stage === 'match') return 'Step 3 · Match found'
    if (stage === 'candidates') return 'Step 3 · Pick the right card'
    if (stage === 'confirm') return 'Step 4 · Details'
    return 'Saved'
  }, [stage])

  const handQuery = [result?.ocr.name, result?.ocr.number].filter(Boolean).join(' ')

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/pokemon-card/add">← add a card</BackLink>
        <PrivateBadge />
      </div>
      <div className="mt-4">
        <PageIntro title="Scan a card">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 mb-6">{stepLabel}</p>
        </PageIntro>
      </div>

      {!writable ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Scan, match and confirm work here. Saving only writes the local JSON in development (`pnpm
          dev`).
        </p>
      ) : null}

      {stage === 'blocked' ? <BlockedState onRetry={requestCamera} /> : null}

      {stage === 'camera' ? (
        <CameraStage
          key={cameraGen}
          videoRef={videoRef}
          guideRef={guideRef}
          streamRef={streamRef}
          hasTorch={hasTorch}
          torchOn={torchOn}
          onTorchAvailable={setHasTorch}
          onBlocked={() => setStage('blocked')}
          onUnavailable={() => setStage('upload')}
          onCapture={capture}
          onTorch={toggleTorch}
          onUpload={() => {
            stopCamera()
            setStage('upload')
          }}
        />
      ) : null}

      {stage === 'upload' && !preview ? (
        <UploadStage
          onFile={onFile}
          onCamera={requestCamera}
        />
      ) : null}

      {stage === 'reading' && preview ? (
        <ReadingStage
          preview={preview}
          checks={checks}
          ocr={result?.ocr ?? ocrPreview}
          onCancel={goRescan}
        />
      ) : null}

      {stage === 'match' && selected && result ? (
        <MatchStage
          selected={selected}
          result={result}
          onConfirm={() => setStage('confirm')}
          onNotThis={() => setStage('candidates')}
          onRescan={goRescan}
        />
      ) : null}

      {stage === 'candidates' && result ? (
        <CandidatesStage
          result={result}
          selected={selected}
          onSelect={(card) => {
            setSelected(card)
            setPrinting(card.printings?.[0] ?? '')
          }}
          onUse={() => selected && setStage('confirm')}
          query={handQuery}
          onRescan={goRescan}
        />
      ) : null}

      {stage === 'confirm' && selected ? (
        <ConfirmStage
          selected={selected}
          printings={printings}
          activePrinting={activePrinting}
          condition={condition}
          quantity={quantity}
          notes={notes}
          market={market}
          writable={writable}
          saving={saving}
          onPrinting={setPrinting}
          onCondition={setCondition}
          onQuantity={setQuantity}
          onNotes={setNotes}
          onChange={() => setStage(result?.candidates.length ? 'candidates' : 'match')}
          onSave={save}
        />
      ) : null}

      {stage === 'saved' && session[0] ? (
        <SavedStage
          last={session[0]}
          session={session}
          writable={writable}
          saving={saving}
          onUndo={undoLast}
          onAgain={() => {
            resetCapture()
            setStage(preferUpload(mode) ? 'upload' : 'camera')
          }}
          onDone={() => {
            router.push('/pokemon-card/collection')
            router.refresh()
          }}
        />
      ) : null}

      {fileName && preview && (stage === 'match' || stage === 'candidates') ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-4">
          {fileName}
          {fileSize ? ` · ${fileSize}` : ''}
        </p>
      ) : null}

      {error ? <p className="text-sm text-orange-600 mt-4">{error}</p> : null}
      <SourceCredit />
    </section>
  )
}

function BlockedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <div className="rounded-lg bg-black text-white aspect-[5/4] flex flex-col items-center justify-center px-6 text-center">
        <Prohibit size={28} />
        <p className="mt-3 text-base font-medium">Camera is blocked</p>
        <p className="mt-1 text-sm text-white/70">
          Allow camera access for this site in your browser settings, then try again.
        </p>
      </div>
      <PrimaryButton type="button" onClick={onRetry} className="w-full mt-4">
        Try again
      </PrimaryButton>
      <Link
        href="/pokemon-card/scan?mode=upload"
        className="h-9 mt-2 rounded-full px-4 text-sm inline-flex items-center justify-center w-full border border-neutral-200 dark:border-neutral-800"
      >
        Upload a photo instead
      </Link>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mt-4 text-sm">
        <p className="font-medium">First time?</p>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Your browser will ask: “Allow kuzey-blog to use your camera?” Tap Allow. Nothing is
          recorded.
        </p>
      </div>
    </div>
  )
}

function CameraStage({
  videoRef,
  guideRef,
  streamRef,
  hasTorch,
  torchOn,
  onTorchAvailable,
  onBlocked,
  onUnavailable,
  onCapture,
  onTorch,
  onUpload,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  guideRef: React.RefObject<HTMLDivElement | null>
  streamRef: React.RefObject<MediaStream | null>
  hasTorch: boolean
  torchOn: boolean
  onTorchAvailable: (value: boolean) => void
  onBlocked: () => void
  onUnavailable: () => void
  onCapture: () => void
  onTorch: () => void
  onUpload: () => void
}) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailable()
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() as { torch?: boolean } | undefined
        onTorchAvailable(Boolean(caps?.torch))
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          onBlocked()
        } else {
          onUnavailable()
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Attach once per mount (parent remounts with a key after Try again).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="relative rounded-lg bg-black overflow-hidden aspect-[5/4] text-white">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/70 px-3 py-1 text-xs mb-3">
            Fit the card inside the frame
          </div>
          <div
            ref={guideRef}
            className="relative aspect-[63/88] w-[46%] rounded-md border-2 border-white"
          >
            <div className="absolute top-[6%] left-[7%] right-[18%] h-[9%] rounded-sm border border-orange-600 flex items-center px-1.5 text-[9px] tracking-wide text-orange-600">
              NAME
            </div>
            <div className="absolute bottom-[6%] left-[7%] w-[52%] h-[9%] rounded-sm border border-orange-600 flex items-center px-1.5 text-[9px] tracking-wide text-orange-600">
              SET · 025/165
            </div>
          </div>
          <div className="rounded-full bg-black/70 px-3 py-1 text-xs mt-3">
            Hold steady · good light
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 px-2">
        <button type="button" onClick={onUpload} className="text-sm text-neutral-600 dark:text-neutral-400">
          <UploadSimple className="inline mr-1" /> Upload
        </button>
        <button
          type="button"
          onClick={onCapture}
          aria-label="Capture card"
          className="h-16 w-16 rounded-full bg-white border-[6px] border-neutral-900 dark:border-white"
        />
        <button
          type="button"
          onClick={onTorch}
          disabled={!hasTorch}
          className={`text-sm ${torchOn ? 'text-orange-600' : 'text-neutral-600 dark:text-neutral-400'} disabled:opacity-40`}
        >
          <Lightning className="inline mr-1" /> Light
        </button>
      </div>
      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-4 text-center">
        Reads the <span className="text-orange-600">name</span> (top) and{' '}
        <span className="text-orange-600">set number</span> (bottom, e.g. 025/165)
      </p>
    </div>
  )
}

function UploadStage({
  onFile,
  onCamera,
}: {
  onFile: (file: File | undefined) => void
  onCamera: () => void
}) {
  return (
    <div>
      <label className="block rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-10 text-center text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        Drop a photo here, or <span className="underline">browse</span> — JPEG, PNG, HEIC. Photos
        aren&apos;t stored.
      </label>
      <button
        type="button"
        onClick={onCamera}
        className="mt-4 text-sm text-neutral-600 dark:text-neutral-400 underline decoration-neutral-400 underline-offset-2"
      >
        <Camera className="inline mr-1" /> Use camera instead
      </button>
    </div>
  )
}

function PhotoFrame({ src, captured = false }: { src: string; captured?: boolean }) {
  return (
    <div className="relative rounded-lg bg-black overflow-hidden aspect-[5/4]">
      {captured ? (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
          Captured
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Captured card" className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative aspect-[63/88] w-[46%] rounded-md border-2 border-white">
          <div className="absolute top-[6%] left-[7%] right-[18%] h-[9%] rounded-sm border border-orange-600" />
          <div className="absolute bottom-[6%] left-[7%] w-[52%] h-[9%] rounded-sm border border-orange-600" />
          {captured ? <div className="absolute left-0 right-0 top-1/2 h-px bg-orange-600" /> : null}
        </div>
      </div>
    </div>
  )
}

function ReadingStage({
  preview,
  checks,
  ocr,
  onCancel,
}: {
  preview: string
  checks: { name: boolean; number: boolean; matching: boolean }
  ocr?: ScanResult['ocr']
  onCancel: () => void
}) {
  return (
    <div>
      <PhotoFrame src={preview} captured />
      <div className="flex items-center justify-between text-sm mt-4">
        <span>Reading name and number…</span>
        <span className="tabular-nums text-neutral-600 dark:text-neutral-400">2/3</span>
      </div>
      <div className="h-1 rounded-sm bg-neutral-200 dark:bg-neutral-800 mt-2">
        <span className="block h-full w-2/3 rounded-sm bg-orange-600" />
      </div>
      <dl className="mt-4 text-sm space-y-2">
        <div className="flex justify-between">
          <dt className="text-neutral-600 dark:text-neutral-400">Name</dt>
          <dd>{checks.name ? `${ocr?.name ?? '…'} ✓` : '…'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600 dark:text-neutral-400">Number</dt>
          <dd>{checks.number ? `${numberLine(ocr?.number, ocr?.total) || '…'} ✓` : '…'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600 dark:text-neutral-400">Matching</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">
            {checks.matching ? 'Searching card catalogs…' : '…'}
          </dd>
        </div>
      </dl>
      <GhostButton type="button" onClick={onCancel} className="w-full mt-4">
        Cancel
      </GhostButton>
    </div>
  )
}

function MatchStage({
  selected,
  result,
  onConfirm,
  onNotThis,
  onRescan,
}: {
  selected: Match
  result: ScanResult
  onConfirm: () => void
  onNotThis: () => void
  onRescan: () => void
}) {
  const type = selected.types?.[0]
  return (
    <div>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm flex justify-between gap-3 mb-4">
        <span className="text-neutral-600 dark:text-neutral-400">Detected</span>
        <span className="font-[family-name:var(--font-geist-mono),ui-monospace,monospace] text-xs">
          {ocrDetected(result.ocr)}
        </span>
      </div>
      <div className="rounded-lg outline outline-1 outline-orange-600 outline-offset-4 p-0">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <CardArt src={selected.image} name={selected.name} type={type} />
          <div className="text-sm">
            <p className="font-medium text-base">{selected.name}</p>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {selected.set} · {numberLine(selected.number, selected.printedTotal || undefined)}
              {selected.rarity ? ` · ${selected.rarity}` : ''}
              {type ? ` · ${type}` : ''}
            </p>
            <p className="mt-2">High confidence · {Math.round(result.confidence * 100)}%</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
              {formatUsd(selected.quotes?.[selected.printings?.[0] ?? ''] ?? null)} · TCGplayer
              market · USD
            </p>
          </div>
        </div>
      </div>
      <PrimaryButton type="button" onClick={onConfirm} className="w-full mt-6">
        Confirm · {selected.name} {numberLine(selected.number, selected.printedTotal || undefined)}
      </PrimaryButton>
      <GhostButton type="button" onClick={onNotThis} className="w-full mt-2">
        Not this card
      </GhostButton>
      <button type="button" onClick={onRescan} className="block mx-auto mt-3 text-sm underline underline-offset-2">
        Rescan
      </button>
    </div>
  )
}

function CandidatesStage({
  result,
  selected,
  onSelect,
  onUse,
  query,
  onRescan,
}: {
  result: ScanResult
  selected: Match | null
  onSelect: (card: Match) => void
  onUse: () => void
  query: string
  onRescan: () => void
}) {
  const reason =
    !result.ocr.number || !result.ocr.total
      ? 'Low confidence. The set number was partly unreadable.'
      : 'Low confidence. A few printings share this number.'

  return (
    <div>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm mb-2">
        <div className="flex justify-between gap-3">
          <span className="text-neutral-600 dark:text-neutral-400">Detected</span>
          <span className="font-[family-name:var(--font-geist-mono),ui-monospace,monospace] text-xs">
            {ocrDetected(result.ocr)}
          </span>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{reason}</p>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-4 mb-3">
        Closest matches · tap to pick
      </p>
      {result.candidates.length === 0 ? (
        <p className="text-sm">No close matches. Search by hand instead.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {result.candidates.slice(0, 4).map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card)}
              className="text-left min-w-0"
              aria-pressed={selected?.id === card.id}
            >
              <div className={selected?.id === card.id ? 'rounded-md outline outline-1 outline-orange-600 outline-offset-2' : ''}>
                <CardArt src={card.image} name={card.name} type={card.types?.[0]} />
              </div>
              <div className="mt-2 text-xs tracking-tight truncate">{card.name}</div>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                {card.set.split(' ').slice(0, 2).join(' ')}
                <br />
                {numberLine(card.number, card.printedTotal || undefined)}
                <br />
                {Math.round(card.score * 100)}%
              </div>
            </button>
          ))}
        </div>
      )}
      <PrimaryButton type="button" disabled={!selected} onClick={onUse} className="w-full mt-6">
        {selected
          ? `Use ${selected.set} ${numberLine(selected.number, selected.printedTotal || undefined)}`
          : 'Pick a card'}
      </PrimaryButton>
      <Link
        href={`/pokemon-card/add${query ? `?q=${encodeURIComponent(query)}` : ''}`}
        className="block text-center text-sm mt-3 underline underline-offset-2 text-neutral-600 dark:text-neutral-400"
      >
        Search by hand instead{query ? ` · prefilled “${query}”` : ''}
      </Link>
      <button type="button" onClick={onRescan} className="block mx-auto mt-3 text-sm underline underline-offset-2">
        Rescan
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function ConfirmStage({
  selected,
  printings,
  activePrinting,
  condition,
  quantity,
  notes,
  market,
  writable,
  saving,
  onPrinting,
  onCondition,
  onQuantity,
  onNotes,
  onChange,
  onSave,
}: {
  selected: Match
  printings: string[]
  activePrinting: string
  condition: Condition
  quantity: number
  notes: string
  market: number | null
  writable: boolean
  saving: boolean
  onPrinting: (value: string) => void
  onCondition: (value: Condition) => void
  onQuantity: (value: number | ((n: number) => number)) => void
  onNotes: (value: string) => void
  onChange: () => void
  onSave: () => void
}) {
  return (
    <div>
      <div className="grid grid-cols-[96px_1fr] gap-4 mb-6">
        <CardArt src={selected.image} name={selected.name} type={selected.types?.[0]} />
        <div>
          <p className="font-medium">{selected.name}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {selected.set} · {numberLine(selected.number, selected.printedTotal || undefined)}
            {selected.rarity ? ` · ${selected.rarity}` : ''}
          </p>
          <button type="button" onClick={onChange} className="text-xs underline underline-offset-2 mt-2">
            Matched by scan · change
          </button>
        </div>
      </div>
      <Field label="Printing">
        <div className="flex flex-wrap gap-1.5">
          {printings.map((key) => (
            <OptionPill key={key} selected={activePrinting === key} onClick={() => onPrinting(key)}>
              {printingLabel(key)}
            </OptionPill>
          ))}
        </div>
      </Field>
      <Field label="Condition">
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((item) => (
            <OptionPill key={item} selected={condition === item} onClick={() => onCondition(item)}>
              {item}
            </OptionPill>
          ))}
        </div>
      </Field>
      <Field label="Quantity">
        <div className="flex flex-wrap gap-1.5 items-center">
          <OptionPill onClick={() => onQuantity((n) => Math.max(1, n - 1))}>−</OptionPill>
          <span className="px-2 text-sm tabular-nums">{quantity}</span>
          <OptionPill onClick={() => onQuantity((n) => Math.min(99, n + 1))}>+</OptionPill>
        </div>
      </Field>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="Optional"
          rows={2}
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm bg-transparent outline-none focus:border-orange-600"
        />
      </Field>
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-sm tabular-nums mb-3">
          {formatUsd(market)}{' '}
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            TCGplayer · example
          </span>
        </p>
        <PrimaryButton type="button" disabled={!writable || saving} onClick={onSave} className="w-full">
          {saving ? 'Saving…' : 'Add to collection'}
        </PrimaryButton>
        {!writable ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-3">
            Saving only writes the local JSON in development (`pnpm dev`).
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SavedStage({
  last,
  session,
  writable,
  saving,
  onUndo,
  onAgain,
  onDone,
}: {
  last: SessionItem
  session: SessionItem[]
  writable: boolean
  saving: boolean
  onUndo: () => void
  onAgain: () => void
  onDone: () => void
}) {
  return (
    <div>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 grid grid-cols-[72px_1fr] gap-3">
        <CardArt src={last.image} name={last.name} />
        <div className="text-sm">
          <p className="text-orange-600">✓ Saved</p>
          <p className="font-medium mt-1">
            {last.name} ×{last.quantity}
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {last.set} · {numberLine(last.number, last.printedTotal)} · {last.condition} ·{' '}
            {printingLabel(last.printing)}
          </p>
          <p className="mt-2 text-xs">
            {writable ? (
              <button type="button" onClick={onUndo} disabled={saving} className="underline underline-offset-2 mr-3">
                Undo
              </button>
            ) : null}
            <Link href={`/pokemon-card/${last.id}`} className="underline underline-offset-2">
              view card
            </Link>
          </p>
        </div>
      </div>
      <PrimaryButton type="button" onClick={onAgain} className="w-full mt-4">
        Scan another
      </PrimaryButton>
      <GhostButton type="button" onClick={onDone} className="w-full mt-2">
        Done
      </GhostButton>
      <h2 className="text-base font-medium mt-8 mb-3">This session · {session.length} cards</h2>
      {session.map((item) => (
        <div key={`${item.id}-${item.at}`} className="flex gap-2 mb-3 text-sm">
          <div className="w-[100px] shrink-0 text-neutral-600 dark:text-neutral-400 tabular-nums">
            {relativeTime(item.at)}
          </div>
          <div>
            {item.name} · {numberLine(item.number, item.printedTotal)}
          </div>
        </div>
      ))}
    </div>
  )
}
