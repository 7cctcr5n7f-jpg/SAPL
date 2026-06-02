import { type NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { storage } from '@/lib/storage'

export async function POST(request: NextRequest) {
  // Only an authenticated admin may upload images.
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    const key = `tenrounds/${Date.now()}-${file.name}`
    const { url } = await storage.upload({
      key,
      data: file,
      contentType: file.type,
      access: 'public',
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[v0] Admin upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
