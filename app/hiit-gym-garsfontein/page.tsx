import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'

export const metadata: Metadata = {
  title: 'HIIT Gym Garsfontein',
  description:
    'Looking for a HIIT gym in Garsfontein? TENROUNDS delivers coach-supported 30-minute workouts with no class times and heart-rate tracking. Start your free trial in Pretoria East today.',
  alternates: { canonical: '/hiit-gym-garsfontein' },
  openGraph: {
    title: 'HIIT Gym Garsfontein | TENROUNDS Pretoria East',
    description:
      'Coach-supported 30-minute HIIT workouts in Garsfontein. No class times. Heart-rate tracking. All fitness levels welcome.',
    images: [{ url: '/functional-zone.png' }],
  },
}

const config: LandingConfig = {
  slug: 'hiit-gym-garsfontein',
  breadcrumb: 'HIIT Gym Garsfontein',
  heroEyebrow: 'HIIT Gym Garsfontein',
  heroTitle: 'Looking For A HIIT Gym In',
  heroHighlight: 'Garsfontein?',
  heroSubtitle:
    'TENROUNDS is the boutique HIIT gym Garsfontein residents train at — coach-supported 30-minute sessions, no class times, and real heart-rate tracking. Smarter training, right on your doorstep.',
  heroImage: '/functional-zone.png',
  heroImageAlt: 'TENROUNDS HIIT training zone in Garsfontein, Pretoria East',
  intro:
    'No queues. No 90-minute sessions. No guesswork. Just an expertly programmed HIIT workout you can complete in 30 minutes, whenever it suits you — guided by a real coach every step of the way.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'Why Members Choose Us',
      title: 'A Smarter Way To Train',
      description:
        'Everything about TENROUNDS in Garsfontein is built to get you in, get you results, and get you on with your day.',
      items: [
        { icon: 'users', title: 'Coach-Supported Workouts', desc: 'A qualified coach guides and corrects you every single session.' },
        { icon: 'timer', title: '30-Minute Sessions', desc: 'A complete strength and cardio stimulus without wasting your day.' },
        { icon: 'clock', title: 'No Class Times', desc: 'Walk in when it suits you. No bookings, no waiting for a slot.' },
        { icon: 'heart', title: 'Heart-Rate Tracking', desc: 'Train in the right zones and watch your fitness improve on screen.' },
        { icon: 'target', title: 'All Fitness Levels', desc: 'Every workout is scaled to you, whether day one or year ten.' },
        { icon: 'trending', title: 'Measurable Progress', desc: 'Data-driven sessions so you can see results, not just feel them.' },
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Why Traditional Gyms Fail',
      failTitle: 'Big-Box Gyms',
      winTitle: 'TENROUNDS Garsfontein',
      fail: [
        'You walk in with no plan and wander between machines',
        'Long, unfocused workouts that eat your evening',
        'No coaching unless you pay premium personal training rates',
        'Crowded floors and queues for equipment at peak times',
        'Easy to quit because nobody notices if you stop showing up',
      ],
      win: [
        'A structured, coach-supported plan the moment you arrive',
        'A full-body workout done in 30 focused minutes',
        'Expert coaching included in every single session',
        'No class times — train the second you walk in',
        'A community and coaches who keep you accountable',
      ],
    },
    {
      type: 'split',
      eyebrow: 'Why It Works',
      title: 'Built For Real Results',
      body: [
        'TENROUNDS combines high-intensity interval training with strength and functional movement, all programmed and coached for you. That means every minute counts.',
        'Because sessions are only 30 minutes and there are no class times, training fits around your life in Garsfontein instead of the other way around — which is exactly why our members actually stick with it.',
      ],
      image: '/strength-training.png',
      imageAlt: 'Coach-supported HIIT strength training at TENROUNDS Garsfontein',
      bullets: [
        'Programming that progresses with you',
        'Heart-rate tracking on every session',
        'Coaches who know your name and your goals',
      ],
    },
  ],
  faqs: [
    {
      question: 'Where is your HIIT gym in Garsfontein located?',
      answer:
        'TENROUNDS is at 649 Borzoi Street, Garsfontein, Pretoria East — easy to reach from Moreleta Park, Woodhill, Boardwalk, Olympus and Faerie Glen.',
    },
    {
      question: 'Do I need to be fit to start HIIT?',
      answer:
        'Not at all. Every TENROUNDS session is scaled to your level by a qualified coach, so complete beginners train safely alongside seasoned athletes.',
    },
    {
      question: 'How long are the workouts?',
      answer:
        'Just 30 minutes. It is a full strength and cardio stimulus designed to fit into the busiest Garsfontein schedule.',
    },
    {
      question: 'Are there class times I have to book?',
      answer:
        'No. TENROUNDS has no class times. Arrive whenever it suits you during opening hours and a coach will guide your session.',
    },
    {
      question: 'Can I try it before committing?',
      answer:
        'Yes. Your first coach-supported session and fitness assessment are completely free. Claim your free trial online or via WhatsApp.',
    },
  ],
  showMap: true,
  ctaHeadline: 'Your HIIT Gym In Garsfontein Awaits',
  ctaSub:
    'Experience coach-supported 30-minute training with no class times. Your first session in Garsfontein is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
