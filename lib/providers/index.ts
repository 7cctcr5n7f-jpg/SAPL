/**
 * External provider interfaces.
 *
 * These are architected as swappable interfaces so the real PayFast / Peach /
 * Stripe / Netcash, WhatsApp Business, and Playtomic APIs can be activated
 * later WITHOUT redesigning the platform. The current implementations record
 * intent to the database (invoices, queued notifications, manual ratings) and
 * are production-safe.
 */

// ---------- Payments ----------
export type PaymentProviderId = "payfast" | "peach" | "stripe" | "netcash"

export interface CreateChargeInput {
  amount: number
  currency: string
  reference: string
  description: string
  returnUrl?: string
}

export interface CreateChargeResult {
  redirectUrl: string | null
  providerReference: string
  status: "pending" | "paid" | "failed"
}

export interface PaymentProvider {
  id: PaymentProviderId
  label: string
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
}

class ManualPaymentProvider implements PaymentProvider {
  constructor(
    public id: PaymentProviderId,
    public label: string,
  ) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    // Until live credentials are supplied, we record a pending charge and
    // return no redirect. The admin can mark it paid, or a webhook can later.
    return {
      redirectUrl: null,
      providerReference: `${this.id.toUpperCase()}-${input.reference}`,
      status: "pending",
    }
  }
}

export const paymentProviders: Record<PaymentProviderId, PaymentProvider> = {
  payfast: new ManualPaymentProvider("payfast", "PayFast"),
  peach: new ManualPaymentProvider("peach", "Peach Payments"),
  stripe: new ManualPaymentProvider("stripe", "Stripe"),
  netcash: new ManualPaymentProvider("netcash", "Netcash DebiCheck"),
}

// ---------- Notifications / WhatsApp ----------
export type NotificationChannel = "in_app" | "whatsapp" | "email"

export interface SendNotificationInput {
  channel: NotificationChannel
  to?: string
  title: string
  body: string
}

export interface NotificationProvider {
  send(input: SendNotificationInput): Promise<{ status: "sent" | "queued"; externalId?: string }>
}

class LoggingNotificationProvider implements NotificationProvider {
  async send(input: SendNotificationInput) {
    // WhatsApp Business API not yet activated: queue + log.
    // Swap this body for a real Graph API call when credentials exist.
    console.log("[v0] notification dispatch:", input.channel, input.title)
    return { status: "queued" as const }
  }
}

export const notificationProvider: NotificationProvider = new LoggingNotificationProvider()

// ---------- Playtomic ----------
export interface PlaytomicProfile {
  playtomicUserId: string
  profileUrl: string
  currentRating: number | null
  highestRating: number | null
}

export interface PlaytomicProvider {
  /** Future: fetch profile + ratings from Playtomic API. */
  fetchProfile(userIdOrUrl: string): Promise<PlaytomicProfile | null>
  /** Future: import matches/scores for automatic TPR updates. */
  importMatches(playtomicUserId: string): Promise<unknown[]>
}

class ManualPlaytomicProvider implements PlaytomicProvider {
  async fetchProfile(): Promise<PlaytomicProfile | null> {
    // API not activated — ratings are entered manually for now.
    return null
  }
  async importMatches(): Promise<unknown[]> {
    return []
  }
}

export const playtomicProvider: PlaytomicProvider = new ManualPlaytomicProvider()
