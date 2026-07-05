import { redirect } from "next/navigation"

// Player management has been merged into the unified Members & Roles page, which
// now edits LI, Playtomic rating, gender and location alongside personal details
// and permissions. This route is kept as a permanent redirect so old links and
// bookmarks continue to work.
export default function AdminPlayersPage() {
  redirect("/admin/members")
}
