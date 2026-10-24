import type { ReactNode } from 'react'

export const metadata = {
  title: 'Projects',
  description: 'Things I am building.',
}

const TurboGraphLogo = () => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="turbograph-logo-grad"
        x1="0"
        y1="0"
        x2="28"
        y2="28"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#2dd4bf" />
      </linearGradient>
    </defs>
    <line x1="8" y1="6" x2="20" y2="10" stroke="url(#turbograph-logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="8" y1="6" x2="8" y2="18" stroke="url(#turbograph-logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="20" y1="10" x2="20" y2="22" stroke="url(#turbograph-logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="8" y1="18" x2="20" y2="22" stroke="url(#turbograph-logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="8" y1="18" x2="20" y2="10" stroke="url(#turbograph-logo-grad)" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
    <circle cx="8" cy="6" r="3" fill="url(#turbograph-logo-grad)" />
    <circle cx="20" cy="10" r="3" fill="url(#turbograph-logo-grad)" />
    <circle cx="8" cy="18" r="3" fill="url(#turbograph-logo-grad)" />
    <circle cx="20" cy="22" r="3" fill="url(#turbograph-logo-grad)" />
  </svg>
)

type Project = {
  name: string
  url: string
  domain: string
  description: string
  icon?: ReactNode
}

const projects: Project[] = [
  {
    name: 'Sundown: Daily Check-in',
    url: 'https://sundownjournal.com',
    domain: 'sundownjournal.com',
    description:
      'A private, end-of-day check-in app for iPhone — rate your day with a few quick sliders, watch your trends build, and keep everything on your device.',
    icon: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="https://sundownjournal.com/logo.webp"
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 rounded"
      />
    ),
  },
  {
    name: 'Turbograph',
    url: 'https://turbograph.dev',
    domain: 'turbograph.dev',
    description:
      'A visualization tool for Turborepo monorepos — map dependencies, analyze commit impact, and get AI-powered insights from a CLI or browser dashboard.',
    icon: <TurboGraphLogo />,
  },
]

export default function Page() {
  return (
    <section>
      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <a
            key={project.url}
            className="flex flex-col space-y-1 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 transition-all hover:border-orange-600 dark:hover:border-orange-600 focus-visible:outline-none focus-visible:border-orange-600 focus-visible:ring-2 focus-visible:ring-orange-600"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-2">
                {project.icon ?? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${project.domain}&sz=64`}
                    alt=""
                    width={20}
                    height={20}
                    className="w-5 h-5 rounded"
                  />
                )}
                <p className="text-neutral-900 dark:text-neutral-100 font-medium tracking-tight">
                  {project.name}
                </p>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                {project.domain}
              </p>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm">
              {project.description}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}
