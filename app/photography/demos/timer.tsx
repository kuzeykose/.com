'use client'

import { useEffect, useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto } from '../lab/photo'
import { WATERFALL } from '../lab/photos'
import { autoExpose } from '../lab/optics'
import { Button, Choice, Demo } from '../ui'

type Phase = 'ready' | 'counting' | 'shooting' | 'done'

export function TimerDemo() {
  const [timer, setTimer] = useState<0 | 3 | 10>(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [count, setCount] = useState(0)
  const [shaken, setShaken] = useState(false)
  const scene = usePhoto(WATERFALL)
  // Half a second on a tripod, with a dark filter so daylight doesn't blow it out.
  const e = autoExpose(WATERFALL.ev - 6, { aperture: 4, shutter: 0.5 })
  const shot = useMemo(
    () => ({ ...e, focus: 15, wb: WATERFALL.kelvin, gain: -6, shake: phase === 'done' && shaken ? 1 : 0 }),
    [phase, shaken]
  )

  useEffect(() => {
    if (phase !== 'counting') return
    if (count <= 0) {
      setPhase('shooting')
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), timer === 10 ? 400 : 1000)
    return () => clearTimeout(t)
  }, [phase, count, timer])

  useEffect(() => {
    if (phase !== 'shooting') return
    const t = setTimeout(() => setPhase('done'), 600)
    return () => clearTimeout(t)
  }, [phase])

  const press = () => {
    setShaken(timer === 0)
    if (timer === 0) setPhase('shooting')
    else {
      setCount(timer)
      setPhase('counting')
    }
  }

  return (
    <Demo title="Timer">
      <div className={phase === 'shooting' && shaken ? 'timer-wobble' : ''}>
        <Viewfinder scene={scene} shot={shot} label="A waterfall, half a second on a tripod">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {phase === 'counting' && <span className="text-7xl font-semibold text-white drop-shadow-lg">{count}</span>}
            {phase === 'shooting' && <span className="rounded-full bg-black/60 px-3 py-1 text-sm text-white">Shutter open…</span>}
          </div>
          <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">
            {phase === 'done' ? (shaken ? 'Your photo: shaken by your tap' : 'Your photo: sharp') : 'Viewfinder · ½s on a tripod'}
          </div>
        </Viewfinder>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Choice
          label="Timer"
          options={[
            { value: 0, label: 'Off' },
            { value: 3, label: '3s' },
            { value: 10, label: '10s' },
          ]}
          value={timer}
          onChange={(t) => {
            setTimer(t)
            setPhase('ready')
          }}
          small
        />
        {phase === 'done' ? (
          <Button onClick={() => setPhase('ready')}>Try again</Button>
        ) : (
          <Button primary onClick={press} disabled={phase !== 'ready'}>
            Tap the shutter
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Even on a tripod, tapping the screen wobbles the phone just as the shutter opens. With a long exposure that
        wobble is in the picture. A timer lets the phone settle first. (The 10-second countdown is sped up here.)
      </p>
      <style>{`@keyframes timer-wobble { 0%,100% { transform: translate(0,0) rotate(0) } 25% { transform: translate(-3px,2px) rotate(-0.6deg) } 75% { transform: translate(3px,-2px) rotate(0.6deg) } } .timer-wobble { animation: timer-wobble 0.15s linear 4 } @media (prefers-reduced-motion: reduce) { .timer-wobble { animation: none } }`}</style>
    </Demo>
  )
}
