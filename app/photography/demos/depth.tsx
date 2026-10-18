'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { PORTRAIT } from '../lab/photos'
import { autoExpose, formatAperture } from '../lab/optics'
import { Choice, Demo, Stepper, Toggle } from '../ui'

const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16]

export function DepthDemo() {
  const [depth, setDepth] = useState(true)
  const [stop, setStop] = useState(2.8)
  const [target, setTarget] = useState<'her' | 'crowd'>('her')
  const scene = usePhoto(PORTRAIT)
  const e = autoExpose(PORTRAIT.ev, { aperture: 1.48 })
  const focus = target === 'her' ? 1.6 : 6
  const shot = useMemo(
    () => (depth ? { ...e, focus, wb: PORTRAIT.kelvin, blur: 'portrait' as const, portrait: stop } : { ...e, focus: 1.6, wb: PORTRAIT.kelvin }),
    [depth, stop, focus]
  )

  return (
    <Demo title="Depth and Portrait">
      <Viewfinder scene={scene} shot={shot} label="A portrait in a busy street">
        {depth && (
          <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
            Portrait · {formatAperture(stop)}
          </div>
        )}
      </Viewfinder>
      <div className="mt-3 space-y-3">
        <Toggle label="Depth (ƒ) was on when the photo was taken" checked={depth} onChange={setDepth} />
        <Stepper
          label="Depth control (edit it any time in Photos)"
          values={STOPS}
          value={stop}
          onChange={setStop}
          format={formatAperture}
          disabled={!depth}
        />
        <Choice
          label="Focus point (also editable later)"
          options={[
            { value: 'her', label: 'Her' },
            { value: 'crowd', label: 'The crowd behind' },
          ]}
          value={target}
          onChange={setTarget}
          small
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {depth
            ? 'This blur is painted by software, using the depth map the iPhone saved. Small numbers mean more blur. Look at the edges of her hair; that is where the trick sometimes shows.'
            : 'With no depth saved, all you have is the real lens. A phone lens and sensor are tiny, so at this distance almost everything is sharp, and the trees and the crowd compete with her.'}
        </p>
      </div>
    </Demo>
  )
}
