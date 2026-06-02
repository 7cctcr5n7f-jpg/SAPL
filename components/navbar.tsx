'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/logo'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/memberships', label: 'Pricing' },
  { href: '/members', label: 'Members' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/corporate-wellness', label: 'Corporate' },
  { href: '/contact', label: 'Contact' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-steel bg-background py-3 shadow-2xl' : 'bg-transparent py-5',
        open && 'bg-background py-3',
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="TENROUNDS home" className="shrink-0">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'text-sm font-medium uppercase tracking-wide transition-colors',
                    active
                      ? 'text-neon-blue'
                      : 'text-light-grey hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="hidden lg:block">
          <Link
            href="/free-trial"
            className="rounded-md bg-cobalt px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent-foreground transition-all hover:bg-neon-blue hover:blue-glow"
          >
            Free Trial
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-foreground lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="size-7" /> : <Menu className="size-7" />}
        </button>
      </nav>

      {open && (
        <div className="mt-3 border-t border-steel bg-background shadow-2xl lg:hidden">
          <ul className="flex flex-col gap-1 px-5 py-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-md px-3 py-3 text-base font-medium uppercase tracking-wide',
                    pathname === item.href
                      ? 'bg-secondary text-neon-blue'
                      : 'text-light-grey hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/free-trial"
                className="block rounded-md bg-cobalt px-3 py-3 text-center text-base font-semibold uppercase tracking-wide text-accent-foreground"
              >
                Claim Free Trial
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
