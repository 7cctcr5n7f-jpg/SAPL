// Single source of truth for NAP (Name, Address, Phone) and business data.
// Keep this consistent everywhere for local SEO.

export const business = {
  name: 'TENROUNDS',
  legalName: 'TENROUNDS Fitness',
  description:
    'Premium 30-minute HIIT boxing fitness gym in Garsfontein, Pretoria East. Coach-supported, data-driven workouts with no class times.',
  url: 'https://tenrounds.co.za',
  // Phone / WhatsApp
  phoneDisplay: '+27 65 983 4172',
  phoneE164: '+27659834172',
  whatsappNumber: '27659834172',
  whatsappMessage: 'Hi TENROUNDS, I would like to book my free trial.',
  email: 'hello@tenrounds.co.za',
  // Address (NAP)
  address: {
    street: '649 Borzoi Street',
    suburb: 'Garsfontein',
    city: 'Pretoria',
    region: 'Gauteng',
    postalCode: '0042',
    country: 'ZA',
    countryName: 'South Africa',
  },
  geo: {
    // Approximate Garsfontein coordinates
    latitude: -25.8074,
    longitude: 28.2987,
  },
  // Aggregate review rating shown in rich results (schema.org AggregateRating).
  // value is the live Google rating (verified 4.8). Update `count` with the live
  // review total from your Google Business Profile when it changes.
  rating: {
    value: '4.8',
    count: 33,
  },
  // Operating hours
  // Mon-Fri 05:00-10:00 & 13:00-19:00, Sat 07:00-10:00, Sun closed
  hours: [
    { day: 'Monday', open: '05:00', close: '10:00' },
    { day: 'Monday', open: '13:00', close: '19:00' },
    { day: 'Tuesday', open: '05:00', close: '10:00' },
    { day: 'Tuesday', open: '13:00', close: '19:00' },
    { day: 'Wednesday', open: '05:00', close: '10:00' },
    { day: 'Wednesday', open: '13:00', close: '19:00' },
    { day: 'Thursday', open: '05:00', close: '10:00' },
    { day: 'Thursday', open: '13:00', close: '19:00' },
    { day: 'Friday', open: '05:00', close: '10:00' },
    { day: 'Friday', open: '13:00', close: '19:00' },
    { day: 'Saturday', open: '07:00', close: '10:00' },
  ],
  hoursDisplay: [
    { days: 'Monday – Friday', time: '05:00 – 10:00  &  13:00 – 19:00' },
    { days: 'Saturday', time: '07:00 – 10:00' },
    { days: 'Sunday', time: 'Closed' },
  ],
  socials: {
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
  },
  // Jotform form IDs — drop your real IDs in here to replace the built-in fallback forms.
  jotform: {
    freeTrialId: '242785779783581',
    signupId: '243353105850551',
  },
  // Maps
  mapsEmbed:
    'https://www.google.com/maps?q=649+Borzoi+Street,+Garsfontein,+Pretoria&output=embed',
  mapsLink:
    'https://www.google.com/maps/search/?api=1&query=649+Borzoi+Street,+Garsfontein,+Pretoria',
  // Turn-by-turn directions to the studio (works on desktop + mobile Google Maps app)
  directionsLink:
    'https://www.google.com/maps/dir/?api=1&destination=649+Borzoi+Street,+Garsfontein,+Pretoria,+0042',
  areasServed: [
    'Garsfontein',
    'Faerie Glen',
    'Woodhill',
    'Olympus',
    'Boardwalk',
    'Moreleta Park',
    'Constantia Park',
    'Elardus Park',
  ],
}

export function whatsappHref(message: string = business.whatsappMessage) {
  return `https://wa.me/${business.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const fullAddress = `${business.address.street}, ${business.address.suburb}, ${business.address.city}, ${business.address.postalCode}`
