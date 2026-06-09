// Shared, dependency-free notification constants.
// Kept separate from lib/notify.ts (which imports the server-only DB client)
// so client components can use these without pulling `pg` into the browser bundle.

// Marker used to embed an action link inside the stored notification body. The
// list UI splits on this to render an action button without a schema migration.
export const NOTE_LINK_SEP = "\u0001link\u0001"

/** Split a stored body into its display text and any packed action href. */
export function parseNotificationBody(body: string): { text: string; href: string | null } {
  const idx = body.indexOf(NOTE_LINK_SEP)
  if (idx === -1) return { text: body, href: null }
  return { text: body.slice(0, idx), href: body.slice(idx + NOTE_LINK_SEP.length) || null }
}
