import { generateBlankAgreementPdf } from '@/lib/membership-pdf'

export const runtime = 'nodejs'

export async function GET() {
  const bytes = await generateBlankAgreementPdf()
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="tenrounds-membership-agreement.pdf"',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
