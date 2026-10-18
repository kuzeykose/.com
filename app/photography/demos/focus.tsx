'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { CAFE_CLOSE } from '../lab/photos'
import { autoExpose } from '../lab/optics'
import { Demo, Range, Toggle } from '../ui'

// Focus distance on a log scale, from close-up to far away.
const MIN = Math.log(0.2)
const MAX = Math.log(8)
const toDistance = (t: number) => Math.exp(MIN + t * (MAX - MIN))
const toSlider = (d: number) => (Math.log(d) - MIN) / (MAX - MIN)
const formatDistance = (d: number) => (d >= 7.9 ? 'far away' : d < 1 ? `${Math.round(d * 100)} cm` : `${d.toFixed(1)} m`)

export function FocusDemo() {
  const [focus, setFocus] = useState(0.36)
  const [what, setWhat] = useState<string>('the cappuccino')
  const [peaking, setPeaking] = useState(false)
  const [mark, setMark] = useState<{ x: number; y: number } | null>({ x: 0.55, y: 0.7 })
  const scene = usePhoto(CAFE_CLOSE)
  const e = autoExpose(CAFE_CLOSE.ev, { aperture: 1.48 })
  const shot = useMemo(() => ({ ...e, focus, wb: CAFE_CLOSE.kelvin }), [focus])
  const overlay = useMemo(() => (peaking ? { peaking: true } : undefined), [peaking])

  return (
    <Demo title="Focus">
      <Viewfinder
        scene={scene}
        shot={shot}
        overlay={overlay}
        onTap={(hit) => {
          setFocus(hit.depth)
          setWhat(hit.label ?? 'that')
          setMark({ x: hit.x, y: hit.y })
        }}
        label="Tap anything to focus on it"
      >
        {mark && (
          <div
            className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 border border-amber-300"
            style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
          />
        )}
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">
          Tap to focus
        </div>
      </Viewfinder>
      <div className="mt-3 space-y-3">
        <Range
          label="Focus distance"
          min={0}
          max={1}
          step={0.005}
          value={toSlider(focus)}
          onChange={(t) => {
            setFocus(toDistance(t))
            setWhat('')
            setMark(null)
          }}
          format={(t) => formatDistance(toDistance(t))}
        />
        <Toggle label="Focus peaking (outline what's sharp in yellow)" checked={peaking} onChange={setPeaking} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {what ? `Focused on ${what}, ${formatDistance(focus)} away. ` : ''}
          Only one distance can be perfectly sharp. Up close at ƒ/1.48 the zone around it is thin, so the cup
          and the bike behind it can't both be sharp. Tap them in turn and watch the other one soften.
        </p>
      </div>
    </Demo>
  )
}
