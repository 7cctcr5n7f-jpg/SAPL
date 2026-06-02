import type { MetadataRoute } from 'next'
import { business } from '@/lib/business'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Members area is gated content with no SEO value.
        disallow: ['/members'],
      },
    ],
    sitemap: `${business.url}/sitemap.xml`,
    host: business.url,
  }
}
