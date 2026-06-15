"use client"

import { useActionState } from "react"
import { changeOwnPassword } from "@/lib/actions/player"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AlertCircle, CheckCircle } from "lucide-react"

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, null)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          placeholder="Enter your current password"
          required
          disabled={pending}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          placeholder="Enter new password (min 8 characters)"
          required
          disabled={pending}
          minLength={8}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Re-enter new password"
          required
          disabled={pending}
          className="mt-1"
        />
      </div>

      {state?.error && (
        <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="flex gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <p>{state.success}</p>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Update Password"}
      </Button>
    </form>
  )
}
