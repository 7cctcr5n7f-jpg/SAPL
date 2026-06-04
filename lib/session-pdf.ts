import 'server-only'

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { business, fullAddress } from '@/lib/business'
import { formatRand } from '@/lib/memberships'
import { AGREEMENT_SECTIONS } from '@/lib/membership-agreement'
import type { SessionPurchase } from '@/lib/db/schema'

// Brand palette (RGB 0-1).
const COBALT = rgb(0.063, 0.282, 0.78)
const INK = rgb(0.1, 0.12, 0.16)
const MUTED = rgb(0.42, 0.46, 0.52)
const LINE = rgb(0.82, 0.85, 0.89)
const GREEN = rgb(0.13, 0.62, 0.38)

const PAGE_W = 595.28 // A4
const PAGE_H = 841.89
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2

type Ctx = {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 40) newPage(ctx)
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) out.push(line)
  }
  return out
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; lineGap?: number; indent?: number } = {},
) {
  const size = opts.size ?? 9.5
  const font = opts.font ?? ctx.font
  const color = opts.color ?? INK
  const lineHeight = size + (opts.lineGap ?? 4)
  const indent = opts.indent ?? 0
  const lines = wrap(text, font, size, CONTENT_W - indent)
  for (const line of lines) {
    ensureSpace(ctx, lineHeight)
    if (line) {
      ctx.page.drawText(line, { x: MARGIN + indent, y: ctx.y - size, size, font, color })
    }
    ctx.y -= lineHeight
  }
}

function sectionTitle(ctx: Ctx, text: string) {
  ensureSpace(ctx, 28)
  ctx.y -= 8
  ctx.page.drawText(text, { x: MARGIN, y: ctx.y - 11, size: 11, font: ctx.bold, color: COBALT })
  ctx.y -= 16
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: LINE,
  })
  ctx.y -= 12
}

function kv(ctx: Ctx, label: string, value: string) {
  const size = 9.5
  const labelW = 150
  ensureSpace(ctx, size + 7)
  ctx.page.drawText(label, { x: MARGIN, y: ctx.y - size, size, font: ctx.bold, color: MUTED })
  const valueLines = wrap(value || '—', ctx.font, size, CONTENT_W - labelW)
  valueLines.forEach((line, i) => {
    if (i > 0) ensureSpace(ctx, size + 3)
    ctx.page.drawText(line, { x: MARGIN + labelW, y: ctx.y - size, size, font: ctx.font, color: INK })
    if (i < valueLines.length - 1) ctx.y -= size + 3
  })
  ctx.y -= size + 7
}

function header(ctx: Ctx, ref: string) {
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: COBALT })
  ctx.page.drawText('TENROUNDS', { x: MARGIN, y: PAGE_H - 50, size: 26, font: ctx.bold, color: rgb(1, 1, 1) })
  ctx.page.drawText('SESSION PURCHASE AGREEMENT', {
    x: MARGIN,
    y: PAGE_H - 70,
    size: 11,
    font: ctx.bold,
    color: rgb(0.78, 0.86, 1),
  })
  ctx.page.drawText(`Receipt Ref: ${ref}`, {
    x: PAGE_W - MARGIN - ctx.font.widthOfTextAtSize(`Receipt Ref: ${ref}`, 9),
    y: PAGE_H - 50,
    size: 9,
    font: ctx.font,
    color: rgb(0.85, 0.9, 1),
  })
  ctx.page.drawText(`${fullAddress}  ·  ${business.phoneDisplay}`, {
    x: PAGE_W - MARGIN - ctx.font.widthOfTextAtSize(`${fullAddress}  ·  ${business.phoneDisplay}`, 8),
    y: PAGE_H - 66,
    size: 8,
    font: ctx.font,
    color: rgb(0.78, 0.86, 1),
  })
  ctx.y = PAGE_H - 96 - 24
}

function footer(doc: PDFDocument, font: PDFFont) {
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`TENROUNDS Fitness  ·  ${business.url.replace('https://', '')}`, {
      x: MARGIN,
      y: 28,
      size: 7.5,
      font,
      color: MUTED,
    })
    const num = `Page ${i + 1} of ${pages.length}`
    p.drawText(num, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(num, 7.5), y: 28, size: 7.5, font, color: MUTED })
  })
}

export async function generateSessionPdf(s: SessionPurchase): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: 0, font, bold }
  const ref = `TRS-${String(s.id).padStart(5, '0')}`
  header(ctx, ref)

  const signedDate = new Date(s.createdAt).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })
  const fullName = `${s.firstName} ${s.surname}`

  // ── Purchase summary ──
  sectionTitle(ctx, 'Purchase Summary')
  kv(ctx, 'Pack', s.unitLabel)
  kv(ctx, 'Paid Sessions', String(s.packQuantity))
  if (s.bonusSessions > 0) {
    kv(ctx, 'Bonus Sessions', `+${s.bonusSessions} free`)
    kv(ctx, 'Total Sessions', String(s.totalSessions))
  }
  if (s.specialTitle) kv(ctx, 'Special Applied', s.specialTitle)
  if (s.baseAmount > s.amount) kv(ctx, 'Standard Price', formatRand(s.baseAmount))
  kv(ctx, 'Amount Paid', formatRand(s.amount))
  kv(ctx, 'Payment Method', 'PayFast (paid online)')
  kv(ctx, 'Payment Status', s.paymentStatus)
  if (s.pfPaymentId) kv(ctx, 'PayFast Payment ID', s.pfPaymentId)

  // ── Member details ──
  sectionTitle(ctx, 'Member Details')
  kv(ctx, 'Full Name', fullName)
  kv(ctx, 'Email Address', s.email)
  kv(ctx, 'Contact Number', s.contactNumber)
  kv(ctx, 'ID Number', s.idNumber)
  kv(ctx, 'Emergency Contact', `${s.emergencyContactName} — ${s.emergencyContactNumber}`)

  // ── Agreements accepted ──
  sectionTitle(ctx, 'Agreements Accepted')
  const accepted = [
    s.agreeTerms ? 'Agreement to Terms (incl. Privacy Notice & POPIA)' : null,
    s.agreeCancellation ? 'Cancellation & Early Termination' : null,
    s.agreeHealth ? 'Health & Safety and Liability' : null,
    s.agreePrivacy ? 'Privacy and Data Consent' : null,
  ].filter(Boolean) as string[]
  for (const a of accepted) {
    ensureSpace(ctx, 14)
    const cy = ctx.y - 9.5
    ctx.page.drawLine({ start: { x: MARGIN + 1, y: cy + 2 }, end: { x: MARGIN + 4, y: cy }, thickness: 1.4, color: GREEN })
    ctx.page.drawLine({ start: { x: MARGIN + 4, y: cy }, end: { x: MARGIN + 9, y: cy + 6 }, thickness: 1.4, color: GREEN })
    ctx.page.drawText(a, { x: MARGIN + 16, y: cy, size: 9.5, font, color: INK })
    ctx.y -= 15
  }

  // ── Signature ──
  sectionTitle(ctx, 'Digital Signature')
  ensureSpace(ctx, 110)
  if (s.signature && s.signature.startsWith('data:image')) {
    try {
      const base64 = s.signature.split(',')[1]
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
      const png = await doc.embedPng(bytes)
      const maxW = 220
      const scale = Math.min(maxW / png.width, 70 / png.height)
      const w = png.width * scale
      const h = png.height * scale
      ctx.page.drawImage(png, { x: MARGIN, y: ctx.y - h, width: w, height: h })
      ctx.y -= h + 6
    } catch {
      ctx.y -= 6
    }
  }
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + 240, y: ctx.y }, thickness: 0.75, color: LINE })
  ctx.y -= 12
  ctx.page.drawText(`${fullName}  ·  Signed ${signedDate}`, { x: MARGIN, y: ctx.y - 9, size: 9, font, color: MUTED })
  ctx.y -= 18

  // ── Full terms ──
  newPage(ctx)
  ctx.page.drawText('TENROUNDS TERMS & CONDITIONS', {
    x: MARGIN,
    y: ctx.y - 14,
    size: 13,
    font: bold,
    color: COBALT,
  })
  ctx.y -= 30
  for (const section of AGREEMENT_SECTIONS) {
    ensureSpace(ctx, 30)
    drawParagraph(ctx, section.heading, { size: 10, font: bold, color: INK, lineGap: 3 })
    ctx.y -= 1
    drawParagraph(ctx, section.body, { size: 9, color: rgb(0.25, 0.28, 0.33), lineGap: 4 })
    ctx.y -= 6
  }

  footer(doc, font)
  return await doc.save()
}
