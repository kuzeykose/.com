import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/projects/the-operator',
        destination: '/projects/the-operator/index.html',
      },
    ]
  },
}

export default nextConfig
