import { redirect } from "next/navigation"
import { requirePermissionPage } from "@/lib/access"

export default async function AdminPage() {
  await requirePermissionPage("league_management")
  redirect("/admin/seasons")
}


