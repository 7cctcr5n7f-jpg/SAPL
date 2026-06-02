'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { blockedDays, trialBookings } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { business } from '@/lib/business'
import {
  formatDateLong,
  parseDateString,
  slotToMinutes,
  todayDateString,
  validSlotsForDay,
} from '@/lib/trial-slots'

export type BookingState = { ok: boolean; error?: string }

const UPTIVO_LINK = 'https://uptivo.page.link/XX5n'

export async function submitTrialBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const appointmentDate = String(formData.get('appointmentDate') ?? '').trim()
  const appointmentTime = String(formData.get('appointmentTime') ?? '').trim()
  const agreementsAccepted = formData.get('agreementsAccepted') === 'true'

  // Server-side validation (don't trust the client).
  if (!fullName || !email || !phone || !appointmentDate || !appointmentTime) {
    return { ok: false, error: 'Please complete all fields.' }
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  if (!agreementsAccepted) {
    return { ok: false, error: 'All agreements must be accepted.' }
  }
  const date = parseDateString(appointmentDate)
  if (!date) {
    return { ok: false, error: 'Please select a valid date.' }
  }
  if (!validSlotsForDay(date.getDay()).includes(appointmentTime)) {
    return { ok: false, error: 'Please select a valid time slot for that day.' }
  }

  // Reject dates the studio has marked unavailable (public holidays / closed days).
  const blocked = await db
    .select({ id: blockedDays.id })
    .from(blockedDays)
    .where(eq(blockedDays.day, appointmentDate))
  if (blocked.length > 0) {
    return { ok: false, error: 'That day is unavailable. Please choose another date.' }
  }

  // Reject time slots that have already passed when booking for today.
  if (appointmentDate === todayDateString()) {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (slotToMinutes(appointmentTime) <= nowMinutes) {
      return { ok: false, error: 'That time has already passed. Please choose a later slot.' }
    }
  }

  try {
    await db.insert(trialBookings).values({
      fullName,
      email,
      phone,
      appointmentDate,
      appointmentTime,
      agreementsAccepted,
    })
  } catch (err) {
    console.error('[v0] Failed to save trial booking:', err)
    return { ok: false, error: 'Something went wrong saving your booking. Please try again.' }
  }

  const dateLong = formatDateLong(appointmentDate)

  // Email to the member (best-effort — booking already saved).
  await sendEmail({
    to: email,
    subject: 'Your trial at TENROUNDS has been booked!',
    replyTo: business.email,
    text: `Hi ${fullName},

We hereby confirm your booking at TENROUNDS on ${dateLong} at ${appointmentTime}.

Rock up in your active gear, a bottle of water and leave the rest to us!

Save time and click on the link below, download the TENROUNDS app, so that we can assign a heart rate monitor to your profile before arrival.
${UPTIVO_LINK}

Looking forward to seeing you!!!

Kind regards,
TENROUNDS Team`,
  })

  // Email to TENROUNDS.
  await sendEmail({
    to: business.email,
    subject: 'New Trial Booking',
    replyTo: email,
    text: `A new trial booking has been submitted.

Full Name: ${fullName}
Email: ${email}
Contact Number: ${phone}
Booking Date: ${dateLong}
Booking Time: ${appointmentTime}`,
  })

  revalidatePath('/admin')
  return { ok: true }
}
