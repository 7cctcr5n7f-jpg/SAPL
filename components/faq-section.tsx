'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { SectionHeading } from '@/components/section-heading'

export type Faq = { question: string; answer: string }

export function FaqSection({
  faqs,
  eyebrow = 'FAQ',
  title = 'Questions, Answered',
  subtitle,
}: {
  faqs: Faq[]
  eyebrow?: string
  title?: string
  subtitle?: string
}) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className="mt-10 divide-y divide-steel/60 border-y border-steel/60">
          {faqs.map((faq, i) => {
            const isOpen = open === i
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">
                    {faq.question}
                  </span>
                  {isOpen ? (
                    <Minus className="size-5 shrink-0 text-neon-blue" />
                  ) : (
                    <Plus className="size-5 shrink-0 text-neon-blue" />
                  )}
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    isOpen ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <p className="overflow-hidden leading-relaxed text-light-grey">{faq.answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
