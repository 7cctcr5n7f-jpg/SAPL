import type { Metadata } from 'next'
import { LandingTemplate, type LandingConfig } from '@/components/landing/landing-template'

export const metadata: Metadata = {
  title: 'Weight Loss Gym Pretoria East',
  description:
    'Want to lose weight in Pretoria East? TENROUNDS delivers coach-supported 30-minute HIIT sessions that burn up to 500 calories, with heart-rate tracking to keep you in the fat-burning zone. Start your free trial in Garsfontein.',
  alternates: { canonical: '/weight-loss-gym-pretoria-east' },
  openGraph: {
    title: 'Weight Loss Gym Pretoria East | TENROUNDS Garsfontein',
    description:
      'Lose weight with coach-supported 30-minute HIIT in Pretoria East. Burn up to 500 calories per session with real heart-rate tracking.',
    images: [{ url: '/heart-rate-watch.png' }],
  },
}

const config: LandingConfig = {
  slug: 'weight-loss-gym-pretoria-east',
  breadcrumb: 'Weight Loss Gym Pretoria East',
  heroEyebrow: 'Weight Loss Gym Pretoria East',
  heroTitle: 'Lose Weight Faster In',
  heroHighlight: 'Pretoria East',
  heroSubtitle:
    'TENROUNDS is the weight-loss gym Pretoria East trusts — coach-supported 30-minute HIIT sessions that burn up to 500 calories, with live heart-rate tracking to keep you in the fat-burning zone every single workout.',
  heroImage: '/heart-rate-watch.png',
  heroImageAlt: 'Heart-rate tracking for weight loss training at TENROUNDS Pretoria East',
  intro:
    'Endless hours of cardio do not work. Short, intense, properly coached training does. At TENROUNDS we combine HIIT, strength and heart-rate science so you burn fat during your session and keep burning it long after you leave — in just 30 minutes a day.',
  blocks: [
    {
      type: 'features',
      eyebrow: 'Why It Works For Fat Loss',
      title: 'Built To Burn',
      description:
        'Everything about a TENROUNDS session is engineered to maximise calorie burn and lean muscle — the two things that actually change your body.',
      items: [
        { icon: 'heart', title: 'Heart-Rate Zones', desc: 'Live tracking keeps you in the optimal fat-burning zone, no guesswork.' },
        { icon: 'zap', title: 'Up To 500 Calories', desc: 'A typical 30-minute session torches serious energy — and the afterburn keeps going.' },
        { icon: 'dumbbell', title: 'Strength + Cardio', desc: 'Building lean muscle raises your resting metabolism so you burn more all day.' },
        { icon: 'users', title: 'Coach Accountability', desc: 'A coach who notices when you skip is the number one predictor of weight-loss success.' },
        { icon: 'timer', title: 'Only 30 Minutes', desc: 'Short enough to stay consistent — and consistency is what actually melts fat.' },
        { icon: 'trending', title: 'Measurable Progress', desc: 'Track your output and watch your fitness climb session after session.' },
      ],
    },
    {
      type: 'compare',
      eyebrow: 'The Difference',
      title: 'Why Most Weight-Loss Attempts Fail',
      failTitle: 'Going It Alone',
      winTitle: 'TENROUNDS Approach',
      fail: [
        'Hours on a treadmill that get boring fast and stall results',
        'No idea whether you are training hard enough to burn fat',
        'Crash diets and quick fixes that pile the weight back on',
        'No accountability, so motivation fades after a few weeks',
        'Long workouts that are impossible to keep up with real life',
      ],
      win: [
        'Heart-rate-guided sessions that guarantee you hit the right intensity',
        'Coaches who scale every move to your level and keep you safe',
        'Sustainable 30-minute training that fits your schedule for good',
        'A supportive community that keeps you showing up',
        'Strength work that reshapes your body, not just the scale',
      ],
    },
    {
      type: 'split',
      eyebrow: 'The Afterburn Effect',
      title: 'Keep Burning After You Leave',
      body: [
        'High-intensity interval training triggers excess post-exercise oxygen consumption — the afterburn effect — meaning your body keeps burning calories for hours after your session ends.',
        'Combine that with the lean muscle you build through our strength stations and you get a metabolism that works for you around the clock. That is how TENROUNDS members in Pretoria East lose weight and keep it off.',
      ],
      image: '/intensity-ball.webp',
      imageAlt: 'High-intensity fat-burning training at TENROUNDS Pretoria East',
      bullets: [
        'Afterburn keeps torching calories post-workout',
        'Lean muscle raises your daily metabolism',
        'Heart-rate data proves you are in the zone',
      ],
      dark: true,
    },
  ],
  faqs: [
    {
      question: 'How quickly will I lose weight at TENROUNDS?',
      answer:
        'Most members who train consistently three to four times a week and pair it with sensible eating start seeing changes within four to six weeks. Heart-rate tracking helps you train at the right intensity from day one so no session is wasted.',
    },
    {
      question: 'How many calories will I burn in a session?',
      answer:
        'A typical 30-minute TENROUNDS session burns up to 500 calories, and the high-intensity format means you keep burning through the afterburn effect for hours afterwards.',
    },
    {
      question: 'I am very unfit — can I still do this for weight loss?',
      answer:
        'Yes. Every workout is scaled to your level by a qualified coach, so you start at an intensity that is safe and effective for you, then progress as your fitness improves.',
    },
    {
      question: 'Do I need to follow a diet too?',
      answer:
        'Training drives results fastest when paired with good nutrition. Our coaches are happy to point you in the right direction, and the heart-rate data helps you understand exactly how hard you are working.',
    },
    {
      question: 'Where is your weight-loss gym located?',
      answer:
        'TENROUNDS is at 649 Borzoi Street, Garsfontein, Pretoria East — easy to reach from Moreleta Park, Faerie Glen, Woodhill, Olympus and Boardwalk.',
    },
  ],
  showMap: true,
  ctaHeadline: 'Start Losing Weight In Pretoria East',
  ctaSub:
    'Burn up to 500 calories in your first coach-supported session. Your free trial in Garsfontein is on us.',
}

export default function Page() {
  return <LandingTemplate config={config} />
}
