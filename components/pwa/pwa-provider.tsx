"use client"

import { ServiceWorkerRegistrar } from "./service-worker-registrar"
import { InstallPrompt } from "./install-prompt"
import { PwaSplash } from "./pwa-splash"

/**
 * Bundles all client-side PWA behaviour: service worker registration + auto
 * update, the install prompt (Android one-tap + iOS instructions), and the
 * standalone launch splash. Rendered once in the root layout.
 */
export function PwaProvider() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <PwaSplash />
      <InstallPrompt />
    </>
  )
}
