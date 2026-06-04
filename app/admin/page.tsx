import type { Metadata } from 'next'
import { asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { blockedDays, chowWinners, sessionMilestones, specials, trialBookings } from '@/lib/db/schema'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getSetting, getMembershipSignups, getSessionPurchases } from '@/lib/content-queries'
import { AdminLogin } from '@/components/admin/admin-login'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await isAdminAuthed())) {
    return <AdminLogin />
  }

  const [allSpecials, allWinners, allMilestones, allBookings, allBlocked, allSignups, allPurchases, chowChallenge] = await Promise.all([
    db.select().from(specials).orderBy(asc(specials.sortOrder), asc(specials.id)),
    db.select().from(chowWinners).orderBy(asc(chowWinners.sortOrder), asc(chowWinners.id)),
    db.select().from(sessionMilestones).orderBy(desc(sessionMilestones.createdAt)),
    db.select().from(trialBookings).orderBy(desc(trialBookings.createdAt)),
    db.select().from(blockedDays).orderBy(asc(blockedDays.day)),
    getMembershipSignups(),
    getSessionPurchases(),
    getSetting('chow_challenge'),
  ])

  return (
    <AdminDashboard
      specials={allSpecials}
      winners={allWinners}
      milestones={allMilestones}
      bookings={allBookings}
      blockedDays={allBlocked}
      signups={allSignups}
      purchases={allPurchases}
      chowChallenge={chowChallenge}
    />
  )
}
