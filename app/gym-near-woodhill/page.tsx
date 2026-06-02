import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'
import { testimonials } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Gym Near Woodhill',
  description:
    'Searching for a gym near Woodhill? TENROUNDS is the closest premium HIIT gym to Woodhill — coach-supported 30-minute workouts, no class times, minutes from Boardwalk and Olympus.',
  alternates: { canonical: '/gym-near-woodhill' },
  openGraph: {
    title: 'Gym Near Woodhill | TENROUNDS Pretoria East',
    description:
      'The closest premium HIIT gym to Woodhill. Coach-supported 30-minute sessions with no class times. Start your free trial today.',
    images: [{ url: '/gym-stations.png' }],
  },
}

const config: LandingConfig = {
  slug: 'gym-near-woodhill',
  breadcrumb: 'Gym Near Woodhill',
  heroEyebrow: 'Gym Near Woodhill',
  heroTitle: 'The Closest Premium HIIT Gym To',
  heroHighlight: 'Woodhill',
  heroSubtitle:
    'TENROUNDS is just minutes from Woodhill in Garsfontein, Pretoria East. Coach-supported 30-minute workouts, no class times, and a short drive that makes consistent training effortless.',
  heroImage: '/gym-stations.png',
  heroImageAlt: 'TENROUNDS HIIT gym near Woodhill in Garsfontein, Pretoria East',
  intro:
    'Living in Woodhill means you are only a few minutes from a smarter way to train. No long commutes, no wasted hours — just an expertly coached 30-minute workout whenever it suits you.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'Minutes Away',
      title: 'How Close Are We?',
      description:
        'TENROUNDS sits in Garsfontein, perfectly positioned for residents across the eastern suburbs.',
      items: [
        { icon: 'clock', title: 'Minutes From Woodhill', desc: 'A short, easy drive from Woodhill estates straight to your session.' },
        { icon: 'clock', title: 'Minutes From Boardwalk', desc: 'Quick access from Boardwalk means you train more and commute less.' },
        { icon: 'clock', title: 'Minutes From Olympus', desc: 'Conveniently reachable from Olympus and the surrounding suburbs.' },
        { icon: 'timer', title: '30-Minute Sessions', desc: 'In, trained, and out — without sacrificing your whole evening.' },
        { icon: 'users', title: 'Coach-Supported Always', desc: 'A qualified coach guides every session from start to finish.' },
        { icon: 'clock', title: 'No Class Times', desc: 'Arrive when it suits you — no bookings, no waiting for a slot.' },
      ],
    },
    {
      type: 'split',
      eyebrow: 'Why Woodhill Trains Here',
      title: 'Why Woodhill Residents Choose TENROUNDS',
      body: [
        'Woodhill members tell us the same thing: the closer and faster a gym is, the more they actually go. TENROUNDS removes every excuse with a quick drive and a workout that is over in 30 focused minutes.',
        'Add a real coach to every session and heart-rate tracking that proves your progress, and it is easy to see why Woodhill residents make TENROUNDS their training home.',
      ],
      image: '/coach-support.png',
      imageAlt: 'Coach supporting a member at TENROUNDS near Woodhill',
      bullets: [
        'A short, convenient drive from Woodhill',
        'Coach-supported 30-minute sessions, no class times',
        'Secure, premium boutique facility in Garsfontein',
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The No Class Times Advantage',
      title: 'Train On Your Schedule, Not Theirs',
      failTitle: 'Class-Based Studios',
      winTitle: 'TENROUNDS Near Woodhill',
      fail: [
        'Locked into rigid class times that rarely fit your day',
        'Miss the slot and you miss the workout entirely',
        'Booking apps, waitlists and cancellation penalties',
        'Packed classes where you barely get coached',
      ],
      win: [
        'Walk in any time during opening hours and start',
        'Never miss a session because of a fixed timetable',
        'No bookings, no waitlists, no penalties',
        'Personal coaching attention every single visit',
      ],
    },
  ],
  faqs: [
    {
      question: 'How far is TENROUNDS from Woodhill?',
      answer:
        'TENROUNDS is just a few minutes from Woodhill at 649 Borzoi Street, Garsfontein, Pretoria East — an easy drive from Woodhill, Boardwalk and Olympus.',
    },
    {
      question: 'Do I have to book a class time?',
      answer:
        'No. TENROUNDS has no class times. Arrive whenever it suits you during opening hours and a coach will guide your 30-minute session.',
    },
    {
      question: 'Is there secure parking?',
      answer:
        'Yes. Our Garsfontein facility offers convenient, secure parking so getting in and out for your 30-minute session is effortless.',
    },
    {
      question: 'What are your opening hours?',
      answer:
        'We are open Monday to Friday 05:00–10:00 and 13:00–19:00, and Saturday 07:00–10:00, with no class times in between.',
    },
    {
      question: 'Can I try a session before joining?',
      answer:
        'Absolutely. Your first coach-supported session and fitness assessment are free. Claim your trial online or via WhatsApp.',
    },
  ],
  testimonials: [testimonials[2], testimonials[0], testimonials[1]],
  showMap: true,
  ctaHeadline: 'The Closest Premium Gym To Woodhill',
  ctaSub:
    'Coach-supported 30-minute training, minutes from home, with no class times. Your first session is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
