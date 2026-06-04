import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getSessionPurchase } from '@/lib/content-queries'
import { generateSessionPdf } from '@/lib/session-pdf'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const purchaseId = Number(id)
  if (!Number.isFinite(purchaseId)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const purchase = await getSessionPurchase(purchaseId)
  if (!purchase) {
    return new NextResponse('Not found', { status: 404 })
  }

  let bytes: Uint8Array
  try {
    bytes = await generateSessionPdf(purchase)
  } catch (err) {
    console.error('[v0] Failed to render session PDF:', err)
    return new NextResponse('Failed to generate PDF', { status: 500 })
  }

  const filename = `TENROUNDS-Sessions-${purchase.firstName}-${purchase.surname}.pdf`.replace(/\s+/g, '-')
  const download = new URL(request.url).searchParams.get('download') === '1'

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
