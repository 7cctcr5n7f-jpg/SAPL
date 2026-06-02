import { del, put } from '@vercel/blob'
import type { StorageProvider, UploadInput } from '../types'

// Default provider. Uses Vercel Blob (BLOB_READ_WRITE_TOKEN).
export const vercelBlobProvider: StorageProvider = {
  name: 'vercel-blob',
  async upload({ key, data, contentType, access = 'public' }: UploadInput) {
    if (access !== 'public') {
      // Vercel Blob only serves public URLs; private objects need a signed-URL
      // strategy that other providers handle instead.
      console.warn('[v0] vercel-blob: private access requested but objects are public.')
    }
    const blob = await put(key, data as Blob | Buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    })
    return { url: blob.url, key }
  },
  async delete(key: string) {
    await del(key)
  },
}
