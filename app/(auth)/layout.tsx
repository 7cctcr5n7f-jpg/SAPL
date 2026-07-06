import Link from "next/link"
import Image from "next/image"
import { Logo } from "@/components/brand/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image src="/feature-court.png" alt="Padel court at night" fill className="object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-12">
          <h2 className="heading text-4xl text-balance">
            EARN YOUR PLACE ON THE <span className="text-primary">FEATURE COURT</span>
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Join South Africa&apos;s most competitive padel league and climb from Challenge to Premier.
          </p>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex items-center justify-between p-6">
          <Logo />
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            Back to site
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center p-6 py-8 lg:items-center">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  )
}
