import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'
import { testimonials } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Gym Near Faerie Glen',
  description:
    'Premium fitness for Faerie Glen residents. TENROUNDS delivers coach-supported 30-minute HIIT workouts with no class times, minutes from Faerie Glen in Garsfontein, Pretoria East.',
  alternates: { canonical: '/gym-near-faerie-glen' },
  openGraph: {
    title: 'Gym Near Faerie Glen | TENROUNDS Pretoria East',
    description:
      'Premium coach-supported 30-minute HIIT training minutes from Faerie Glen. No class times. Start your free trial today.',
    images: [{ url: '/strength-training.png' }],
  },
}

const config: LandingConfig = {
  slug: 'gym-near-faerie-glen',
  breadcrumb: 'Gym Near Faerie Glen',
  heroEyebrow: 'Gym Near Faerie Glen',
  heroTitle: 'Premium Fitness For',
  heroHighlight: 'Faerie Glen',
  heroSubtitle:
    'TENROUNDS brings boutique, coach-supported HIIT training within minutes of Faerie Glen. Complete a full strength and cardio workout in 30 minutes — with no class times to plan around.',
  heroImage: '/strength-training.png',
  heroImageAlt: 'TENROUNDS premium HIIT gym near Faerie Glen, Pretoria East',
  intro:
    'Faerie Glen residents want quality, convenience and results. TENROUNDS delivers all three with expert coaching, a premium facility in nearby Garsfontein, and workouts that respect your time.',
  blocks: [
    {
      type: 'split',
      eyebrow: 'Why Faerie Glen Trains Here',
      title: 'Why Members From Faerie Glen Train At TENROUNDS',
      body: [
        'For Faerie Glen residents, TENROUNDS is the boutique alternative to crowded big-box gyms — a premium space in Garsfontein just minutes away, where every session is coached and every minute counts.',
        'No queues, no guesswork, no 90-minute commitments. Just a structured 30-minute workout, real-time heart-rate tracking, and coaches who keep you accountable and progressing.',
      ],
      image: '/coach-support.png',
      imageAlt: 'Coach guiding a Faerie Glen member through a TENROUNDS session',
      bullets: [
        'Minutes from Faerie Glen in Garsfontein',
        'Boutique facility, not a crowded big-box gym',
        'Coaching included in every 30-minute session',
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Compare To Traditional Gyms',
      failTitle: 'Traditional Gyms',
      winTitle: 'TENROUNDS Near Faerie Glen',
      fail: [
        'No plan — you wander between machines hoping for results',
        'Long sessions that swallow your whole evening',
        'Coaching costs extra on top of your membership',
        'Crowded floors and equipment queues at peak hours',
        'Easy to drift off and quit unnoticed',
      ],
      win: [
        'A coached, structured plan from the moment you arrive',
        'A complete workout in just 30 focused minutes',
        'Expert coaching included with every session',
        'No class times — start the moment you walk in',
        'Coaches and a community that keep you consistent',
      ],
    },
    {
      type: 'checklist',
      eyebrow: 'Flexible Scheduling',
      title: 'Training That Fits Faerie Glen Life',
      description:
        'Between work, family and everything else, your training has to flex around you — and at TENROUNDS it does.',
      items: [
        'No class times — arrive whenever it suits you',
        'Full workout completed in 30 minutes',
        'Open mornings and afternoons, six days a week',
        'No bookings, waitlists or cancellation penalties',
        'Coach-guided so no session is ever wasted',
        'Quick, convenient drive from Faerie Glen',
      ],
    },
    {
      type: 'split',
      eyebrow: 'Real Results',
      title: 'Results You Can Measure',
      reverse: true,
      body: [
        'Every TENROUNDS session is tracked with heart-rate technology so you train in the right zones and see your fitness improve week after week.',
        'Members from Faerie Glen and across Pretoria East lose weight, build strength and gain energy — not by training longer, but by training smarter with a coach in their corner.',
      ],
      image: '/member-portrait.png',
      imageAlt: 'TENROUNDS member showing results near Faerie Glen',
      bullets: [
        'Heart-rate tracking on every session',
        'Progress you can see, not just feel',
        'Sustainable results that actually last',
      ],
    },
  ],
  faqs: [
    {
      question: 'How far is TENROUNDS from Faerie Glen?',
      answer:
        'TENROUNDS is just minutes from Faerie Glen at 649 Borzoi Street, Garsfontein, Pretoria East — a quick and convenient drive.',
    },
    {
      question: 'What makes TENROUNDS different from a normal gym?',
      answer:
        'Every session is coach-supported, only 30 minutes long, and there are no class times. You get personal coaching and heart-rate tracking included, not as an expensive add-on.',
    },
    {
      question: 'Do I need experience to start?',
      answer:
        'No experience required. Coaches scale every workout to your level, so beginners from Faerie Glen train safely right next to advanced members.',
    },
    {
      question: 'Can I train around my work and family schedule?',
      answer:
        'Yes. With no class times and 30-minute sessions, you simply arrive when it suits you during our opening hours.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'Yes. Your first coach-supported session and fitness assessment are completely free. Book online or via WhatsApp.',
    },
  ],
  testimonials: [testimonials[1], testimonials[3], testimonials[0]],
  showMap: true,
  ctaHeadline: 'Premium Fitness Minutes From Faerie Glen',
  ctaSub:
    'Coach-supported 30-minute HIIT with no class times, right on your doorstep. Your first session is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
