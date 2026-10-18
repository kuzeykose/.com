'use client'

import { useEffect, useMemo, useState } from 'react'
import { Viewfinder } from '../lab/viewfinder'
import { usePhoto, type PhotoSpec } from '../lab/photo'
import { CAFE, CYCLIST, NIGHT, PORTRAIT, SNOW, WATERFALL } from '../lab/photos'
import {
  IPHONE_APERTURES,
  ISOS,
  SHUTTERS,
  autoExpose,
  formatAperture,
  formatIso,
  formatShutter,
  meterReading,
  type Exposure,
} from '../lab/optics'
import type { Develop } from '../lab/darkroom'
import { Choice, Demo, Histogram, Meter, Readout, Stepper, Toggle } from '../ui'

export type SceneName = 'cafe' | 'portrait' | 'cyclist' | 'night' | 'waterfall' | 'snow'

export const SCENES: Record<SceneName, { label: string; spec: PhotoSpec; focus: number }> = {
  cafe: { label: 'Café', spec: CAFE, focus: 0.36 },
  portrait: { label: 'Portrait', spec: PORTRAIT, focus: 1.6 },
  cyclist: { label: 'Cyclist', spec: CYCLIST, focus: 5.5 },
  night: { label: 'Night street', spec: NIGHT, focus: 3 },
  waterfall: { label: 'Waterfall', spec: WATERFALL, focus: 15 },
  snow: { label: 'Snow', spec: SNOW, focus: 2.4 },
}

export type LabSettings = {
  scene: SceneName
  manual: boolean
  aperture: number
  shutter: number | null
  iso: number
  tripod: boolean
}

// Recipes further down the page load their settings in here.
export const LOAD_EVENT = 'photo-lab:load'

export function loadIntoLab(s: Partial<LabSettings>) {
  window.dispatchEvent(new CustomEvent(LOAD_EVENT, { detail: s }))
  document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const SLOW = SHUTTERS.filter((t) => t <= 30)

export function ExposureLab() {
  const [s, setS] = useState<LabSettings>({ scene: 'cafe', manual: false, aperture: 1.8, shutter: null, iso: 100, tripod: false })
  const [focus, setFocus] = useState<number | null>(null)
  const [focusLabel, setFocusLabel] = useState<string | null>(null)
  const [dev, setDev] = useState<Develop | null>(null)
  const set = (patch: Partial<LabSettings>) => setS((p) => ({ ...p, ...patch }))

  useEffect(() => {
    const load = (e: Event) => {
      const d = (e as CustomEvent<Partial<LabSettings>>).detail
      setS((p) => ({ ...p, ...d }))
      setFocus(null)
      setFocusLabel(null)
    }
    window.addEventListener(LOAD_EVENT, load)
    return () => window.removeEventListener(LOAD_EVENT, load)
  }, [])

  const cfg = SCENES[s.scene]
  const scene = usePhoto(cfg.spec)
  const spec = cfg.spec
  const e: Exposure = s.manual
    ? { aperture: s.aperture, shutter: s.shutter ?? 1 / 125, iso: s.iso }
    : autoExpose(spec.meterEv ?? spec.ev, { aperture: s.aperture, shutter: s.shutter ?? undefined })
  const stops = meterReading(spec.ev, e)

  const shot = useMemo(
    () => ({ ...e, focus: focus ?? cfg.focus, wb: spec.kelvin, shake: s.tripod ? 0 : 1 }),
    [e.aperture, e.shutter, e.iso, focus, s.scene, s.tripod]
  )

  const mover = spec.objects?.find((o) => o.motion)
  const smear = mover ? Math.hypot(...mover.motion!) * 640 * e.shutter : 0

  const warnings: string[] = []
  if (stops > 0.7) warnings.push(`Too bright by ${stops.toFixed(1)} stops: the brightest parts have turned to flat white.`)
  if (stops < -0.7) warnings.push(`Too dark by ${(-stops).toFixed(1)} stops: shadows are sinking into black.`)
  if (mover && smear > 3) warnings.push(`${cap(mover.label)} moved while the shutter was open, so it's smeared.`)
  if (!s.tripod && e.shutter > 1 / 20) warnings.push(`At ${formatShutter(e.shutter)} your hands shake the whole picture. Use a tripod, or a faster shutter.`)
  if (e.iso >= 1600) warnings.push(`ISO ${formatIso(e.iso)} amplifies the signal and the noise with it. The picture is grainy.`)

  return (
    <Demo title="The exposure lab">
      <div className="mb-3">
        <Choice
          options={(Object.keys(SCENES) as SceneName[]).map((k) => ({ value: k, label: SCENES[k].label }))}
          value={s.scene}
          onChange={(scene) => (set({ scene }), setFocus(null), setFocusLabel(null))}
          small
        />
      </div>
      <Viewfinder
        scene={scene}
        shot={shot}
        onDevelop={setDev}
        onTap={(hit) => {
          setFocus(hit.depth)
          setFocusLabel(hit.label ?? null)
        }}
        label="Simulated photo with the current settings"
      >
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">
          Tap to focus{focusLabel ? ` · ${focusLabel}` : ''}
        </div>
      </Viewfinder>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem]">
        <div className="space-y-2">
          <Readout
            items={[
              { label: 'ƒ', value: formatAperture(e.aperture).slice(2) },
              { label: 'shutter', value: formatShutter(e.shutter), warn: smear > 3 || (!s.tripod && e.shutter > 1 / 20) },
              { label: 'ISO', value: formatIso(e.iso), warn: e.iso >= 1600 },
            ]}
          />
          <Meter stops={stops} />
        </div>
        <Histogram data={dev?.histogram ?? null} height={52} />
      </div>

      <div className="mt-4 space-y-4">
        <Choice
          label="Who's in charge?"
          options={[
            { value: 'auto', label: 'iPhone (auto ISO)' },
            { value: 'manual', label: 'Me (full manual)' },
          ]}
          value={s.manual ? 'manual' : 'auto'}
          onChange={(v) => set({ manual: v === 'manual', shutter: v === 'manual' ? (s.shutter ?? e.shutter) : s.shutter, iso: Math.round(e.iso) })}
          small
        />
        <Choice
          label="Lens aperture"
          options={IPHONE_APERTURES.map((a) => ({ value: a, label: formatAperture(a) }))}
          value={s.aperture}
          onChange={(aperture) => set({ aperture })}
          small
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Stepper
              label="Shutter speed"
              values={SLOW}
              value={nearestIn(SLOW, s.shutter ?? e.shutter)}
              onChange={(shutter) => set({ shutter })}
              format={formatShutter}
              disabled={!s.manual && s.shutter === null}
            />
            {!s.manual && (
              <div className="mt-1">
                <Toggle label="Let the iPhone choose" checked={s.shutter === null} onChange={(v) => set({ shutter: v ? null : e.shutter })} />
              </div>
            )}
          </div>
          <Stepper
            label="ISO"
            values={ISOS}
            value={nearestIn(ISOS, s.manual ? s.iso : e.iso)}
            onChange={(iso) => set({ iso })}
            format={(v) => `${v}`}
            disabled={!s.manual}
            hint={s.manual ? undefined : 'The Camera app sets ISO for you.'}
          />
        </div>
        <Toggle label="On a tripod" checked={s.tripod} onChange={(tripod) => set({ tripod })} />
      </div>

      <ul className="mt-4 space-y-1 text-sm" aria-live="polite">
        {warnings.length === 0 ? (
          <li className="text-emerald-700 dark:text-emerald-400">✓ Nicely exposed, sharp and clean.</li>
        ) : (
          warnings.map((w) => (
            <li key={w} className="text-orange-700 dark:text-orange-400">
              • {w}
            </li>
          ))
        )}
      </ul>
    </Demo>
  )
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export const nearestIn = (list: number[], v: number) =>
  list.reduce((best, x) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(best / v)) ? x : best))
