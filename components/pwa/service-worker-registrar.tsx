"use client"

import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Registers the service worker and handles auto-updates.
 *
 * When a new version is deployed to Vercel, the browser fetches the updated
 * sw.js. The new worker installs, we detect it, tell it to skipWaiting, and
 * reload once it takes control — so installed PWAs always run the latest code.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    // Skip in dev to avoid caching the HMR runtime.
    if (process.env.NODE_ENV !== "production") return

    let refreshing = false

    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })

        // Periodically check for updates (e.g. long-lived PWA sessions).
        const interval = setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)

        const promptUpdate = (worker: ServiceWorker) => {
          toast("A new version of SAPL is available", {
            description: "Refresh to get the latest fixtures, standings and features.",
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "Update",
              onClick: () => worker.postMessage("SKIP_WAITING"),
            },
          })
        }

        // If a worker is already waiting, prompt immediately.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting)
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(newWorker)
            }
          })
        })

        return () => clearInterval(interval)
      } catch {
        // Registration failures are non-fatal — the site still works online.
      }
    }

    register()

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  return null
}
