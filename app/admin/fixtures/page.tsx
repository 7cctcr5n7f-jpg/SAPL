import { redirect } from "next/navigation"

// Fixture management now lives in the unified, role-aware dashboard view.
export default function AdminFixturesPage() {
  redirect("/dashboard/fixtures")
}
