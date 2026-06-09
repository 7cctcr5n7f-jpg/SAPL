"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Download, Share, Plus, X, Zap, Maximize, Bell, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { usePwaInstall } from "./use-pwa-install"

const BENEFITS = [
  { icon: Zap, label: "Faster access" },
  { icon: Maximize, label: "Full-screen experience" },
  { icon: Bell, label: "Match & ranking alerts" },
  { icon: Trophy, label: "Fixtures, standings & rankings" },
]

export function InstallPrompt() {
  const { platform, installed, canPrompt, hasNativePrompt, promptInstall, dismiss } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  // Surface the banner only after a short engagement delay.
  useEffect(() => {
    if (installed || !canPrompt) return
    // Only show when we can actually install: Android with native prompt, or iOS instructions.
    const installable = (platform === "android" || platform === "desktop") ? hasNativePrompt : platform === "ios"
    if (!installable) return
    const t = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(t)
  }, [installed, canPrompt, platform, hasNativePrompt])

  if (installed || !visible) return null

  const handleInstall = async () => {
    if (platform === "ios") {
      setIosOpen(true)
      return
    }
    const outcome = await promptInstall()
    if (outcome === "accepted" || outcome === "dismissed") {
      setVisible(false)
    }
  }

  const handleClose = () => {
    setVisible(false)
    dismiss()
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:bottom-4 lg:left-auto lg:right-4 lg:w-96 lg:px-0">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <button
            onClick={handleClose}
            aria-label="Dismiss install prompt"
            className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 p-4">
            <Image
              src="/icons/icon-192.png"
              alt="SAPL"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-xl"
            />
            <div className="min-w-0 pr-6">
              <h3 className="heading text-lg leading-tight text-card-foreground">Install SAPL App</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground text-pretty">
                Get the full South African Padel League experience on your home screen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-4">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-4">
            <Button variant="ghost" onClick={handleClose} className="flex-1">
              Not now
            </Button>
            <Button onClick={handleInstall} className="flex-1 gap-2">
              {platform === "ios" ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {platform === "ios" ? "How to install" : "Install"}
            </Button>
          </div>
        </div>
      </div>

      {/* iOS install instructions */}
      <Sheet open={iosOpen} onOpenChange={setIosOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="text-left">
            <SheetTitle className="heading flex items-center gap-2 text-xl">
              <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
              Install SAPL on iPhone
            </SheetTitle>
            <SheetDescription>Add SAPL to your home screen for a full-screen, app-like experience.</SheetDescription>
          </SheetHeader>

          <ol className="mt-4 flex flex-col gap-3 px-4 pb-6">
            <IosStep
              n={1}
              icon={<Share className="h-5 w-5 text-primary" />}
              title="Tap the Share button"
              desc="In the Safari toolbar at the bottom of the screen."
            />
            <IosStep
              n={2}
              icon={<Plus className="h-5 w-5 text-primary" />}
              title="Select Add to Home Screen"
              desc="Scroll down the share menu if you don't see it right away."
            />
            <IosStep
              n={3}
              icon={<Download className="h-5 w-5 text-primary" />}
              title="Tap Add"
              desc="SAPL will appear on your home screen like a native app."
            />
          </ol>
        </SheetContent>
      </Sheet>
    </>
  )
}

function IosStep({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{desc}</p>
      </div>
    </li>
  )
}
