import type { MetadataRoute } from 'next'
import { business } from '@/lib/business'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Members area is gated content with no SEO value; admin + API are private.
        disallow: ['/members', '/admin', '/api', '/signup'],
      },
    ],
    sitemap: `${business.url}/sitemap.xml`,
    host: business.url,
  }
}
