export function ProgressRing({ percent }: { percent: number }) {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const arc = (percent / 100) * circumference

  return (
    <div className="relative size-[38px] shrink-0" aria-hidden="true">
      <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
        <circle
          cx="19"
          cy="19"
          r={radius}
          fill="none"
          strokeWidth="2"
          className="stroke-neutral-200 dark:stroke-neutral-800"
        />
        <circle
          cx="19"
          cy="19"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-orange-600"
          strokeDasharray={`${arc} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
        {percent}%
      </span>
    </div>
  )
}
