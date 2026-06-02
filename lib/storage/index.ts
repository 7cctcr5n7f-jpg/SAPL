import 'server-only'
import type { StorageProvider, UploadInput, StoredObject } from './types'
import { vercelBlobProvider } from './providers/vercel-blob'

export type { StorageProvider, UploadInput, StoredObject }

/*
 * Storage facade. Application code imports `storage` and never talks to a
 * specific provider directly. Select the backend with STORAGE_PROVIDER:
 *
 *   (unset) | "vercel-blob"  -> Vercel Blob       (default)
 *   "s3"                     -> AWS S3            (lib/storage/providers/s3)
 *   "r2"                     -> Cloudflare R2     (S3-compatible)
 *   "spaces"                 -> DigitalOcean Spaces (S3-compatible)
 *   "local"                  -> Local filesystem  (VPS / self-hosted)
 *
 * Providers other than vercel-blob are loaded lazily so their dependencies are
 * only required when actually selected.
 */
async function resolveProvider(): Promise<StorageProvider> {
  const provider = (process.env.STORAGE_PROVIDER || 'vercel-blob').toLowerCase()
  switch (provider) {
    case 'vercel-blob':
    case 'blob':
      return vercelBlobProvider
    case 's3':
    case 'r2':
    case 'spaces':
      return (await import('./providers/s3')).s3Provider
    case 'local':
      return (await import('./providers/local')).localProvider
    default:
      console.warn(`[v0] Unknown STORAGE_PROVIDER "${provider}" — falling back to vercel-blob.`)
      return vercelBlobProvider
  }
}

export const storage = {
  async upload(input: UploadInput): Promise<StoredObject> {
    const provider = await resolveProvider()
    return provider.upload(input)
  },
  async delete(key: string): Promise<void> {
    const provider = await resolveProvider()
    await provider.delete?.(key)
  },
}
