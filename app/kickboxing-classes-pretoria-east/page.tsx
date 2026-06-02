import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'

export const metadata: Metadata = {
  title: 'Kickboxing Classes Pretoria East',
  description:
    'Looking for kickboxing classes in Pretoria East? TENROUNDS blends boxing-bag work and HIIT into coach-supported 30-minute sessions with no class times. Learn technique, burn fat and have fun in Garsfontein. Free trial available.',
  alternates: { canonical: '/kickboxing-classes-pretoria-east' },
  openGraph: {
    title: 'Kickboxing Classes Pretoria East | TENROUNDS Garsfontein',
    description:
      'Coach-led kickboxing and boxing-bag fitness in Pretoria East. 30-minute sessions, no class times, all levels welcome.',
    images: [{ url: '/round-boxing-bag.webp' }],
  },
}

const config: LandingConfig = {
  slug: 'kickboxing-classes-pretoria-east',
  breadcrumb: 'Kickboxing Classes Pretoria East',
  heroEyebrow: 'Kickboxing Classes Pretoria East',
  heroTitle: 'Kickboxing Classes In',
  heroHighlight: 'Pretoria East',
  heroSubtitle:
    'TENROUNDS brings the energy of kickboxing and boxing-bag training to Pretoria East — coach-supported 30-minute sessions across our bag stations, with no class times and every move scaled to you.',
  heroImage: '/round-boxing-bag.webp',
  heroImageAlt: 'Kickboxing and boxing-bag training at TENROUNDS Pretoria East',
  intro:
    'There is nothing like the rush of hitting the bag. At TENROUNDS we channel that into a complete workout — combining striking technique, footwork and HIIT conditioning into a 30-minute session that builds fitness, torches calories and is genuinely addictive.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'Why Members Love It',
      title: 'More Than A Workout',
      description:
        'Our bag-based training gives you the stress relief and skill of kickboxing with the results of high-intensity interval training.',
      items: [
        { icon: 'zap', title: 'Real Bag Work', desc: 'Four dedicated boxing-bag stations to punch, strike and condition on.' },
        { icon: 'users', title: 'Coach-Led Technique', desc: 'Coaches guide your form so you learn to strike properly and safely.' },
        { icon: 'heart', title: 'Huge Calorie Burn', desc: 'Striking combined with HIIT makes for one of the best fat-burning workouts there is.' },
        { icon: 'timer', title: '30-Minute Sessions', desc: 'A full conditioning and skill workout that fits any schedule.' },
        { icon: 'target', title: 'Stress Relief', desc: 'Few things beat the bag for clearing your head after a long day.' },
        { icon: 'clock', title: 'No Class Times', desc: 'Train when it suits you — no fixed timetable to work around.' },
      ],
    },
    {
      type: 'split',
      eyebrow: 'Built For Everyone',
      title: 'From First-Timers To Fighters',
      body: [
        'You do not need any experience to start. Our coaches teach you the fundamentals of striking and footwork from your very first session, scaling the intensity so you train at the right level.',
        'Because every session blends technique with high-intensity conditioning, you build coordination, power and serious fitness at the same time — all in 30 focused minutes, right here in Pretoria East.',
      ],
      image: '/boxing-gloves-perk.png',
      imageAlt: 'TENROUNDS boxing gloves included with membership in Pretoria East',
      bullets: [
        'Free TENROUNDS gloves on 6 and 12-month memberships',
        'Technique coaching included every session',
        'Every workout scaled from beginner to advanced',
      ],
      dark: true,
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Why TENROUNDS Over A Traditional Class',
      failTitle: 'Standard Fitness Classes',
      winTitle: 'TENROUNDS Bag Training',
      fail: [
        'Fixed class times you have to plan your whole day around',
        'Big groups where the instructor never sees your form',
        'Repetitive routines that get stale within weeks',
        'Little personal feedback or progression',
      ],
      win: [
        'No class times — walk in whenever it suits you',
        'Multiple coaches on the floor watching your technique',
        'Programming that changes constantly so you never get bored',
        'Heart-rate tracking and real coaching on every session',
      ],
    },
  ],
  faqs: [
    {
      question: 'Do I need kickboxing experience to join?',
      answer:
        'Not at all. Our coaches teach you striking technique and footwork from your first session and scale every movement to your level, so complete beginners are very welcome.',
    },
    {
      question: 'Is it actual kickboxing or fitness boxing?',
      answer:
        'TENROUNDS is bag-based fitness training that uses boxing and kickboxing techniques combined with HIIT conditioning. You learn to strike properly while getting an incredible full-body workout — without any sparring or contact.',
    },
    {
      question: 'Do I need my own gloves?',
      answer:
        'You are welcome to bring your own, and all 6-month and 12-month memberships include a free pair of TENROUNDS boxing gloves to keep.',
    },
    {
      question: 'How long are the sessions?',
      answer:
        'Just 30 minutes — a complete blend of striking skill and high-intensity conditioning that fits the busiest Pretoria East schedule.',
    },
    {
      question: 'Where are your classes held?',
      answer:
        'At our studio at 649 Borzoi Street, Garsfontein, Pretoria East — minutes from Moreleta Park, Faerie Glen, Woodhill and Olympus.',
    },
  ],
  showMap: true,
  ctaHeadline: 'Hit The Bag In Pretoria East',
  ctaSub:
    'Experience coach-led kickboxing and HIIT in one 30-minute session. Your first one in Garsfontein is free.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
