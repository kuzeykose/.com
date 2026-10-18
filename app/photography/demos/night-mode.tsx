'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { NIGHT } from '../lab/photos'
import { ISO_MIN, autoExpose, formatIso, formatShutter, meterReading } from '../lab/optics'
import { Choice, Demo, Meter, Readout, Toggle } from '../ui'

type Setting = 0 | 1 | 3 | 10 | 30

const OPTIONS: { value: Setting; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1s' },
  { value: 3, label: '3s (Auto)' },
  { value: 10, label: '10s (Max)' },
  { value: 30, label: '30s (tripod)' },
]

export function NightModeDemo() {
  const [time, setTime] = useState<Setting>(3)
  const [tripod, setTripod] = useState(false)
  // The same street much later, with far less light about.
  const scene = usePhoto(NIGHT)
  const ev = -1.5
  const N = 1.48
  const usable = tripod || time !== 30

  // Off: one normal frame, as fast as the phone dares, ISO as high as needed.
  // On: many frames over `time` seconds, lined up and merged, which collects
  // as much light as one long exposure without the shake.
  const e =
    time === 0 || !usable
      ? autoExpose(ev, { aperture: N, slowest: 1 / 15 })
      : { aperture: N, shutter: time, iso: Math.max(ISO_MIN, 100 * Math.pow(2, Math.log2((N * N) / time) - ev)) }
  const stops = meterReading(ev, e)
  // The darkroom exposes for the photo's own light level; shift it down to this one.
  const shot = useMemo(
    () => ({ ...e, focus: 3, wb: NIGHT.kelvin, gain: ev - NIGHT.ev, shake: tripod ? 0 : 1, shakeTime: time === 0 ? e.shutter : 1 / 15 }),
    [e.shutter, e.iso, tripod, time]
  )

  return (
    <Demo title="Night mode">
      <Viewfinder scene={scene} shot={shot} label="A very dark street">
        {time > 0 && usable && (
          <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-black">
            ☾ {time}s
          </div>
        )}
      </Viewfinder>
      <div className="mt-3 space-y-3">
        <Choice label="Night mode" options={OPTIONS} value={time} onChange={setTime} small />
        <Toggle label="Phone on a tripod (or propped on something solid)" checked={tripod} onChange={setTripod} />
        {!usable && <p className="text-sm text-orange-700 dark:text-orange-400">30 seconds only appears when the iPhone feels it is held perfectly still.</p>}
        <Readout
          items={[
            { label: 'time', value: formatShutter(e.shutter) },
            { label: 'ISO equiv.', value: formatIso(e.iso), warn: e.iso >= 1600 },
          ]}
        />
        <Meter stops={stops} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {time === 0
            ? 'Without Night mode the phone has to grab one quick frame and turn ISO right up. Look at the grain on the road and the wall.'
            : time >= 10
              ? 'More time, more light, less grain. Anyone who moves in those seconds turns into a soft ghost, so ask people to hold still. Very long exposures can also make night look like day.'
              : 'The iPhone shoots a burst over a few seconds, lines the frames up and merges them. Much cleaner, and handheld is fine. Ask people to hold still while the timer counts down.'}
        </p>
      </div>
    </Demo>
  )
}
