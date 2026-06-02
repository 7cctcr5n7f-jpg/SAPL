import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { getMembershipSignup } from '@/lib/content-queries'
import { generateMembershipPdf } from '@/lib/membership-pdf'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const signupId = Number(id)
  if (!Number.isFinite(signupId)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const signup = await getMembershipSignup(signupId)
  if (!signup) {
    return new NextResponse('Not found', { status: 404 })
  }

  let bytes: Uint8Array
  try {
    bytes = await generateMembershipPdf(signup)
  } catch (err) {
    console.error('[v0] Failed to render signup PDF:', err)
    return new NextResponse('Failed to generate PDF', { status: 500 })
  }

  const filename = `TENROUNDS-Membership-${signup.firstName}-${signup.surname}.pdf`.replace(/\s+/g, '-')
  const download = new URL(request.url).searchParams.get('download') === '1'

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
