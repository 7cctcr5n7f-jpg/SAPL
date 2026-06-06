import { redirect } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"
import { getCurrentUser } from "@/lib/session"
import { getClubOptions } from "@/lib/queries"

export const metadata = { title: "Create Your Profile | SAPL" }

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  if (user.playerId) redirect("/dashboard")

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
        <div className="mt-8">
          <OnboardingForm defaultName={user.name} clubs={clubs} />
        </div>
      </main>
    </div>
  )
}
