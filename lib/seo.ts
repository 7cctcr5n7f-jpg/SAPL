import { business, fullAddress } from '@/lib/business'

const dayMap: Record<string, string> = {
  Monday: 'Mo',
  Tuesday: 'Tu',
  Wednesday: 'We',
  Thursday: 'Th',
  Friday: 'Fr',
  Saturday: 'Sa',
  Sunday: 'Su',
}

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HealthClub',
    '@id': `${business.url}#business`,
    name: business.name,
    legalName: business.legalName,
    description: business.description,
    url: business.url,
    telephone: business.phoneE164,
    email: business.email,
    image: `${business.url}/hero-athlete.png`,
    priceRange: 'R650 – R1750',
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.suburb,
      addressRegion: business.address.region,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: business.geo.latitude,
      longitude: business.geo.longitude,
    },
    openingHoursSpecification: business.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.day,
      opens: h.open,
      closes: h.close,
    })),
    areaServed: business.areasServed.map((a) => ({
      '@type': 'Place',
      name: `${a}, Pretoria East`,
    })),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: business.rating.value,
      reviewCount: business.rating.count,
      bestRating: '5',
      worstRating: '1',
    },
    sameAs: [business.socials.instagram, business.socials.facebook],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${business.url}#website`,
    url: business.url,
    name: business.name,
    description: business.description,
    publisher: { '@id': `${business.url}#business` },
    inLanguage: 'en-ZA',
  }
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${business.url}${item.path}`,
    })),
  }
}

export { fullAddress }
