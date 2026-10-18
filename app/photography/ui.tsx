'use client'

import { useId, type ReactNode } from 'react'

// A demo sits in a card that breaks out a little wider than the text on
// big screens.
export function Demo({ title, children, caption }: { title: string; children: ReactNode; caption?: ReactNode }) {
  return (
    <figure className="my-8 lg:-mx-24">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-orange-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-600" />
          Try it · {title}
        </div>
        {children}
      </div>
      {caption && <figcaption className="mt-2 px-1 text-sm text-neutral-500 dark:text-neutral-400">{caption}</figcaption>}
    </figure>
  )
}

// A slider that steps through a list of values.
export function Stepper<T>({
  label,
  values,
  value,
  onChange,
  format,
  disabled,
  hint,
}: {
  label: string
  values: T[]
  value: T
  onChange: (v: T) => void
  format: (v: T) => string
  disabled?: boolean
  hint?: ReactNode
}) {
  const id = useId()
  const index = Math.max(0, values.indexOf(value))
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
        <span className="font-mono text-neutral-900 tabular-nums dark:text-neutral-100">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        onChange={(e) => onChange(values[Number(e.target.value)])}
        className="mt-1 w-full accent-orange-600"
        aria-valuetext={format(value)}
      />
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}

export function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  disabled,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format: (v: number) => string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
        <span className="font-mono text-neutral-900 tabular-nums dark:text-neutral-100">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-orange-600"
        aria-valuetext={format(value)}
      />
    </div>
  )
}

// Infer a Choice's type from its value alone, not from its options.
type Exactly<T> = [T][T extends unknown ? 0 : never]

export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  small,
}: {
  label?: string
  options: { value: Exactly<T>; label: ReactNode; title?: string }[]
  value: T
  onChange: (v: Exactly<T>) => void
  small?: boolean
}) {
  return (
    <div>
      {label && <div className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">{label}</div>}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              title={o.title}
              onClick={() => onChange(o.value)}
              className={`rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                small ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
              } ${
                on
                  ? 'border-orange-600 bg-orange-600 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-orange-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700 select-none dark:text-neutral-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-orange-600" />
      {label}
    </label>
  )
}

export function Button({ children, onClick, disabled, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 disabled:opacity-40 ${
        primary
          ? 'bg-orange-600 text-white hover:bg-orange-700'
          : 'border border-neutral-300 bg-white text-neutral-800 hover:border-orange-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
    >
      {children}
    </button>
  )
}

// The camera's settings as a row of chips, like the readout on a camera.
export function Readout({ items }: { items: { label: string; value: string; warn?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 font-mono text-xs">
      {items.map((i) => (
        <span
          key={i.label}
          className={`rounded-md px-2 py-1 tabular-nums ${
            i.warn
              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
              : 'bg-neutral-200/70 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
          }`}
        >
          <span className="text-neutral-500 dark:text-neutral-400">{i.label} </span>
          {i.value}
        </span>
      ))}
    </div>
  )
}

// A brightness histogram: dark tones on the left, bright on the right.
export function Histogram({
  data,
  height = 64,
  marks = true,
  onHover,
  selected,
}: {
  data: Uint32Array | null
  height?: number
  marks?: boolean
  onHover?: (range: [number, number] | null) => void
  selected?: [number, number] | null
}) {
  const bins = 64
  const counts = new Array(bins).fill(0)
  if (data) for (let i = 0; i < 256; i++) counts[i >> 2] += data[i]
  const total = counts.reduce((a, b) => a + b, 0) || 1
  // A square-root scale keeps a tall spike from flattening everything else.
  const max = Math.sqrt(Math.max(...counts) / total) || 1
  const pts = counts.map((c, i) => `${(i / (bins - 1)) * 100},${100 - (Math.sqrt(c / total) / max) * 96}`)
  const low = data ? counts[0] / total : 0
  const high = data ? counts[bins - 1] / total : 0
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onHover) return
    const r = e.currentTarget.getBoundingClientRect()
    const t = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width))
    const centre = Math.floor(t * 256)
    onHover([Math.max(0, centre - 16), Math.min(255, centre + 16)])
  }
  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`block w-full rounded-md bg-neutral-900 ${onHover ? 'cursor-col-resize touch-none' : ''}`}
        style={{ height }}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => onHover?.(null)}
        role="img"
        aria-label="Histogram of the picture's brightness"
      >
        {selected && <rect x={(selected[0] / 255) * 100} y={0} width={((selected[1] - selected[0]) / 255) * 100} height={100} fill="rgb(234 88 12 / 0.35)" />}
        <polygon points={`0,100 ${pts.join(' ')} 100,100`} fill="rgb(245 245 245 / 0.85)" />
        {marks && low > 0.02 && <rect x={0} y={0} width={1.6} height={100} fill="#3b82f6" />}
        {marks && high > 0.02 && <rect x={98.4} y={0} width={1.6} height={100} fill="#ef4444" />}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-neutral-500">
        <span>Shadows</span>
        <span>Highlights</span>
      </div>
    </div>
  )
}

// A light meter, −3 to +3 stops, like the one in a camera's viewfinder.
export function Meter({ stops }: { stops: number }) {
  const clamped = Math.max(-3, Math.min(3, stops))
  const label = Math.abs(stops) < 0.17 ? 'just right' : stops > 0 ? `${stops > 3 ? '3+' : stops.toFixed(1)} stops too bright` : `${stops < -3 ? '3+' : (-stops).toFixed(1)} stops too dark`
  return (
    <div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-3 h-px bg-neutral-300 dark:bg-neutral-700" />
        {[-3, -2, -1, 0, 1, 2, 3].map((s) => (
          <div key={s} className="absolute top-1.5 text-[10px] text-neutral-500" style={{ left: `${((s + 3) / 6) * 100}%`, transform: 'translateX(-50%)' }}>
            <div className={`mx-auto w-px ${s === 0 ? 'h-3 bg-neutral-500' : 'h-2 bg-neutral-400 dark:bg-neutral-600'}`} />
          </div>
        ))}
        <div
          className={`absolute top-0.5 h-5 w-1.5 rounded-full transition-[left] ${Math.abs(stops) < 0.5 ? 'bg-emerald-500' : 'bg-orange-600'}`}
          style={{ left: `calc(${((clamped + 3) / 6) * 100}% - 3px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-neutral-500">
        <span>−3 darker</span>
        <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
        <span>brighter +3</span>
      </div>
    </div>
  )
}

export function Note({ children, kind = 'tip' }: { children: ReactNode; kind?: 'tip' | 'phone' | 'warn' }) {
  const head = kind === 'phone' ? 'On your iPhone' : kind === 'warn' ? 'Watch out' : 'Tip'
  return (
    <aside
      className={`my-6 rounded-lg border-l-2 py-2 pr-3 pl-4 text-sm ${
        kind === 'phone'
          ? 'border-orange-600 bg-orange-50 text-neutral-800 dark:bg-orange-950/40 dark:text-neutral-200'
          : kind === 'warn'
            ? 'border-red-500 bg-red-50 text-neutral-800 dark:bg-red-950/30 dark:text-neutral-200'
            : 'border-neutral-400 bg-neutral-100 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200'
      }`}
    >
      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">{head}</div>
      {children}
    </aside>
  )
}
