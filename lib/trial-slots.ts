// Available 30-minute trial slots by day of week.
// 0 = Sunday … 6 = Saturday. Sunday has no slots.

const WEEKDAY_MORNING = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
  '08:00', '08:30', '09:00', '09:30',
]
const WEEKDAY_AFTERNOON = [
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
]
const SATURDAY = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30']

export type SlotGroup = { label: string; slots: string[] }

// Returns grouped slots for a given JS day index (Date.getDay()).
export function slotGroupsForDay(day: number): SlotGroup[] {
  if (day >= 1 && day <= 5) {
    return [
      { label: 'Morning', slots: WEEKDAY_MORNING },
      { label: 'Afternoon / Evening', slots: WEEKDAY_AFTERNOON },
    ]
  }
  if (day === 6) {
    return [{ label: 'Morning', slots: SATURDAY }]
  }
  return []
}

// Flat list of valid slots for a day — used for server-side validation.
export function validSlotsForDay(day: number): string[] {
  return slotGroupsForDay(day).flatMap((g) => g.slots)
}

// Convert an "HH:mm" slot into minutes since midnight.
export function slotToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!m) return -1
  return Number(m[1]) * 60 + Number(m[2])
}

// Local 'YYYY-MM-DD' for today.
export function todayDateString(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Parse a 'YYYY-MM-DD' string into a Date at local midnight (avoids TZ drift).
export function parseDateString(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

// Format 'YYYY-MM-DD' into a friendly display like "Monday, 3 June 2026".
export function formatDateLong(dateStr: string): string {
  const d = parseDateString(dateStr)
  if (!d) return dateStr
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
