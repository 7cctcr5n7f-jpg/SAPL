export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      {children}
    </main>
  )
}
