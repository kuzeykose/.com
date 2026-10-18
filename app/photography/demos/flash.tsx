'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { NIGHT } from '../lab/photos'
import { autoExpose, formatIso, formatShutter } from '../lab/optics'
import { Choice, Demo, Range, Readout } from '../ui'

export function FlashDemo() {
  const [flash, setFlash] = useState(true)
  // How far you stand back from where this photo was taken.
  const [back, setBack] = useState(0)
  const scene = usePhoto(NIGHT)
  const nearest = 2.6 + back
  // A phone's LED at one metre is about as bright as an EV 9 room, and it
  // fades with the square of the distance.
  const boost = flash ? Math.pow(2, 9 - NIGHT.ev) / (nearest * nearest) : 0
  // With the flash firing, the camera exposes for whoever it lights.
  const e = autoExpose(NIGHT.ev + Math.log2(1 + boost * 1.3), { aperture: 1.48 })
  const shot = useMemo(
    () => ({ ...e, focus: nearest, wb: flash ? 5000 : NIGHT.kelvin, flash, flashDistance: back }),
    [e.shutter, e.iso, nearest, flash, back]
  )
  const reach = boost > 1 ? (boost > 6 ? 'blasted with light' : 'lit by the flash') : boost > 0.15 ? 'barely touched by the flash' : 'out of reach of the flash'

  return (
    <Demo title="Flash">
      <Viewfinder scene={scene} shot={shot} label={`Friends at night, the nearest ${nearest.toFixed(1)} m away`} />
      <div className="mt-3 space-y-3">
        <Choice
          label="Flash"
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          value={flash ? 'on' : 'off'}
          onChange={(v) => setFlash(v === 'on')}
          small
        />
        <Range
          label="How far away the nearest friend is"
          min={-1.4}
          max={5.4}
          step={0.1}
          value={back}
          onChange={setBack}
          format={(b) => `${(2.6 + b).toFixed(1)} m`}
        />
        <Readout
          items={[
            { label: 'shutter', value: formatShutter(e.shutter) },
            { label: 'ISO', value: formatIso(e.iso), warn: e.iso >= 1600 },
          ]}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {flash
            ? `The nearest friend is ${reach}. Light from a small flash fades fast: twice as far gets a quarter of the light, so the friends at the back stay dimmer and the street goes black. And the light comes flat from the front.`
            : 'Without flash the camera keeps the street and its warm lamplight, but has to raise ISO, so there is grain. Usually the nicer picture.'}
        </p>
      </div>
    </Demo>
  )
}
