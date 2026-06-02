import type { Special } from '@/lib/db/schema'

export type ClientSpecial = {
  id: number
  title: string
  description: string
  badge: string
  ctaLabel: string
  ctaHref: string
  imageUrl: string
  // Bumped whenever the special is edited, so a republished special re-appears
  // even if a visitor dismissed the previous version.
  version: number
}

export function toClientSpecial(s: Special): ClientSpecial {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    badge: s.badge,
    ctaLabel: s.ctaLabel,
    ctaHref: s.ctaHref,
    imageUrl: s.imageUrl,
    version: new Date(s.updatedAt).getTime(),
  }
}
