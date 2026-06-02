import {
  PersonStanding,
  Smartphone,
  DoorOpen,
  Handshake,
  ListChecks,
  HeartPulse,
  Play,
  Megaphone,
  Trophy,
  MessageSquare,
} from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'
import { Reveal } from '@/components/reveal'

const steps = [
  {
    icon: PersonStanding,
    title: 'Arrive Ready To Train',
    desc: "Arrive at TENROUNDS in your active gear with a bottle of water and we'll take care of the rest. No need to know boxing. No need to be fit already.",
  },
  {
    icon: Smartphone,
    title: 'Download The TENROUNDS App',
    desc: "If you haven't already downloaded the TENROUNDS app, we'll help you get set up. This allows us to assign a heart rate monitor to your profile before training starts.",
  },
  {
    icon: DoorOpen,
    title: 'Locker & Facility Tour',
    desc: "We'll show you where to safely store your belongings and give you a quick tour of the facility.",
  },
  {
    icon: Handshake,
    title: 'Meet Your Coach',
    desc: 'One of our coaches will personally welcome you and explain exactly how TENROUNDS works.',
  },
  {
    icon: ListChecks,
    title: 'Discover The 10 Rounds',
    desc: "We'll walk you through all 10 rounds and demonstrate each station before your workout begins.",
  },
  {
    icon: HeartPulse,
    title: 'Heart Rate Monitor Assigned',
    desc: "We'll assign a heart rate monitor to your profile so your workout can be tracked in real time.",
  },
  {
    icon: Play,
    title: 'Start Round 1',
    desc: 'The fun begins. Experience the full TENROUNDS workout exactly like our members do.',
  },
  {
    icon: Megaphone,
    title: 'Coached Every Step Of The Way',
    desc: 'Our coaches will guide, motivate and support you throughout your workout.',
  },
  {
    icon: Trophy,
    title: 'Finish Strong',
    desc: 'Complete all 10 rounds and discover why so many members fall in love with TENROUNDS after their first session.',
  },
  {
    icon: MessageSquare,
    title: 'No Pressure Decision',
    desc: 'Ask questions. Meet the team. Learn more about membership options. No pressure. No obligation. No hard selling.',
  },
]

export function TrialExperience() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Step By Step"
          title="Your First TENROUNDS Experience"
          subtitle="From the moment you arrive, we'll guide you every step of the way. No awkward gym moments. No confusion. No experience needed."
          className="mx-auto"
        />

        <ol className="relative mt-12 sm:mt-16">
          {/* vertical line */}
          <span
            aria-hidden="true"
            className="absolute left-6 top-2 hidden h-[calc(100%-1rem)] w-px bg-steel sm:block"
          />
          <div className="flex flex-col gap-5 sm:gap-8">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 50}>
                <li className="group relative flex gap-4 sm:gap-6">
                  <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-steel bg-card text-neon-blue transition-colors group-hover:border-neon-blue group-hover:bg-cobalt/15">
                    <s.icon className="size-5" />
                  </span>
                  <div className="glass flex-1 rounded-2xl border border-steel p-5 transition-colors group-hover:border-neon-blue/50 sm:p-6">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-black text-neon-blue">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-display text-base font-bold uppercase leading-tight tracking-tight sm:text-lg">
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-light-grey">{s.desc}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </div>
        </ol>
      </div>
    </section>
  )
}
