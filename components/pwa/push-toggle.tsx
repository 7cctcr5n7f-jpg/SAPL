"use client"

import { useEffect, useState, useCallback } from "react"
import { Bell, BellOff, BellRing } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

type Status = "loading" | "unsupported" | "disabled" | "default" | "denied" | "subscribed"

export function PushToggle() {
  const [status, setStatus] = useState<Status>("loading")
  const [busy, setBusy] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported")
      return
    }
    try {
      const res = await fetch("/api/push/subscribe")
      const data = await res.json()
      if (!data.enabled || !data.publicKey) {
        setStatus("disabled")
        return
      }
      setPublicKey(data.publicKey)
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setStatus("subscribed")
      } else {
        setStatus(Notification.permission === "denied" ? "denied" : "default")
      }
    } catch {
      setStatus("disabled")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const subscribe = async () => {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new Error("subscribe failed")
      setStatus("subscribed")
      toast.success("Push notifications enabled")
    } catch {
      toast.error("Couldn't enable notifications. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus("default")
      toast("Push notifications turned off")
    } catch {
      toast.error("Couldn't turn off notifications.")
    } finally {
      setBusy(false)
    }
  }

  // Hide entirely on platforms/configs where push can't work.
  if (status === "loading" || status === "unsupported" || status === "disabled") return null

  const subscribed = status === "subscribed"

  return (
    <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {subscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-card-foreground">Push notifications</h3>
          <p className="text-sm text-muted-foreground text-pretty">
            {status === "denied"
              ? "Notifications are blocked in your browser settings. Enable them there to receive match and ranking alerts."
              : subscribed
                ? "You'll get fixture reminders, match alerts and ranking updates on this device."
                : "Get fixture reminders, match alerts and ranking updates — even when SAPL is closed."}
          </p>
        </div>
      </div>
      {status !== "denied" ? (
        subscribed ? (
          <Button variant="outline" onClick={unsubscribe} disabled={busy} className="gap-2 sm:shrink-0 bg-transparent">
            <BellOff className="h-4 w-4" />
            Turn off
          </Button>
        ) : (
          <Button onClick={subscribe} disabled={busy} className="gap-2 sm:shrink-0">
            <Bell className="h-4 w-4" />
            Enable
          </Button>
        )
      ) : null}
    </Card>
  )
}
