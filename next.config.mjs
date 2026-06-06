/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the v0 preview iframe hosts to load Next.js dev resources (JS chunks).
  // Without this, cross-origin chunk requests are blocked and the app cannot
  // hydrate inside the preview, which makes buttons appear to "do nothing".
  allowedDevOrigins: ["*.vusercontent.net", "*.v0.dev", "*.v0.app"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Better Auth pulls in the kysely adapter (with sqlite dialects) that Turbopack
  // cannot statically bundle. Keep these on the Node runtime instead of bundling.
  serverExternalPackages: ["better-auth", "@better-auth/kysely-adapter", "kysely", "pg"],
}

export default nextConfig
