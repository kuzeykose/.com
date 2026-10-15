function Placeholder() {
  return (
    <div
      className="relative w-11 md:w-[52px] aspect-[2/3] shrink-0 rounded-sm bg-neutral-300 dark:bg-neutral-700 overflow-hidden"
      aria-hidden="true"
    >
      <span className="absolute left-[18%] right-[18%] top-[14%] h-[2px] rounded-full bg-white/80 dark:bg-white/25" />
      <span className="absolute left-[18%] right-[38%] top-[26%] h-[2px] rounded-full bg-white/80 dark:bg-white/25" />
    </div>
  )
}

export function Cover({ src, title }: { src: string | null; title: string }) {
  if (!src) return <Placeholder />

  return (
    // Notion-proxied or external cover; keep the 2:3 placeholder size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={52}
      height={78}
      className="w-11 md:w-[52px] aspect-[2/3] shrink-0 rounded-sm object-cover bg-neutral-300 dark:bg-neutral-700"
      title={title}
    />
  )
}
