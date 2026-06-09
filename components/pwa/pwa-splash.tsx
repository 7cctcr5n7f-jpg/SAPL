"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

/**
 * App-style launch splash. Shown briefly only when the app is launched from the
 * home screen (standalone display mode) so the desktop/browser web experience
 * is never affected.
 */
export function PwaSplash() {
  const [show, setShow] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true

    // Only show once per launch, and only in standalone mode.
    if (!standalone) return
    if (sessionStorage.getItem("sapl-splash-shown")) return
    sessionStorage.setItem("sapl-splash-shown", "1")

    setShow(true)
    const fadeTimer = setTimeout(() => setFading(true), 1100)
    const hideTimer = setTimeout(() => setShow(false), 1600)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <Image
          src="/icons/icon-192.png"
          alt="SAPL"
          width={112}
          height={112}
          priority
          className="h-28 w-28 animate-pulse rounded-3xl"
        />
        <div className="flex flex-col items-center gap-1">
          <span className="heading text-2xl text-foreground">SAPL</span>
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">South African Padel League</span>
        </div>
      </div>
      <div className="absolute bottom-16 h-1 w-24 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/2 animate-[loader_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <style>{`@keyframes loader { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }`}</style>
    </div>
  )
}
