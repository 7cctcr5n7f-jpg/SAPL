/** @type {import('next').NextConfig} */

// Security headers. NOTE: a strict Content-Security-Policy was intentionally
// removed — it blocked the eval() that React needs for client-side hydration in
// this environment, which broke interactive JS (the navbar's solid-on-scroll
// background and the scroll-reveal content sections). These headers are safe
// and do not interfere with client-side rendering.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Optimization runs on Vercel: auto-resizes + serves WebP/AVIF,
    // which trims the oversized PNGs and serves smaller files to mobile.
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images aggressively (31 days) to cut repeat payload.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Allow images uploaded to Vercel Blob (admin photo uploads) to be
    // served through next/image.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
