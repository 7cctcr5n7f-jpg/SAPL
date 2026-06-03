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

// ── Legacy WordPress → new Next.js redirect map (all permanent 301s) ──
// Each entry maps an OLD url (source) to the NEW canonical url (destination).
// `permanent: true` emits a 301 so Google transfers ranking signal and existing
// backlinks / bookmarks keep working. Host-level www→apex and http→https are
// handled by the Vercel domain config, so these path rules apply on both hosts.
const legacyRedirects = [
  // The one explicitly requested by the business.
  { source: '/book-a-trial', destination: '/free-trial' },

  // Other likely trial / booking slugs from the old site.
  { source: '/book-a-trial-class', destination: '/free-trial' },
  { source: '/book-trial', destination: '/free-trial' },
  { source: '/free-trial-class', destination: '/free-trial' },
  { source: '/trial', destination: '/free-trial' },
  { source: '/book', destination: '/free-trial' },
  { source: '/book-now', destination: '/free-trial' },

  // About.
  { source: '/about-us', destination: '/about' },
  { source: '/our-story', destination: '/about' },

  // Team / coaches.
  { source: '/team', destination: '/meet-the-team' },
  { source: '/our-team', destination: '/meet-the-team' },
  { source: '/the-team', destination: '/meet-the-team' },
  { source: '/coaches', destination: '/meet-the-team' },
  { source: '/trainers', destination: '/meet-the-team' },

  // Pricing / memberships.
  { source: '/pricing', destination: '/memberships' },
  { source: '/prices', destination: '/memberships' },
  { source: '/rates', destination: '/memberships' },
  { source: '/packages', destination: '/memberships' },
  { source: '/membership', destination: '/memberships' },
  { source: '/join-now', destination: '/memberships' },

  // Corporate.
  { source: '/corporate', destination: '/corporate-wellness' },
  { source: '/corporate-fitness', destination: '/corporate-wellness' },
  { source: '/corporate-wellness-program', destination: '/corporate-wellness' },

  // Contact / location.
  { source: '/contact-us', destination: '/contact' },
  { source: '/get-in-touch', destination: '/contact' },
  { source: '/find-us', destination: '/contact' },
  { source: '/location', destination: '/contact' },

  // Classes / how it works.
  { source: '/classes', destination: '/how-it-works' },
  { source: '/our-classes', destination: '/how-it-works' },
  { source: '/timetable', destination: '/how-it-works' },
  { source: '/schedule', destination: '/how-it-works' },
  { source: '/workouts', destination: '/how-it-works' },

  // Sign up / join.
  { source: '/sign-up', destination: '/signup' },
  { source: '/join', destination: '/signup' },
  { source: '/register', destination: '/signup' },

  // Gallery.
  { source: '/photos', destination: '/gallery' },
  { source: '/our-gym', destination: '/gallery' },

  // Home aliases (WordPress often exposed /home and /home-2).
  { source: '/home', destination: '/' },
  { source: '/home-2', destination: '/' },
].map((r) => ({ ...r, permanent: true }))

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
  async redirects() {
    return legacyRedirects
  },
}

export default nextConfig
