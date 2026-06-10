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

    // Kill switch / self-heal: if the app fails to load a JS chunk, it almost
    // always means a stale cached HTML shell is pointing at /_next chunk hashes
    // that no longer exist after a redeploy (the "blank screen only for me"
    // bug). Purge every cache, unregister all workers, and reload exactly once
    // so the device recovers itself with zero manual DevTools steps.
    const HEAL_KEY = "sapl-sw-healed"
    const selfHeal = async () => {
      try {
        if (sessionStorage.getItem(HEAL_KEY)) return // already tried this session
        sessionStorage.setItem(HEAL_KEY, "1")
        if ("caches" in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      } catch {
        // ignore — fall through to reload regardless
      }
      window.location.reload()
    }
    const isChunkError = (msg?: string) =>
      !!msg && (/ChunkLoadError/i.test(msg) || /Loading chunk [\d]+ failed/i.test(msg) || /Importing a module script failed/i.test(msg))
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message) || isChunkError((e.error as Error)?.name)) selfHeal()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      if (isChunkError(typeof reason === "string" ? reason : reason?.message || reason?.name)) selfHeal()
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

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
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
