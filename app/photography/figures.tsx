// Static diagrams for the lessons.

const ink = 'text-neutral-700 dark:text-neutral-300'

export function HowAPhotoIsMade() {
  const steps = [
    { x: 45, label: 'Light', sub: 'bounces off things' },
    { x: 140, label: 'Lens', sub: 'bends it to a point' },
    { x: 235, label: 'Aperture', sub: 'how wide the hole' },
    { x: 330, label: 'Shutter', sub: 'how long it opens' },
    { x: 425, label: 'Sensor', sub: '48 million buckets' },
    { x: 520, label: 'Processing', sub: 'colour, noise, HDR' },
  ]
  return (
    <figure className="my-8 lg:-mx-24">
      <svg viewBox="0 0 580 170" className={`w-full ${ink}`} role="img" aria-label="Light travels from the scene through the lens, aperture and shutter to the sensor, then gets processed into a photo">
        {/* Sun and tree */}
        <circle cx="22" cy="22" r="10" fill="#f59e0b" />
        <path d="M45 92v-18" stroke="#7c5a3b" strokeWidth="5" />
        <circle cx="45" cy="58" r="20" fill="#4d8a35" />
        {/* Rays */}
        {[48, 58, 68].map((y, i) => (
          <path key={i} d={`M65 ${y} L132 ${58 + (i - 1) * 22} L238 58`} fill="none" stroke="#ea580c" strokeOpacity="0.55" strokeWidth="1.4" />
        ))}
        {/* Lens */}
        <ellipse cx="140" cy="58" rx="9" ry="34" fill="#7dd3fc" fillOpacity="0.5" stroke="currentColor" />
        {/* Aperture */}
        <rect x="231" y="18" width="8" height="30" fill="currentColor" />
        <rect x="231" y="68" width="8" height="30" fill="currentColor" />
        {/* Shutter */}
        <rect x="322" y="18" width="16" height="80" rx="2" fill="none" stroke="currentColor" strokeDasharray="3 3" />
        <path d="M238 58 L418 58" stroke="#ea580c" strokeOpacity="0.55" strokeWidth="1.4" />
        {/* Sensor */}
        <g>
          <rect x="412" y="34" width="28" height="48" fill="currentColor" fillOpacity="0.12" stroke="currentColor" />
          {Array.from({ length: 5 }).map((_, i) => (
            <path key={i} d={`M412 ${42 + i * 8}h28`} stroke="currentColor" strokeOpacity="0.3" />
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <path key={i} d={`M${419 + i * 7} 34v48`} stroke="currentColor" strokeOpacity="0.3" />
          ))}
        </g>
        {/* Chip and photo */}
        <rect x="505" y="40" width="30" height="30" rx="4" fill="none" stroke="currentColor" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${511 + i * 9} 36v4M${511 + i * 9} 70v4M501 ${46 + i * 9}h4M535 ${46 + i * 9}h4`} stroke="currentColor" />
        ))}
        <path d="M444 58h56" stroke="currentColor" markerEnd="url(#arrow)" />
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 10 5 0 10z" fill="currentColor" />
          </marker>
        </defs>
        {steps.map((s) => (
          <g key={s.label}>
            <text x={s.x} y="128" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">
              {s.label}
            </text>
            <text x={s.x} y="144" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.7">
              {s.sub}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

export function Triangle() {
  return (
    <figure className="my-8">
      <svg viewBox="0 0 420 300" className={`mx-auto w-full max-w-md ${ink}`} role="img" aria-label="The exposure triangle: aperture, shutter speed and ISO all change brightness, each with its own side effect">
        <path d="M210 52 L370 250 L50 250 Z" fill="#ea580c" fillOpacity="0.08" stroke="#ea580c" strokeWidth="2" />
        <text x="210" y="160" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">
          Brightness
        </text>
        <text x="210" y="178" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7">
          all three change it
        </text>
        <g fontSize="13" fill="currentColor">
          <text x="210" y="16" textAnchor="middle" fontWeight="600">Aperture</text>
          <text x="210" y="32" textAnchor="middle" fontSize="11" fillOpacity="0.75">wider → softer background</text>
          <text x="374" y="272" textAnchor="end" fontWeight="600">Shutter speed</text>
          <text x="374" y="288" textAnchor="end" fontSize="11" fillOpacity="0.75">longer → motion blur</text>
          <text x="46" y="272" fontWeight="600">ISO</text>
          <text x="46" y="288" fontSize="11" fillOpacity="0.75">higher → grain</text>
        </g>
        <circle cx="210" cy="52" r="5" fill="#ea580c" />
        <circle cx="370" cy="250" r="5" fill="#ea580c" />
        <circle cx="50" cy="250" r="5" fill="#ea580c" />
      </svg>
    </figure>
  )
}

// Three faces lit from the front, the side and behind.
export function LightDirections() {
  const faces = [
    { id: 'front', label: 'Front light', sub: 'flat, even, few shadows', stops: [['0%', '#f6d2b8'], ['100%', '#e7b796']], cx: '50%' },
    { id: 'side', label: 'Side light', sub: 'shape, texture, mood', stops: [['0%', '#f9dcc6'], ['55%', '#d9a07c'], ['100%', '#3a2a22']], cx: '15%' },
    { id: 'back', label: 'Back light', sub: 'glowing edges, silhouette', stops: [['0%', '#3b2b24'], ['82%', '#5a4034'], ['96%', '#ffe2b8']], cx: '50%' },
  ]
  return (
    <figure className="my-8">
      <svg viewBox="0 0 420 160" className={`w-full ${ink}`} role="img" aria-label="A face lit from the front looks flat, from the side shows shape, from behind glows at the edges">
        <defs>
          {faces.map((f) => (
            <radialGradient key={f.id} id={`face-${f.id}`} cx={f.cx} cy="45%" r="75%">
              {f.stops.map(([o, c]) => (
                <stop key={o} offset={o} stopColor={c} />
              ))}
            </radialGradient>
          ))}
        </defs>
        {faces.map((f, i) => (
          <g key={f.id} transform={`translate(${70 + i * 140} 0)`}>
            {f.id === 'back' && <circle cx="0" cy="62" r="50" fill="#fde68a" fillOpacity="0.5" />}
            <ellipse cx="0" cy="62" rx="36" ry="44" fill={`url(#face-${f.id})`} />
            <text x="0" y="130" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">
              {f.label}
            </text>
            <text x="0" y="146" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.7">
              {f.sub}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
