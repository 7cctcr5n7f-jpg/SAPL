import { getCurrentUser } from "@/lib/session"
import { getUserNotifications } from "@/lib/queries-dashboard"
import { PageHeader } from "@/components/dashboard/page-header"
import { NotificationsList } from "@/components/dashboard/notifications-list"

export default async function NotificationsPage() {
  const me = await getCurrentUser()
  if (!me) return null
  const notes = await getUserNotifications(me.id, 50)

  return (
    <div>
      <PageHeader title="Notifications" subtitle="League updates, invitations, and match alerts." />
      <NotificationsList notes={notes} />
    </div>
  )
}
