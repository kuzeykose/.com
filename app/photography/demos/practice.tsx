'use client'

import { useEffect, useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { cafe, night, park } from '../lab/scenes'
import { autoExpose } from '../lab/optics'
import type { Scene, Shot } from '../lab/darkroom'
import { loadIntoLab, type LabSettings } from './exposure-lab'
import { Button, Demo } from '../ui'

type Recipe = { title: string; when: string; steps: string[]; lab?: Partial<LabSettings> }

const RECIPES: Recipe[] = [
  {
    title: 'A portrait of a friend',
    when: 'Faces, people, pets.',
    steps: [
      'Portrait mode at 2× (no big noses), Depth around ƒ/2.8.',
      'Put them in open shade or by a window, not under a midday sun.',
      'Tap their eye to focus; step back if it says "Move farther away".',
      'Shoot from their eye level, and leave a little space in the direction they look.',
    ],
  },
  {
    title: 'Kids, pets and sport',
    when: 'Anything that won’t sit still.',
    steps: [
      'Set Shutter Speed to 1/500 or faster; the iPhone raises ISO to match.',
      'Lots of light helps: outdoors, or by a big window.',
      'Slide the shutter button to the left for a burst, then keep the best. (Holding it records video.)',
      'Get down to their height.',
    ],
    lab: { scene: 'park', manual: false, aperture: 1.48, shutter: 1 / 1000, tripod: false },
  },
  {
    title: 'City lights and light trails',
    when: 'Traffic, streets, the skyline at night.',
    steps: [
      'Phone on a tripod or wedged against something solid; use the 3-second Timer.',
      'Lens Aperture ƒ/4, Shutter Speed 1 to 4 seconds.',
      'Lights become long streaks; parked things stay sharp.',
      'Or take a Live Photo and choose Long Exposure afterwards.',
    ],
    lab: { scene: 'night', manual: false, aperture: 4, shutter: 2, tripod: true },
  },
  {
    title: 'Silky water',
    when: 'Waterfalls, rivers, waves.',
    steps: [
      'Easiest: take a Live Photo, open it in Photos, choose Long Exposure.',
      'Hold steady for the full three seconds, or prop the phone.',
      'With a tripod and a dark (ND) filter: ƒ/4 and ½ to 2 seconds.',
      'Want every droplet instead? 1/1000 or faster.',
    ],
    lab: { scene: 'waterfall', manual: false, aperture: 1.8, shutter: 1 / 4000, tripod: true },
  },
  {
    title: 'Snow, beach, bright skies',
    when: 'A mostly-white scene.',
    steps: [
      'The meter makes it grey: drag Exposure up +⅔ to +1⅓.',
      'Check the Histogram: lean right, but don’t pile up against the wall.',
      'Snow in the shade turns blue. If Auto doesn’t fix it, set White Balance to Cloudy or Shade.',
    ],
    lab: { scene: 'snow', manual: false, aperture: 1.8, shutter: null, tripod: false },
  },
  {
    title: 'Sunsets and silhouettes',
    when: 'Bright sky, dark foreground.',
    steps: [
      'Tap the bright sky, not the person, so the camera exposes for the sky.',
      'Drag Exposure down until the colours deepen and the foreground goes black.',
      'Keep the sun out of the very centre; put the horizon on a third.',
      'A Warm or Amber style adds glow, but leave White Balance on Auto.',
    ],
  },
  {
    title: 'Food and coffee',
    when: 'Restaurants, kitchens, cafés.',
    steps: [
      'Sit by a window and turn off the overhead light if you can. Never use flash.',
      'Straight down for flat things (pizza), 45° for tall ones (burgers, drinks).',
      'Lens Aperture ƒ/1.48 at 2× gives that soft background up close.',
      'Tap the nearest edge of the dish to focus.',
    ],
    lab: { scene: 'cafe', manual: false, aperture: 1.48, shutter: null, tripod: false },
  },
  {
    title: 'Landscapes',
    when: 'Mountains, the coast, views.',
    steps: [
      '.5× for drama with something in the foreground; 4× to pick out one hill.',
      'ƒ/2.8–ƒ/4 keeps everything sharp. Format: 48 MP, or ProRAW Max if you edit.',
      'Horizon level (turn on Level) and on a third.',
      'Shoot in the hour after sunrise or before sunset.',
    ],
  },
  {
    title: 'Concerts and dark rooms',
    when: 'Gigs, parties, candlelight.',
    steps: [
      'Flash off: it lights the back of the heads in front of you, not the stage.',
      'Let Night mode work, and hold still while it counts.',
      'Stage lights are bright: tap the performer and drag Exposure down to keep colour.',
      'Brace your elbows on your chest, or lean on something.',
    ],
  },
]

export function Recipes() {
  return (
    <div className="my-8 grid gap-3 sm:grid-cols-2 lg:-mx-24 lg:grid-cols-3">
      {RECIPES.map((r) => (
        <div key={r.title} className="flex flex-col rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-medium tracking-tight">{r.title}</h3>
          <p className="mb-2 text-xs text-neutral-500">{r.when}</p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-neutral-700 dark:text-neutral-300">
            {r.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {r.lab && (
            <button
              type="button"
              onClick={() => loadIntoLab(r.lab!)}
              className="mt-3 self-start text-sm text-orange-600 underline underline-offset-4 hover:text-orange-700"
            >
              Try it in the lab ↑
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

type Question = { scene: () => Scene; shot: (s: Scene) => Shot; ask: string; options: string[]; answer: number; why: string }

const auto = (s: Scene, aperture = 1.8) => autoExpose(s.ev, { aperture })

const QUESTIONS: Question[] = [
  {
    scene: () => park(),
    // Late in the day, six stops darker than noon.
    shot: (s) => ({ ...autoExpose(s.ev - 6, { aperture: 1.8, shutter: 1 / 15 }), focus: 8, wb: s.kelvin, shake: 0, gain: -6 }),
    ask: 'You wanted a sharp cyclist. What went wrong?',
    options: ['ISO too high', 'The shutter was open too long', 'Wrong white balance', 'The aperture was too wide'],
    answer: 1,
    why: 'At 1/15 s the cyclist moved while the shutter was open. Set Shutter Speed to 1/500 or faster.',
  },
  {
    scene: () => cafe({ kelvin: 2600 }),
    shot: (s) => ({ ...auto(s), focus: 0.3, wb: 5500 }),
    ask: 'Why is everything so orange?',
    options: ['Overexposed', 'White balance set for daylight under bulb light', 'The Gold style', 'Too much flash'],
    answer: 1,
    why: 'Bulbs are about 2700K; the camera assumed daylight (5500K), so the warmth wasn’t cancelled. Use Auto, or a lower Kelvin.',
  },
  {
    scene: () => park({ winter: true }),
    shot: (s) => ({ ...autoExpose(s.meterEv!, { aperture: 1.8 }), focus: 3.2, wb: s.kelvin }),
    ask: 'The snow came out grey. The quickest fix?',
    options: ['Exposure +1', 'Exposure −1', 'Turn on Night mode', 'Use flash'],
    answer: 0,
    why: 'The meter tried to make all that white into middle grey. Push Exposure up about a stop.',
  },
  {
    scene: () => park(),
    shot: (s) => ({ ...autoExpose(s.ev - 2, { aperture: 1.8 }), focus: 3.2, wb: s.kelvin }),
    ask: 'Which setting would have saved the sky?',
    options: ['A faster shutter or lower exposure', 'Higher ISO', 'Flash on', 'Live Photo off'],
    answer: 0,
    why: 'It’s two stops too bright; the sky clipped to white. Less light (Exposure down, a faster shutter, or ƒ/4) keeps it blue.',
  },
  {
    scene: () => night({ ev: -1 }),
    shot: (s) => ({ ...autoExpose(s.ev, { aperture: 1.48, slowest: 1 / 15 }), focus: 2.6, wb: 3400 }),
    ask: 'Grainy and dark, handheld at night. Best fix?',
    options: ['Raise ISO even more', 'Let Night mode run for a few seconds', 'Turn on Flash', 'Switch to 4×'],
    answer: 1,
    why: 'The grain is ISO 12800 working with too little light. Night mode collects light over seconds and merges it: cleaner and brighter.',
  },
  {
    scene: () => night({ alone: true }),
    shot: (s) => ({ ...autoExpose(s.ev, { aperture: 4, shutter: 1 / 250 }), focus: 14, wb: 3000, shake: 0 }),
    ask: 'You wanted streaks of light from the traffic. What do you change?',
    options: ['Shutter Speed to about 2 s, on a tripod', 'Shutter Speed to 1/4000', 'Aperture to ƒ/1.48', 'Flash on'],
    answer: 0,
    why: 'Trails are motion blur on purpose: the lights move while the shutter stays open. Keep the phone still for it.',
  },
  {
    scene: () => park({ friend: 1.5, friendX: 38, cyclist: false }),
    shot: (s) => ({ ...auto(s, 1.48), focus: 1.5, wb: s.kelvin }),
    ask: 'Your friend gets lost against busy trees. What helps most?',
    options: ['Portrait mode, or Depth on and blur it later', 'Exposure +1', 'Aspect 16:9', 'A Vibrant style'],
    answer: 0,
    why: 'A phone’s lens can’t blur a background this far away. Portrait mode paints the blur in, and you can adjust it afterwards.',
  },
]

export function Quiz() {
  const [n, setN] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const q = QUESTIONS[n]
  const scene = useMemo(() => q.scene(), [n])
  const shot = useMemo(() => q.shot(scene), [scene])
  const done = n === QUESTIONS.length - 1 && picked !== null

  return (
    <Demo title={`Fix the photo · ${n + 1} of ${QUESTIONS.length}`}>
      <Viewfinder scene={scene} shot={shot} label="A photo that went wrong" />
      <p className="mt-3 font-medium">{q.ask}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const state = picked === null ? '' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'dim'
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(i)
                if (i === q.answer) setScore((s) => s + 1)
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                state === 'right'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                  : state === 'wrong'
                    ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200'
                    : state === 'dim'
                      ? 'border-neutral-200 text-neutral-400 dark:border-neutral-800'
                      : 'border-neutral-300 bg-white hover:border-orange-600 dark:border-neutral-700 dark:bg-neutral-900'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
      {picked !== null && <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{q.why}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          Score {score}/{QUESTIONS.length}
        </span>
        {done ? (
          <Button
            onClick={() => {
              setN(0)
              setPicked(null)
              setScore(0)
            }}
          >
            Start again
          </Button>
        ) : (
          <Button
            primary
            disabled={picked === null}
            onClick={() => {
              setN((x) => x + 1)
              setPicked(null)
            }}
          >
            Next photo
          </Button>
        )}
      </div>
    </Demo>
  )
}

const MISSIONS = [
  'Shoot one thing at all four Lens Apertures (ƒ/1.48 to ƒ/4) from 20 cm. Compare the backgrounds.',
  'Photograph moving water or traffic at 1/1000, 1/30 and ½ s.',
  'Take a photo of something white in the snow or sun at Exposure 0, then at +1.',
  'Shoot the same white mug under a bulb, a window and the shade, with White Balance on Auto and on Daylight.',
  'Take five Live Photos of something that moves, and turn the best one into a Long Exposure.',
  'One subject, five lenses: .5×, 1×, 2×, 4× and 8×, from where you stand. Then again, walking to keep it the same size.',
  'A whole walk with the Grid on: put every subject on a third line.',
  'Night mode, handheld and propped up, at 3 s and the longest the phone offers.',
  'A portrait in open shade and one in direct sun. Which face looks better?',
  'Shoot ProRAW, and rescue a too-bright sky in the Photos editor.',
]

export function Missions() {
  const [done, setDone] = useState<boolean[]>(() => MISSIONS.map(() => false))
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('photography-missions') ?? '[]')
      if (Array.isArray(saved)) setDone(MISSIONS.map((_, i) => !!saved[i]))
    } catch {}
  }, [])
  const toggle = (i: number) =>
    setDone((d) => {
      const next = d.map((v, j) => (j === i ? !v : v))
      try {
        localStorage.setItem('photography-missions', JSON.stringify(next))
      } catch {}
      return next
    })
  const count = done.filter(Boolean).length
  return (
    <div className="my-6">
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full bg-orange-600 transition-[width]" style={{ width: `${(count / MISSIONS.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {MISSIONS.map((m, i) => (
          <li key={m}>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
              <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />
              <span className={done[i] ? 'line-through opacity-60' : ''}>{m}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        {count}/{MISSIONS.length} done. Ticks are saved in this browser.
      </p>
    </div>
  )
}
