import type { Metadata } from 'next'
import { PageHero } from '@/components/page-hero'
import { GalleryGrid } from '@/components/gallery-grid'
import { CtaBanner } from '@/components/cta-banner'
import { JsonLd } from '@/components/json-ld'
import { breadcrumbSchema } from '@/lib/seo'
import { business } from '@/lib/business'
import { galleryImages } from '@/lib/gallery'

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Step inside TENROUNDS — see our boxing-inspired HIIT gym in Garsfontein, Pretoria East. Real photos of our facility, equipment, members and coaches.',
  alternates: { canonical: '/gallery' },
  openGraph: {
    title: 'Gallery | TENROUNDS',
    description:
      'See inside the TENROUNDS boxing-inspired HIIT gym in Garsfontein, Pretoria East — facility, equipment, members and coaches.',
    images: [{ url: galleryImages[0].src }],
  },
}

const imageGallerySchema = {
  '@context': 'https://schema.org',
  '@type': 'ImageGallery',
  name: 'TENROUNDS Gym Gallery',
  description:
    'Photo gallery of the TENROUNDS boxing-inspired HIIT gym in Garsfontein, Pretoria East.',
  url: `${business.url}/gallery`,
  image: galleryImages.map((img) => ({
    '@type': 'ImageObject',
    contentUrl: `${business.url}${img.src}`,
    caption: img.alt,
  })),
}

export default function GalleryPage() {
  return (
    <main>
      <JsonLd
        data={[
          imageGallerySchema,
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Gallery', path: '/gallery' },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Inside TENROUNDS"
        title="The Gallery"
        description="Real photos from our boxing-inspired HIIT studio in Garsfontein, Pretoria East — the floor, the bags, the equipment and the people who make it move."
        image="/gallery/tenrounds-photoshoot-coach-led-boxing-session.jpg"
        imageAlt="Coach guiding a member through a boxing combination at TENROUNDS Garsfontein"
      />

      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <GalleryGrid />
        </div>
      </section>

      <CtaBanner
        headline="See It For Yourself"
        subheadline="Photos only tell half the story. Book your free trial and experience a TENROUNDS session first-hand."
      />
    </main>
  )
}
