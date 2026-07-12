"use client"

import { useCallback, useEffect, useState } from "react"

// Minimal type for the non-standard beforeinstallprompt event.
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
  prompt: () => Promise<void>
}

const DISMISS_KEY = "sapl-pwa-install-dismissed-at"
// Re-prompt non-installed users after this many days.
const REPROMPT_AFTER_DAYS = 7

type Platform = "android" | "ios" | "desktop" | "unknown"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)
  if (isIOS) return "ios"
  if (/android/i.test(ua)) return "android"
  return "desktop"
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (Number.isNaN(dismissedAt)) return false
    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
    return days < REPROMPT_AFTER_DAYS
  } catch {
    return false
  }
}

export function usePwaInstall() {
  const [platform] = useState<Platform>(() => detectPlatform())
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [canPrompt, setCanPrompt] = useState(() => !isStandalone() && !wasRecentlyDismissed())

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      try {
        localStorage.removeItem(DISMISS_KEY)
      } catch {}
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    const mql = window.matchMedia?.("(display-mode: standalone)")
    const onDisplayChange = () => setInstalled(isStandalone())
    mql?.addEventListener?.("change", onDisplayChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      mql?.removeEventListener?.("change", onDisplayChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice.outcome
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
    setCanPrompt(false)
  }, [])

  return {
    platform,
    installed,
    canPrompt,
    hasNativePrompt: !!deferredPrompt,
    promptInstall,
    dismiss,
  }
}
