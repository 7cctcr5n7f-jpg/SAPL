import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'
import { testimonials } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Group Fitness Classes Pretoria East',
  description:
    'Want group fitness classes in Pretoria East without the rigid timetable? TENROUNDS gives you the energy of a group floor with multiple coaches, heart-rate tracking and 30-minute sessions — and no class times. Free trial in Garsfontein.',
  alternates: { canonical: '/group-fitness-classes-pretoria-east' },
  openGraph: {
    title: 'Group Fitness Classes Pretoria East | TENROUNDS Garsfontein',
    description:
      'The energy of group fitness with the freedom of no class times. Coach-supported 30-minute sessions in Pretoria East.',
    images: [{ url: '/community.png' }],
  },
}

const config: LandingConfig = {
  slug: 'group-fitness-classes-pretoria-east',
  breadcrumb: 'Group Fitness Classes',
  heroEyebrow: 'Group Fitness Classes Pretoria East',
  heroTitle: 'Group Energy, Zero',
  heroHighlight: 'Class Times',
  heroSubtitle:
    'TENROUNDS gives Pretoria East the buzz of a group fitness floor — multiple coaches, a motivating community and heart-rate tracking — but with no fixed class times. Train alongside others whenever it suits you.',
  heroImage: '/community.png',
  heroImageAlt: 'Group fitness community training together at TENROUNDS Pretoria East',
  intro:
    'Group classes are motivating — until the only slot is at a time you cannot make. TENROUNDS keeps the energy, camaraderie and coaching of group fitness but removes the rigid timetable, so you get the best of both worlds in one 30-minute session.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'The Best Of Both Worlds',
      title: 'Community Without The Constraints',
      description:
        'All the motivation of training with others, none of the booking stress.',
      items: [
        { icon: 'users', title: 'Train With Others', desc: 'Share the floor and the energy with a friendly, motivating community.' },
        { icon: 'clock', title: 'No Class Times', desc: 'No timetable to plan around — arrive whenever it suits you.' },
        { icon: 'target', title: 'Multiple Coaches', desc: 'Several coaches on the floor means real attention, not a faceless crowd.' },
        { icon: 'heart', title: 'Heart-Rate Tracking', desc: 'See everyone’s effort on screen — a little friendly competition included.' },
        { icon: 'timer', title: '30-Minute Sessions', desc: 'A full group-style workout done in half an hour.' },
        { icon: 'trending', title: 'Scaled For Everyone', desc: 'Beginners and athletes train side by side, each at the right level.' },
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Why Not A Traditional Group Class',
      failTitle: 'Booked Group Classes',
      winTitle: 'TENROUNDS Group Floor',
      fail: [
        'Rigid class times that rarely fit your week',
        'Miss the slot and you miss the whole workout',
        'One instructor for a packed room with no individual attention',
        'Same routine on repeat until it gets stale',
      ],
      win: [
        'No class times — train whenever you walk in',
        'Never miss out because of a fixed timetable',
        'Multiple coaches watching and correcting your form',
        'Programming that changes constantly to keep it fresh',
      ],
    },
    {
      type: 'split',
      eyebrow: 'Why It Works',
      title: 'Motivation That Keeps You Coming Back',
      body: [
        'Training around other people pushes you harder than training alone — that is just human nature. The buzz of a busy floor, a coach calling your name and the shared effort all add up to better workouts.',
        'TENROUNDS bottles that energy into a flexible format. You get the community and accountability of group fitness in Pretoria East without ever being tied to a class on the clock.',
      ],
      image: '/community-members.png',
      imageAlt: 'TENROUNDS members training together in Pretoria East',
      bullets: [
        'A community that keeps you accountable',
        'Coaches who know your name and your goals',
        'Friendly, motivating, never intimidating',
      ],
      dark: true,
    },
  ],
  faqs: [
    {
      question: 'Are these scheduled classes I have to book?',
      answer:
        'No — and that is the point. TENROUNDS gives you the energy of a group fitness class with no fixed class times. Arrive whenever it suits you during opening hours and train alongside others on the floor.',
    },
    {
      question: 'Will I get individual attention in a group setting?',
      answer:
        'Yes. We keep multiple coaches on the floor at all times, so even though you train with others you get real form correction and encouragement throughout your session.',
    },
    {
      question: 'Is it suitable for beginners?',
      answer:
        'Completely. Every movement is scaled to your level by a coach, so beginners and experienced members train side by side, each working at the right intensity.',
    },
    {
      question: 'How long is a session?',
      answer:
        'Just 30 minutes — a full group-style strength and cardio workout that fits easily into your day.',
    },
    {
      question: 'Where are you located?',
      answer:
        'TENROUNDS is at 649 Borzoi Street, Garsfontein, Pretoria East — minutes from Moreleta Park, Faerie Glen, Woodhill, Olympus and Boardwalk.',
    },
  ],
  testimonials: [testimonials[0], testimonials[1], testimonials[3]],
  showMap: true,
  ctaHeadline: 'Feel The Energy In Pretoria East',
  ctaSub:
    'Group motivation, multiple coaches and no class times in one 30-minute session. Your first one in Garsfontein is free.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
