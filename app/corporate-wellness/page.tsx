import type { Metadata } from 'next'
import { SignupFormButton } from '@/components/forms/signup-form-button'
import {
  Stethoscope,
  TrendingUp,
  Brain,
  Smile,
  Users,
  Zap,
  Clock,
  Flame,
  DoorOpen,
  HeartPulse,
  UserCheck,
  BarChart3,
  Check,
  ArrowRight,
  Trophy,
  Megaphone,
  ClipboardCheck,
  BadgeCheck,
  Dumbbell,
  LineChart,
  Award,
} from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { SectionHeading } from '@/components/section-heading'
import { ContactForm } from '@/components/forms/contact-form'
import { Reveal } from '@/components/reveal'

export const metadata: Metadata = {
  title: 'Corporate Wellness',
  description:
    'The Power of HIIT at Work. Boost productivity, focus and retention with the TENROUNDS corporate wellness challenge. Exclusive employee pricing from R850/month in Pretoria East.',
  alternates: { canonical: '/corporate-wellness' },
}

const researchStats = [
  { icon: Stethoscope, value: '4.1', label: 'Fewer sick days per year', source: 'Johns Hopkins University' },
  { icon: TrendingUp, value: '1.5x', label: 'More effective at work', source: 'Gallup / Business Insider' },
  { icon: Brain, value: '24%', label: 'Better focus & concentration', source: 'Harvard Health Publishing' },
  { icon: Smile, value: '26%', label: 'Reduction in stress levels', source: 'Mental Health Foundation' },
  { icon: Users, value: '21%', label: 'Higher employee engagement', source: 'Gallup' },
  { icon: Zap, value: '10%', label: 'Increase in productivity', source: 'CIPHR' },
]

const whyTenrounds = [
  { icon: Clock, text: '30-minute HIIT sessions' },
  { icon: DoorOpen, text: 'Walk-in system — no class schedules' },
  { icon: HeartPulse, text: 'Train before work, during lunch or after work' },
  { icon: UserCheck, text: 'Personal trainers guide members through every round' },
  { icon: Flame, text: 'Average 500 calories burned per session' },
  { icon: BarChart3, text: 'Progress tracking and challenge leaderboards' },
]

const challengeSteps = [
  { icon: Megaphone, title: 'Share Internally', desc: 'Company shares the initiative with employees.' },
  { icon: ClipboardCheck, title: 'Register', desc: 'Employees complete their online registration.' },
  { icon: BadgeCheck, title: 'Activate', desc: 'Memberships are activated and ready to go.' },
  { icon: Dumbbell, title: 'Start Training', desc: 'Employees begin training across all 10 rounds.' },
  { icon: LineChart, title: 'Track Progress', desc: 'Progress is shared with your company weekly.' },
  { icon: Award, title: 'Win', desc: 'Winners announced end of September 2026.' },
]

const challengeRules = [
  'Challenge duration: 3 months (customisable)',
  'Minimum participants: 5 employees',
  'Companies are automatically entered into both an internal and a Pretoria East Corporate wellness challenge to compete against other companies.',
  'Active membership required',
  'Rankings based on calories burned, attendance consistency and participation',
]

const PROMO_CODE = '10Corp'

export default function CorporateWellnessPage() {
  return (
    <main>
      <PageHero
        eyebrow="Corporate Wellness"
        title="The Power Of HIIT At Work."
        description="Science shows regular exercise — especially HIIT — transforms employee health, wellbeing and performance. Build a stronger, sharper, more engaged team."
        image="/corporate-team.png"
        imageAlt="Corporate team training together at TENROUNDS"
      />

      {/* research-backed stats */}
      <section className="relative overflow-hidden bg-background py-24 lg:py-32">
        <div className="pointer-events-none absolute left-1/2 top-0 size-[600px] -translate-x-1/2 rounded-full bg-cobalt/10 blur-[150px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="6 Benefits Backed By Research"
            title="Stronger Employees. Stronger Teams. Stronger Company."
            description="Investing in employee fitness isn't just good for health — it's good for business."
            className="mx-auto"
          />

          <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-5 lg:grid-cols-3">
            {researchStats.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-steel bg-card p-4 transition-all duration-300 hover:-translate-y-2 hover:border-neon-blue/60 hover:blue-glow sm:p-7">
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-neon-blue transition-transform duration-300 group-hover:scale-x-100" />
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt/15 text-neon-blue transition-all duration-300 group-hover:scale-110 group-hover:bg-cobalt group-hover:text-accent-foreground sm:size-14">
                      <s.icon className="size-5 sm:size-7" />
                    </span>
                    <span className="font-display text-3xl font-black tracking-tight text-neon-blue text-glow sm:text-5xl">
                      {s.value}
                    </span>
                  </div>
                  <p className="mt-3 font-display text-sm font-bold uppercase leading-tight tracking-tight text-foreground sm:mt-5 sm:text-base">
                    {s.label}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-light-grey sm:mt-2 sm:text-xs">
                    {s.source}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* highlight strip */}
          <Reveal delay={120}>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-5">
              <div className="flex items-center gap-4 rounded-2xl border border-neon-blue/40 bg-cobalt/10 p-4 sm:gap-5 sm:p-7">
                <Clock className="size-10 shrink-0 text-neon-blue sm:size-12" />
                <div>
                  <p className="font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
                    30 <span className="text-neon-blue">Minutes</span>
                  </p>
                  <p className="mt-1 text-sm text-light-grey">
                    Maximum impact in minimum time. Real results, no wasted hours.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-neon-blue/40 bg-cobalt/10 p-4 sm:gap-5 sm:p-7">
                <Flame className="size-10 shrink-0 text-neon-blue sm:size-12" />
                <div>
                  <p className="font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
                    500 <span className="text-neon-blue">Calories</span>
                  </p>
                  <p className="mt-1 text-sm text-light-grey">
                    Burned per session on average across all ten rounds.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* exclusive offer / pricing */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Exclusive Corporate Employee Offer"
            title="Premium Training At A Corporate Rate"
            className="mx-auto"
          />

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 items-stretch gap-3 sm:mt-16 sm:gap-6 lg:grid-cols-[1fr_1fr_0.9fr]">
            {/* corporate package */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-neon-blue bg-background p-5 blue-glow sm:p-8">
              <span className="inline-flex rounded-full bg-neon-blue px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-background">
                Corporate Rate
              </span>
              <p className="mt-4 font-display text-xs font-bold uppercase tracking-widest text-neon-blue sm:mt-5 sm:text-sm">
                Corporate Premium
              </p>
              <p className="mt-2 flex items-end gap-1.5 sm:gap-2">
                <span className="font-display text-3xl font-black tracking-tight text-foreground text-glow sm:text-5xl">
                  R850
                </span>
                <span className="pb-1 text-xs text-light-grey sm:pb-1.5 sm:text-sm">/ mo</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-light-grey sm:text-sm">
                Full TENROUNDS access at the exclusive corporate employee rate.
              </p>
            </div>

            {/* standard package */}
            <div className="rounded-2xl border border-steel bg-background p-5 sm:p-8">
              <span className="inline-flex rounded-full border border-steel px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-light-grey">
                Standard Rate
              </span>
              <p className="mt-4 font-display text-xs font-bold uppercase tracking-widest text-light-grey sm:mt-5 sm:text-sm">
                Standard Package
              </p>
              <p className="mt-2 flex items-end gap-1.5 sm:gap-2">
                <span className="font-display text-3xl font-black tracking-tight text-mid-grey line-through decoration-destructive/70 sm:text-5xl">
                  R1,750
                </span>
                <span className="pb-1 text-xs text-light-grey sm:pb-1.5 sm:text-sm">/ mo</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-light-grey sm:text-sm">
                The usual public membership price for the same access.
              </p>
            </div>

            {/* savings */}
            <div className="green-glow col-span-2 flex flex-col items-center justify-center rounded-2xl border-2 border-neon-green/70 bg-neon-green/10 p-5 text-center sm:p-8 lg:col-span-1">
              <p className="font-display text-xs font-bold uppercase tracking-widest text-neon-green">
                You Save
              </p>
              <p className="mt-2 font-display text-4xl font-black tracking-tight text-neon-green sm:text-5xl">
                R900
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                per employee, every month
              </p>
            </div>
          </div>

          {/* why tenrounds */}
          <div className="mx-auto mt-16 max-w-4xl">
            <h3 className="text-center font-display text-2xl font-bold uppercase tracking-tight text-foreground">
              Why <span className="text-neon-blue">TENROUNDS</span>
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
              {whyTenrounds.map((w, i) => (
                <Reveal key={w.text} delay={i * 70}>
                  <div className="flex h-full flex-col gap-2 rounded-xl border border-steel bg-background p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cobalt/15 text-neon-blue sm:size-11">
                      <w.icon className="size-4 sm:size-5" />
                    </span>
                    <p className="text-xs font-medium leading-relaxed text-light-grey sm:text-sm">{w.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* how the challenge works */}
      <section className="bg-background py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="How The Challenge Works"
            title="From Sign-Up To Showdown"
            className="mx-auto"
          />
          {/* roadmap timeline — vertical rail with numbered icon nodes */}
          <div className="relative mx-auto mt-12 max-w-3xl sm:mt-16">
            {/* connecting rail */}
            <span
              aria-hidden
              className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-neon-blue via-neon-blue/40 to-transparent sm:left-8"
            />
            <ol className="space-y-5 sm:space-y-7">
              {challengeSteps.map((s, i) => (
                <Reveal key={s.title} delay={i * 80}>
                  <li className="group relative flex items-start gap-4 sm:gap-6">
                    {/* node */}
                    <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-neon-blue bg-background blue-glow sm:size-16">
                      <s.icon className="size-5 text-neon-blue sm:size-7" />
                      <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-cobalt font-display text-xs font-black text-accent-foreground">
                        {i + 1}
                      </span>
                    </span>
                    {/* content */}
                    <div className="flex-1 rounded-2xl border border-steel bg-card p-4 transition-colors group-hover:border-neon-blue/50 sm:p-6">
                      <h3 className="font-display text-base font-bold uppercase leading-tight tracking-tight text-foreground sm:text-lg">
                        {s.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-light-grey">{s.desc}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* rules + prize */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[1.3fr_1fr] lg:px-8">
          {/* rules */}
          <div className="rounded-2xl border border-steel bg-background p-8 lg:p-10">
            <SectionHeading eyebrow="Challenge Rules" title="Keeping It Fair" />
            <ul className="mt-8 space-y-4">
              {challengeRules.map((rule) => (
                <li key={rule} className="flex items-start gap-3 text-sm leading-relaxed text-light-grey">
                  <Check className="mt-0.5 size-4 shrink-0 text-neon-blue" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* sponsored prize */}
          <div className="green-glow flex flex-col justify-center rounded-2xl border-2 border-neon-green/70 bg-neon-green/10 p-8 lg:p-10">
            <span className="flex size-14 items-center justify-center rounded-xl bg-neon-green/20 text-neon-green">
              <Trophy className="size-7" />
            </span>
            <p className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-neon-green">
              Sponsored Prize
            </p>
            <p className="mt-3 font-display text-2xl font-black uppercase leading-tight tracking-tight text-foreground">
              6-Month TENROUNDS Membership
            </p>
            <p className="mt-3 text-sm leading-relaxed text-light-grey">
              If 10+ employees participate, the winner takes home a 6-month membership —
              approximately{' '}
              <span className="font-semibold text-neon-green">R10,000 in value</span>.
            </p>
          </div>
        </div>
      </section>

      {/* how to register */}
      <section className="bg-background py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="How To Register"
            title="Employees Sign Up In Minutes"
            description="Employees can register directly online. During signup, enter the corporate promo code below to unlock the exclusive rate."
            className="mx-auto"
          />

          <div className="mt-12 rounded-2xl border border-neon-blue/40 bg-cobalt/10 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-light-grey">
              Promo Code
            </p>
            <p className="mt-2 font-display text-4xl font-black uppercase tracking-[0.15em] text-neon-blue text-glow">
              {PROMO_CODE}
            </p>
            <SignupFormButton className="group mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-cobalt px-8 py-4 font-display text-sm font-bold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow">
              Register Online
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </SignupFormButton>
          </div>
        </div>
      </section>

      {/* contact form */}
      <section className="bg-charcoal py-24 lg:py-32">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-5 lg:grid-cols-2 lg:px-8">
          <div>
            <SectionHeading
              eyebrow="Partner With Us"
              title="Bring The Challenge To Your Company"
              description="Tell us about your organisation and we will set up your corporate wellness challenge — tailored to your team's size, goals and budget."
            />
            <ul className="mt-8 space-y-4">
              {[
                'Custom programs for any team size',
                'Flexible scheduling around the work day',
                'Dedicated account and coaching support',
                'Weekly participation and progress reporting',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-light-grey">
                  <Check className="mt-0.5 size-4 shrink-0 text-neon-blue" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-light-grey">
              Prefer your team to register themselves?{' '}
              <SignupFormButton className="font-semibold text-neon-blue underline-offset-4 hover:underline">
                Sign up online with code {PROMO_CODE}
              </SignupFormButton>
              .
            </p>
          </div>
          <div className="lg:sticky lg:top-28">
            <ContactForm
              heading="Partner With TENROUNDS"
              subheading="Request a corporate wellness proposal."
              withCompany
              buttonLabel="Request Proposal"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
