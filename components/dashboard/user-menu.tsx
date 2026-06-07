"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, UserCog } from "lucide-react"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string
  email: string
  role: string
}) {
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open profile menu"
      >
        {initials(name) || <User className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          <span className="mt-1 inline-block w-fit rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {role.replace("_", " ")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
          <UserCog className="h-4 w-4" />
          Update profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
