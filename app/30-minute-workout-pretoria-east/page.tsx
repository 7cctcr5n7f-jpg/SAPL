import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'
import { testimonials } from '@/lib/content'

export const metadata: Metadata = {
  title: '30 Minute Workout Pretoria East',
  description:
    'Only 30 minutes, real results. TENROUNDS delivers coach-supported 30-minute HIIT workouts in Pretoria East for busy professionals, parents and business owners. Start your free trial today.',
  alternates: { canonical: '/30-minute-workout-pretoria-east' },
  openGraph: {
    title: '30 Minute Workout Pretoria East | TENROUNDS',
    description:
      'Efficient coach-supported 30-minute HIIT workouts in Pretoria East. No class times. Real results. Start your free trial.',
    images: [{ url: '/hero-athlete.png' }],
  },
}

const config: LandingConfig = {
  slug: '30-minute-workout-pretoria-east',
  breadcrumb: '30 Minute Workout Pretoria East',
  heroEyebrow: '30 Minute Workout Pretoria East',
  heroTitle: 'Only 30 Minutes.',
  heroHighlight: 'Real Results.',
  heroSubtitle:
    'TENROUNDS is built for busy people in Pretoria East who refuse to spend hours in a gym. A complete, coach-supported HIIT workout done in 30 minutes — no class times, no wasted time.',
  heroImage: '/hero-athlete.png',
  heroImageAlt: 'Athlete completing a 30-minute HIIT workout at TENROUNDS Pretoria East',
  intro:
    'You do not need longer workouts. You need smarter ones. TENROUNDS packs a full strength and cardio stimulus into 30 focused, coached minutes so you can train hard and still get on with your day.',
  blocks: [
    {
      type: 'compare',
      eyebrow: 'The Truth About Time',
      title: 'Why Long Workouts Fail',
      failTitle: 'The 90-Minute Gym Trap',
      winTitle: 'The TENROUNDS 30-Minute Method',
      fail: [
        'Long sessions are the first thing to get cancelled when life gets busy',
        'Most of a 90-minute gym visit is rest, scrolling and waiting',
        'More time does not mean more results — intensity does',
        'Burnout and boredom make long routines impossible to sustain',
      ],
      win: [
        'Short enough to fit any schedule, every single day',
        'Every minute is programmed and coached for maximum effect',
        'High intensity drives results in a fraction of the time',
        'Easy to repeat consistently — and consistency wins',
      ],
    },
    {
      type: 'split',
      eyebrow: 'The Science',
      title: 'The Science Of HIIT Training',
      body: [
        'High-Intensity Interval Training alternates hard efforts with short recovery, pushing your heart rate into zones that burn fat and build fitness long after you leave the gym.',
        'Research consistently shows that short, intense sessions can match or beat much longer moderate workouts for fat loss and cardiovascular fitness. At TENROUNDS, every 30-minute session is engineered around that science — and guided by a coach.',
      ],
      image: '/functional-zone.png',
      imageAlt: 'High-intensity 30-minute HIIT training zone at TENROUNDS',
      bullets: [
        'Train in fat-burning heart-rate zones',
        'Elevated calorie burn after your session ends',
        'Maximum results from minimum time',
      ],
    },
    {
      type: 'checklist',
      eyebrow: 'Who It Is For',
      title: 'Perfect For Busy Pretoria East Lives',
      description:
        'If your time is tight but your standards are high, the TENROUNDS 30-minute workout was built for you.',
      items: [
        'Busy professionals who train before or after work',
        'Business owners who cannot lose hours to the gym',
        'Parents juggling family and fitness',
        'Students who want efficient, effective sessions',
        'Anyone who has quit long gym routines before',
        'People who want coaching without the time commitment',
      ],
    },
    {
      type: 'features',
      eyebrow: 'How It Works',
      title: 'How A TENROUNDS Session Works',
      dark: true,
      description:
        'Walk in, get coached, train hard, and leave in 30 minutes — every detail is handled for you.',
      items: [
        { icon: 'clock', title: 'Arrive Any Time', desc: 'No class times. Start your session whenever it suits your day.' },
        { icon: 'users', title: 'Coach Guides You', desc: 'A qualified coach leads the workout and corrects your form.' },
        { icon: 'heart', title: 'Track Your Effort', desc: 'Heart-rate monitoring keeps you in the right training zones.' },
        { icon: 'zap', title: 'Train With Intensity', desc: 'Structured intervals of strength and cardio that actually work.' },
        { icon: 'timer', title: 'Done In 30', desc: 'A complete, full-body workout finished in half an hour.' },
        { icon: 'trending', title: 'See Progress', desc: 'Data-tracked sessions so your results are measurable, not guessed.' },
      ],
    },
  ],
  faqs: [
    {
      question: 'Can a 30-minute workout really be effective?',
      answer:
        'Yes. High-Intensity Interval Training is proven to deliver excellent fat loss and fitness gains in short sessions. Because TENROUNDS workouts are coached and programmed, every one of those 30 minutes works hard for you.',
    },
    {
      question: 'Who are the 30-minute workouts designed for?',
      answer:
        'They are ideal for busy professionals, business owners, parents and students across Pretoria East who want real results without spending hours in a gym.',
    },
    {
      question: 'Do I need to book a time slot?',
      answer:
        'No. There are no class times. Arrive whenever it suits you during opening hours and a coach will guide your 30-minute session.',
    },
    {
      question: 'Will I get individual attention in 30 minutes?',
      answer:
        'Yes. Every session is coach-supported with personal guidance and form correction, so you train safely and effectively from the first minute.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'Absolutely. Your first coach-supported 30-minute session and fitness assessment are free. Book online or via WhatsApp.',
    },
  ],
  testimonials: [testimonials[2], testimonials[0], testimonials[3]],
  showMap: true,
  ctaHeadline: 'Only 30 Minutes To Real Results',
  ctaSub:
    'Stop trading hours for fitness. Experience a coach-supported 30-minute workout in Pretoria East — your first session is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
