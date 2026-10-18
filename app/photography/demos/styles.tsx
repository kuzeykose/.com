'use client'

import { useMemo, useRef, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { PORTRAIT } from '../lab/photos'
import { autoExpose } from '../lab/optics'
import { STYLES, styleGrade, type StyleName } from '../lab/grade'
import { Demo, Range } from '../ui'

export function StylesDemo() {
  const [style, setStyle] = useState<StyleName>('Standard')
  const [tone, setTone] = useState(0)
  const [color, setColor] = useState(0)
  const [palette, setPalette] = useState(1)
  const scene = usePhoto(PORTRAIT)
  const e = autoExpose(PORTRAIT.ev, { aperture: 1.8 })
  const grade = useMemo(() => styleGrade(style, palette, tone, color), [style, palette, tone, color])
  const shot = useMemo(() => ({ ...e, focus: 1.6, wb: PORTRAIT.kelvin, grade, noise: false }), [grade])
  const info = STYLES.find((s) => s.name === style)!

  return (
    <Demo title="Photographic Styles">
      <div className="grid gap-3 sm:grid-cols-[1fr_9.5rem]">
        <Viewfinder scene={scene} shot={shot} label={`A portrait in the ${style} style`} />
        <div className="flex flex-row items-start gap-3 sm:flex-col">
          <Pad tone={tone} color={color} onChange={(t, c) => (setTone(t), setColor(c))} />
          <div className="flex-1 text-xs text-neutral-500 sm:flex-none">
            Drag the dot. Up and down is <b>Tone</b> (shadows and contrast). Left and right is <b>Color</b>.
            <button type="button" className="mt-1 block text-orange-600 underline" onClick={() => (setTone(0), setColor(0))}>
              Reset
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {(['undertone', 'mood'] as const).map((kind) => (
          <div key={kind}>
            <div className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">{kind === 'undertone' ? 'Undertones (mostly skin and warmth)' : 'Moods'}</div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.filter((s) => s.kind === kind).map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={style === s.name}
                  onClick={() => {
                    setStyle(s.name)
                    setPalette(1)
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    style === s.name
                      ? 'border-orange-600 bg-orange-600 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-orange-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Range label="Palette (how strong the style is)" min={0} max={1} step={0.01} value={palette} onChange={setPalette} format={(p) => `${Math.round(p * 100)}`} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          <b>{style}:</b> {info.note} On your iPhone the style is saved with the photo but not burnt in: open the photo, tap
          Edit, and you can change it or take it off.
        </p>
      </div>
    </Demo>
  )
}

// The square Tone/Color pad from the Camera app.
function Pad({ tone, color, onChange }: { tone: number; color: number; onChange: (tone: number, color: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    if (e.type === 'pointermove' && e.buttons === 0) return
    const r = ref.current!.getBoundingClientRect()
    const c = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    const t = Math.max(-1, Math.min(1, 1 - ((e.clientY - r.top) / r.height) * 2))
    onChange(Math.round(t * 20) / 20, Math.round(c * 20) / 20)
  }
  const key = (e: React.KeyboardEvent) => {
    const step = 0.1
    const k = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] }[e.key]
    if (!k) return
    e.preventDefault()
    onChange(Math.max(-1, Math.min(1, tone + k[0])), Math.max(-1, Math.min(1, color + k[1])))
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Tone and color"
      aria-valuetext={`Tone ${Math.round(tone * 100)}, Color ${Math.round(color * 100)}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={move}
      onKeyDown={key}
      className="relative aspect-square w-28 shrink-0 cursor-crosshair touch-none rounded-lg border border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 sm:w-full dark:border-neutral-700"
      style={{
        background:
          'linear-gradient(to right, rgba(128,128,128,0.9), rgba(128,128,128,0) 50%, rgba(255,120,60,0.0) 50%, rgba(255,90,40,0.55)), linear-gradient(to top, #e8e8e8, #555)',
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/50" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
      <div
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-600 shadow"
        style={{ left: `${((color + 1) / 2) * 100}%`, top: `${((1 - tone) / 2) * 100}%` }}
      />
    </div>
  )
}
