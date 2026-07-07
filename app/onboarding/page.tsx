import { redirect } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { getCurrentUser } from "@/lib/session"
import { getClubOptions } from "@/lib/queries"

export const metadata = { title: "Create Your Profile | SAPL" }

interface Props {
  searchParams: Promise<{ inviteToken?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  if (user.isPlayer) {
    // If they already have a profile but came via an invite link, process it now
    const { inviteToken } = await searchParams
    if (inviteToken) redirect(`/invite/${inviteToken}`)
    redirect("/dashboard")
  }

  const { inviteToken } = await searchParams
  const clubs = await getClubOptions()

  return (
    <div className="min-h-svh">
      <header className="border-b border-border p-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step 1 of 1</span>
        <h1 className="heading mt-2 text-4xl">Create Your Player Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Set up your competitive profile. Your League Index keeps category line-ups fair and prevents sandbagging.
        </p>
        {inviteToken && (
          <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary font-medium">
            Complete your profile to automatically join your team.
          </p>
        )}
        <div className="mt-8">
          <OnboardingForm defaultName={user.name} clubs={clubs} inviteToken={inviteToken} />
        </div>
      </main>
    </div>
  )
}
