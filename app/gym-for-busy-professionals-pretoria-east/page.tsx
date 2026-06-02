import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'

export const metadata: Metadata = {
  title: 'Gym For Busy Professionals Pretoria East',
  description:
    'No time for the gym? TENROUNDS in Garsfontein, Pretoria East gives busy professionals a complete coach-supported workout in 30 minutes with no class times — train before work, at lunch or on the way home. Start your free trial.',
  alternates: { canonical: '/gym-for-busy-professionals-pretoria-east' },
  openGraph: {
    title: 'Gym For Busy Professionals Pretoria East | TENROUNDS',
    description:
      'A complete 30-minute workout with no class times for busy professionals in Pretoria East. Train on your schedule.',
    images: [{ url: '/gym-stations.png' }],
  },
}

const config: LandingConfig = {
  slug: 'gym-for-busy-professionals-pretoria-east',
  breadcrumb: 'Gym For Busy Professionals',
  heroEyebrow: 'Gym For Busy Professionals',
  heroTitle: 'Fitness That Fits Your',
  heroHighlight: 'Schedule',
  heroSubtitle:
    'TENROUNDS is built for busy professionals in Pretoria East — a complete coach-supported workout in just 30 minutes, with no class times. Train before work, over lunch or on your way home. No wasted minutes.',
  heroImage: '/gym-stations.png',
  heroImageAlt: 'Efficient training stations for busy professionals at TENROUNDS Pretoria East',
  intro:
    'Your calendar is full. Your evenings are precious. The last thing you need is a 90-minute gym trip with no plan. TENROUNDS gives you a full strength-and-cardio workout in 30 focused minutes, guided by a coach — so fitness finally fits around your life instead of competing with it.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'Why It Works For You',
      title: 'Maximum Results, Minimum Time',
      description:
        'Every part of the TENROUNDS experience is designed for people whose time is genuinely limited.',
      items: [
        { icon: 'timer', title: 'In And Out In 30', desc: 'A complete workout you can fit into a lunch break or before your first meeting.' },
        { icon: 'clock', title: 'No Class Times', desc: 'No bookings, no waiting — train the moment you arrive, whenever that is.' },
        { icon: 'users', title: 'Done-For-You Plan', desc: 'No deciding what to do. A coach hands you a structured session every time.' },
        { icon: 'heart', title: 'Heart-Rate Tracking', desc: 'Know your workout was effective even on your busiest day.' },
        { icon: 'target', title: 'Zero Wasted Effort', desc: 'Programming engineered so every single minute counts toward results.' },
        { icon: 'trending', title: 'Consistency Made Easy', desc: 'Short, flexible sessions are the ones busy people actually stick to.' },
      ],
    },
    {
      type: 'split',
      eyebrow: 'The Real Problem',
      title: 'You Do Not Lack Discipline — You Lack Time',
      body: [
        'Most professionals do not quit the gym because they are lazy. They quit because traditional training takes too long and demands too much planning around a packed diary.',
        'TENROUNDS removes every excuse: no commute-killing session lengths, no class you have to pre-book, no standing around deciding what to train. You walk in, a coach guides you, and 30 minutes later you are back to your day — fitter.',
      ],
      image: '/coach-support.png',
      imageAlt: 'Coach guiding a professional through an efficient session at TENROUNDS',
      bullets: [
        'No bookings to manage around meetings',
        'A coach plans the session so you do not have to',
        'Early-morning and daytime training windows',
      ],
      dark: true,
    },
    {
      type: 'checklist',
      eyebrow: 'Perfect If You',
      title: 'Sound Familiar?',
      description: 'TENROUNDS was built for exactly this.',
      items: [
        'Work long or unpredictable hours',
        'Have tried gyms before but could not stay consistent',
        'Want results without spending two hours a day',
        'Hate planning your own workouts',
        'Need to train early, at lunch or late',
        'Want a coach keeping you accountable',
      ],
    },
  ],
  faqs: [
    {
      question: 'Can I really get a full workout in 30 minutes?',
      answer:
        'Yes. Our sessions are programmed to deliver a complete strength and cardio stimulus in 30 minutes through high-intensity interval training. Heart-rate tracking proves you have done enough — no junk volume, no wasted time.',
    },
    {
      question: 'I travel and my schedule changes constantly. Will this work?',
      answer:
        'That is exactly who TENROUNDS is built for. There are no class times, so you simply train whenever you can during opening hours — early morning, lunchtime or evening.',
    },
    {
      question: 'What are your opening hours?',
      answer:
        'We open early and run until the evening on weekdays plus Saturday mornings, so you can train around work and family. Anytime access covers all opening hours.',
    },
    {
      question: 'Do I have to plan my own workout?',
      answer:
        'Never. A qualified coach hands you a structured, scaled session the moment you arrive, so you can switch your brain off and just train.',
    },
    {
      question: 'Where are you located?',
      answer:
        'TENROUNDS is at 649 Borzoi Street, Garsfontein, Pretoria East — convenient for professionals working across Pretoria East and the surrounding suburbs.',
    },
  ],
  showMap: true,
  ctaHeadline: 'Reclaim Your Time In Pretoria East',
  ctaSub:
    'A complete workout in 30 minutes, on your schedule. Your first coach-supported session in Garsfontein is free.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
