import { redirect } from "next/navigation"

/**
 * /admin/seasons is the canonical URL for the Season Setup tab.
 * The actual UI lives in /admin with ?tab=seasons, so we redirect there.
 * The sidebar links here so the "Seasons" item gets a clean pathname-based
 * active highlight (no query-string comparison needed).
 */
export default function SeasonsPage() {
  redirect("/admin?tab=seasons")
}
