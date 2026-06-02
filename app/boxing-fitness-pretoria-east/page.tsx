import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'
import type { Testimonial } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Boxing Fitness Pretoria East',
  description:
    'Boxing fitness in Pretoria East without getting punched. Burn fat, build conditioning and relieve stress with coach-supported boxing-style HIIT at TENROUNDS in Garsfontein. Free trial available.',
  alternates: { canonical: '/boxing-fitness-pretoria-east' },
  openGraph: {
    title: 'Boxing Fitness Pretoria East | TENROUNDS',
    description:
      'Coach-supported boxing fitness in Pretoria East. Weight loss, conditioning and confidence — no sparring, no class times.',
    images: [{ url: '/coach-support.png' }],
  },
}

const boxingTestimonials: Testimonial[] = [
  {
    quote:
      'The boxing-style conditioning melts stress away and the fat came off fast. Best decision I made in Pretoria East.',
    name: 'Marius B.',
    detail: 'Olympus · Member 7 months',
  },
  {
    quote:
      'I was nervous as a total beginner but the coaches made it easy. No sparring, just the best workout of my week.',
    name: 'Ayesha S.',
    detail: 'Garsfontein · Member 5 months',
  },
  {
    quote:
      'Stronger, leaner and far less stressed. The 30-minute boxing sessions are addictive.',
    name: 'Tumelo R.',
    detail: 'Moreleta Park · Member 1 year',
  },
  {
    quote:
      'Finally a boxing workout that fits my lunch break. The confidence boost is real.',
    name: 'Hannelie V.',
    detail: 'Faerie Glen · Member 9 months',
  },
]

const config: LandingConfig = {
  slug: 'boxing-fitness-pretoria-east',
  breadcrumb: 'Boxing Fitness Pretoria East',
  heroEyebrow: 'Boxing Fitness Pretoria East',
  heroTitle: 'Boxing Fitness Without',
  heroHighlight: 'Getting Punched',
  heroSubtitle:
    'Get the fat-burning, stress-busting power of boxing training without ever taking a hit. TENROUNDS brings coach-supported boxing fitness to Pretoria East in focused 30-minute sessions.',
  heroImage: '/coach-support.png',
  heroImageAlt: 'Coach-supported boxing fitness session at TENROUNDS Pretoria East',
  intro:
    'Boxing is one of the most effective full-body workouts on earth. At TENROUNDS we capture all of that intensity — the conditioning, the power, the stress relief — in a safe, coached environment with zero contact.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'The Benefits',
      title: 'Why People Box For Fitness',
      description:
        'A boxing-style workout hits everything at once — and it is genuinely fun, which is why members keep coming back.',
      items: [
        { icon: 'trending', title: 'Weight Loss', desc: 'High-intensity rounds torch calories long after you leave.' },
        { icon: 'heart', title: 'Fitness & Conditioning', desc: 'Build serious cardio and muscular endurance fast.' },
        { icon: 'zap', title: 'Stress Relief', desc: 'There is nothing like hitting pads to clear your head.' },
        { icon: 'target', title: 'Confidence', desc: 'Move with power and walk out standing taller.' },
        { icon: 'dumbbell', title: 'Full-Body Strength', desc: 'Combine boxing with functional strength training.' },
        { icon: 'timer', title: '30 Minutes Flat', desc: 'A complete boxing-fitness session that fits your day.' },
      ],
    },
    {
      type: 'split',
      eyebrow: 'The Science',
      title: 'Why Boxing Burns More Calories',
      body: [
        'Boxing fitness blends explosive intervals with constant movement, recruiting your entire body. That elevates your heart rate into fat-burning zones and keeps your metabolism elevated for hours afterwards.',
        'At TENROUNDS every round is coached and tracked, so you stay in the right intensity zone for maximum results — no wasted effort, no guesswork.',
      ],
      image: '/strength-training.png',
      imageAlt: 'High-intensity boxing conditioning at TENROUNDS',
      bullets: [
        'Explosive intervals for maximum calorie burn',
        'Heart-rate tracking keeps you in the fat-burning zone',
        'Strength and conditioning built into every session',
      ],
    },
    {
      type: 'checklist',
      eyebrow: 'Who It Is For',
      title: 'Built For Everyone In Pretoria East',
      description: 'No experience required. No contact. Just a brilliant workout coached for your level.',
      items: [
        'Beginners who have never thrown a punch',
        'Professionals who want maximum results in minimum time',
        'Parents fitting fitness around a busy family schedule',
        'Students looking for an affordable, high-energy workout',
      ],
    },
    {
      type: 'split',
      eyebrow: 'Your Session',
      title: 'What Happens In A TENROUNDS Session',
      reverse: true,
      body: [
        'You arrive whenever it suits you — no class times. Your coach warms you up, then guides you through boxing-style intervals layered with strength and functional movement.',
        'Thirty minutes later you walk out sweaty, energised and a step closer to your goals. Every session is different, every session is coached.',
      ],
      image: '/coach-support.png',
      imageAlt: 'TENROUNDS coach guiding a boxing fitness member',
      dark: true,
    },
  ],
  faqs: [
    {
      question: 'Do I need boxing experience?',
      answer:
        'None at all. TENROUNDS boxing fitness is fully coached and scaled to beginners, so you will learn safely from your very first session.',
    },
    {
      question: 'Will I get hit or have to spar?',
      answer:
        'No. This is boxing for fitness — all the conditioning and stress relief of boxing with zero contact and no sparring.',
    },
    {
      question: 'Where are you based?',
      answer:
        'We are at 649 Borzoi Street, Garsfontein, Pretoria East — central to Faerie Glen, Woodhill, Olympus, Boardwalk and Moreleta Park.',
    },
    {
      question: 'How long is a session?',
      answer:
        'Each coached boxing-fitness session is 30 minutes — a complete, high-intensity full-body workout.',
    },
    {
      question: 'Can I try a session for free?',
      answer:
        'Yes. Your first coached session and fitness assessment are free. Book your free trial online or message us on WhatsApp.',
    },
  ],
  testimonials: boxingTestimonials,
  showMap: true,
  ctaHeadline: 'Box Your Way Fit In Pretoria East',
  ctaSub:
    'All the power of boxing, none of the punches. Claim your free coach-supported session at TENROUNDS today.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
