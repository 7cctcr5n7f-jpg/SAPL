import { redirect } from "next/navigation"

export default async function LegacyOrgRoute({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const { team } = await searchParams
  redirect(team ? `/dashboard/my-team?team=${encodeURIComponent(team)}` : "/dashboard/my-team")
}
