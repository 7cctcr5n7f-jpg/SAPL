// Provider-agnostic storage contract. Swapping the underlying provider
// (Vercel Blob, AWS S3, Cloudflare R2, DigitalOcean Spaces, local disk) only
// requires implementing this interface — no caller code changes.

export type UploadInput = {
  /** Object key / path, e.g. "tenrounds/123-photo.jpg". */
  key: string
  /** The file contents. */
  data: File | Blob | Buffer | Uint8Array | ArrayBuffer
  /** MIME type, e.g. "image/jpeg". */
  contentType?: string
  /** Whether the object should be publicly readable. Defaults to "public". */
  access?: 'public' | 'private'
}

export type StoredObject = {
  /** Publicly accessible URL (when access is "public"). */
  url: string
  /** The key the object was stored under. */
  key: string
}

export interface StorageProvider {
  /** The provider identifier, useful for logging/diagnostics. */
  readonly name: string
  /** Store an object and return its public URL + key. */
  upload(input: UploadInput): Promise<StoredObject>
  /** Remove an object by key (optional — not all callers need it). */
  delete?(key: string): Promise<void>
}

/** Normalizes any accepted input into a Buffer (for SDKs that need bytes). */
export async function toBuffer(data: UploadInput['data']): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data))
  // File and Blob both expose arrayBuffer().
  const ab = await (data as Blob).arrayBuffer()
  return Buffer.from(new Uint8Array(ab))
}
