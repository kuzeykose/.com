// The Camera app's controls panel, redrawn. Each button jumps to the
// lesson for that control.

import type { ReactNode } from 'react'

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const slash = <path d="M5 4 19 20" {...S} />

export const ICONS: Record<string, ReactNode> = {
  flash: (
    <>
      <path d="M13.5 3 6.5 13h5l-1 8 7-10h-5z" {...S} />
      {slash}
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} strokeDasharray="0.1 2.2" strokeWidth={1.8} />
      <circle cx="12" cy="12" r="5.5" {...S} />
      <circle cx="12" cy="12" r="2.2" {...S} />
      {slash}
    </>
  ),
  aspect: (
    <>
      <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" {...S} />
      <text x="12" y="14.6" textAnchor="middle" fontSize="7.5" fill="currentColor" fontFamily="system-ui, sans-serif">
        4:3
      </text>
    </>
  ),
  timer: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" {...S} />
      {slash}
    </>
  ),
  exposure: (
    <>
      <path d="M12 5v7M8.5 8.5h7M7 15.5h10M7 19h10" {...S} />
    </>
  ),
  styles: (
    <>
      {[5, 8.5, 12, 15.5, 19].flatMap((x) =>
        [5, 8.5, 12, 15.5, 19].map((y) =>
          x === 12 && y === 12 ? null : <circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill="currentColor" />
        )
      )}
      <circle cx="12" cy="12" r="1.8" {...S} />
    </>
  ),
  depth: (
    <>
      <path d="M15.5 5.5c-1.5-1.2-3.5-.6-4 1.5l-2.5 10c-.5 2-2.5 2.6-4 1.5M8 10h7" {...S} />
      {slash}
    </>
  ),
  night: (
    <>
      <path d="M14 6.5a7 7 0 1 0 5.5 9.5 6 6 0 0 1-5.5-9.5z" fill="currentColor" />
      <text x="17.5" y="9.5" textAnchor="middle" fontSize="7" fill="currentColor" fontFamily="system-ui, sans-serif">
        A
      </text>
    </>
  ),
  format: (
    <>
      <text x="12" y="11" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="currentColor" fontFamily="system-ui, sans-serif">
        HEIF
      </text>
      <text x="12" y="19" textAnchor="middle" fontSize="6.5" fill="currentColor" fontFamily="system-ui, sans-serif">
        24
      </text>
    </>
  ),
  aperture: (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M12 3.5 15.2 12" {...S} transform={`rotate(${a} 12 12)`} />
      ))}
    </>
  ),
  focus: (
    <>
      <path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" {...S} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  shutter: (
    <>
      <circle cx="12" cy="12" r="8" {...S} strokeDasharray="0.1 2.4" strokeWidth={1.8} />
      <path d="M12 12V5" {...S} strokeWidth={2} />
    </>
  ),
  'white-balance': (
    <>
      <path d="M15 5.5v-1.5M19 7.5l1-1M20.5 11.5H22M10.5 7.5l-1-1" {...S} />
      <path d="M12 9.5a3.5 3.5 0 0 1 6.7 1.4" {...S} />
      <path d="M7 19h9.5a3 3 0 0 0 .3-6 4.5 4.5 0 0 0-8.6.8A2.6 2.6 0 0 0 7 19z" {...S} />
    </>
  ),
  histogram: (
    <>
      <path d="M3.5 18.5h17M4 18c2-4 3.5-6 5-6s2 2 3 2 3-6 5-6 2.5 6 3 10" {...S} />
    </>
  ),
}

export const CONTROLS: { id: string; icon: keyof typeof ICONS; name: string; does: string }[] = [
  { id: 'flash', icon: 'flash', name: 'Flash', does: 'Adds light up close' },
  { id: 'live', icon: 'live', name: 'Live', does: 'Records 3 seconds around the shot' },
  { id: 'aspect', icon: 'aspect', name: 'Aspect', does: 'The shape of the picture' },
  { id: 'timer', icon: 'timer', name: 'Timer', does: 'Waits before shooting' },
  { id: 'exposure', icon: 'exposure', name: 'Exposure', does: 'Brighter or darker' },
  { id: 'styles', icon: 'styles', name: 'Styles', does: 'The look and colour' },
  { id: 'depth', icon: 'depth', name: 'Depth', does: 'Saves depth for Portraits' },
  { id: 'night-mode', icon: 'night', name: 'Night mode', does: 'Long, stacked shots in the dark' },
  { id: 'format', icon: 'format', name: 'Format', does: 'File type and megapixels' },
  { id: 'aperture', icon: 'aperture', name: 'Lens aperture', does: 'How wide the lens opens' },
  { id: 'focus', icon: 'focus', name: 'Focus', does: 'What is sharp' },
  { id: 'shutter-speed', icon: 'shutter', name: 'Shutter speed', does: 'How long it looks' },
  { id: 'white-balance', icon: 'white-balance', name: 'White balance', does: 'Warm or cool colour' },
  { id: 'histogram', icon: 'histogram', name: 'Histogram', does: 'A graph of brightness' },
]

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  )
}

export function ControlMap() {
  return (
    <figure className="my-8 lg:-mx-24">
      <div
        className="mx-auto max-w-md rounded-[2.2rem] border border-neutral-700 p-5 pt-3 shadow-xl sm:p-7 sm:pt-4"
        style={{ background: 'linear-gradient(#5d5d5d, #2b2b2b)' }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-neutral-400/70" />
        <ul className="grid grid-cols-3 gap-x-2 gap-y-5">
          {CONTROLS.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                className="group flex flex-col items-center gap-2 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900/80 text-white transition-colors group-hover:bg-orange-600 sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Icon name={c.icon} className="h-8 w-8" />
                </span>
                <span className="text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-white">{c.name}</span>
                <span className="hidden text-[11px] leading-tight text-neutral-300 sm:block">{c.does}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 px-1 text-center text-sm text-neutral-500 dark:text-neutral-400">
        The controls panel from your Camera app. Tap any button to jump to its lesson.
      </figcaption>
    </figure>
  )
}
