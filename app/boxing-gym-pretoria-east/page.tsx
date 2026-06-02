import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'

export const metadata: Metadata = {
  title: 'Boxing Gym Pretoria East',
  description:
    'Searching for a boxing gym in Pretoria East? TENROUNDS in Garsfontein has four dedicated boxing-bag stations, coach-led technique and 30-minute HIIT sessions with no class times. Free trial and free gloves on longer plans.',
  alternates: { canonical: '/boxing-gym-pretoria-east' },
  openGraph: {
    title: 'Boxing Gym Pretoria East | TENROUNDS Garsfontein',
    description:
      'Four boxing-bag stations, coach-led technique and 30-minute HIIT in Pretoria East. No class times. Free trial available.',
    images: [{ url: '/round-boxing-bag.webp' }],
  },
}

const config: LandingConfig = {
  slug: 'boxing-gym-pretoria-east',
  breadcrumb: 'Boxing Gym Pretoria East',
  heroEyebrow: 'Boxing Gym Pretoria East',
  heroTitle: 'The Boxing Gym For',
  heroHighlight: 'Pretoria East',
  heroSubtitle:
    'TENROUNDS is the boxing gym Pretoria East trains at — four dedicated bag stations, coach-led technique and 30-minute HIIT conditioning, all with no class times and every round scaled to you.',
  heroImage: '/round-boxing-bag.webp',
  heroImageAlt: 'Boxing-bag stations at the TENROUNDS boxing gym in Pretoria East',
  intro:
    'Boxing is one of the most complete workouts on earth — it builds power, conditioning, coordination and confidence all at once. At TENROUNDS we put real bag work at the heart of a 30-minute session that anyone can do, guided by coaches every step of the way.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'What You Get',
      title: 'A Real Boxing Workout',
      description:
        'Everything you need to train like a boxer without the intimidation of a traditional fight gym.',
      items: [
        { icon: 'zap', title: 'Four Bag Stations', desc: 'Dedicated boxing bags so you get genuine striking work every session.' },
        { icon: 'users', title: 'Coach-Led Technique', desc: 'Learn proper punches, combinations and footwork from qualified coaches.' },
        { icon: 'heart', title: 'Heart-Rate Tracking', desc: 'See your effort live and train in the zones that build conditioning fastest.' },
        { icon: 'dumbbell', title: 'Strength + Boxing', desc: 'Bag rounds combined with functional strength for a complete body.' },
        { icon: 'timer', title: '30-Minute Rounds', desc: 'A full boxing-style conditioning session in half an hour.' },
        { icon: 'target', title: 'All Levels', desc: 'From total beginners to seasoned athletes, every round is scaled to you.' },
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Why Not A Traditional Fight Gym',
      failTitle: 'Old-School Boxing Gyms',
      winTitle: 'TENROUNDS Boxing',
      fail: [
        'Intimidating atmosphere that puts beginners off',
        'Sparring and contact when you just want fitness',
        'Little structure unless you pay for private coaching',
        'Fixed training times that clash with work and family',
      ],
      win: [
        'A welcoming floor where everyone trains together',
        'Bag-based conditioning with zero contact required',
        'Coaches guiding your technique in every session',
        'No class times — train whenever it suits you',
      ],
    },
    {
      type: 'split',
      eyebrow: 'Why It Works',
      title: 'Power, Conditioning, Confidence',
      body: [
        'Hitting the bag is a full-body effort — legs, core, shoulders and back all fire with every punch. Add our HIIT and strength stations and you build real athletic conditioning, not just gym fitness.',
        'And there is the mental side: few workouts beat boxing for stress relief and confidence. Members across Pretoria East tell us the bag is the best part of their day.',
      ],
      image: '/boxing-gloves-perk.png',
      imageAlt: 'Free TENROUNDS boxing gloves with membership in Pretoria East',
      bullets: [
        'Free TENROUNDS gloves on 6 and 12-month plans',
        'Full-body conditioning with every round',
        'Stress relief that keeps members coming back',
      ],
      dark: true,
    },
  ],
  faqs: [
    {
      question: 'Is this a real boxing gym or fitness boxing?',
      answer:
        'TENROUNDS is a fitness-focused boxing gym. You get genuine bag work and coach-led technique combined with HIIT and strength training, but without sparring or contact — so you build boxing skills and serious fitness safely.',
    },
    {
      question: 'Do I need boxing experience?',
      answer:
        'No. Our coaches teach you proper punching technique and footwork from your first session and scale the intensity to your level, so beginners are completely at home.',
    },
    {
      question: 'Are gloves provided?',
      answer:
        'You can bring your own, and all 6-month and 12-month memberships include a free pair of TENROUNDS boxing gloves to keep.',
    },
    {
      question: 'How many boxing stations do you have?',
      answer:
        'We have four dedicated boxing-bag stations as part of our circuit, so bag work is a real part of every session rather than an occasional extra.',
    },
    {
      question: 'Where is the gym located?',
      answer:
        'TENROUNDS is at 649 Borzoi Street, Garsfontein, Pretoria East — easy to reach from Moreleta Park, Faerie Glen, Woodhill, Olympus and Boardwalk.',
    },
  ],
  showMap: true,
  ctaHeadline: 'Step Into The Ring In Pretoria East',
  ctaSub:
    'Try real bag work and coach-led conditioning in one 30-minute session. Your first round in Garsfontein is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
