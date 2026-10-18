'use client'

import { useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { night } from '../lab/scenes'
import { autoExpose, formatIso, formatShutter } from '../lab/optics'
import { Choice, Demo, Range, Readout } from '../ui'

export function FlashDemo() {
  const [flash, setFlash] = useState(true)
  const [distance, setDistance] = useState(1.6)
  const scene = useMemo(() => night({ friend: distance, traffic: false }), [distance])
  // A phone's LED at one metre is about as bright as an EV 9 room, and it
  // fades with the square of the distance.
  const boost = flash ? Math.pow(2, 9 - scene.ev) / (distance * distance) : 0
  // With the flash firing, the camera exposes for whoever it lights.
  const e = autoExpose(scene.ev + Math.log2(1 + boost * 1.3), { aperture: 1.48 })
  const shot = useMemo(() => ({ ...e, focus: distance, wb: flash ? 5000 : 3400, flash }), [e.shutter, e.iso, distance, flash, scene])
  const reach = boost > 1 ? (boost > 6 ? 'blasted with light' : 'lit by the flash') : boost > 0.15 ? 'barely touched by the flash' : 'out of reach of the flash'

  return (
    <Demo title="Flash">
      <Viewfinder scene={scene} shot={shot} label={`Your friend ${distance.toFixed(1)} m away at night`} />
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
        <Range label="How far away your friend is" min={1} max={8} step={0.1} value={distance} onChange={setDistance} format={(d) => `${d.toFixed(1)} m`} />
        <Readout
          items={[
            { label: 'shutter', value: formatShutter(e.shutter) },
            { label: 'ISO', value: formatIso(e.iso), warn: e.iso >= 1600 },
          ]}
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {flash
            ? `Your friend is ${reach}. Light from a small flash fades fast: twice as far gets a quarter of the light. The camera exposes for your friend, so the street behind goes black, and the light comes flat from the front.`
            : 'Without flash the camera keeps the street and its warm lamplight, but has to raise ISO, so there is grain. Usually the nicer picture.'}
        </p>
      </div>
    </Demo>
  )
}
