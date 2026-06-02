import { type StorageProvider, type UploadInput, toBuffer } from '../types'

/*
 * S3-compatible provider — works with AWS S3, Cloudflare R2, and DigitalOcean
 * Spaces (all speak the S3 API). To use it:
 *   1. Install the SDK:  pnpm add @aws-sdk/client-s3
 *   2. Set STORAGE_PROVIDER=s3 | r2 | spaces
 *   3. Set the env vars below.
 *
 * Required env vars:
 *   STORAGE_BUCKET            - bucket name
 *   STORAGE_REGION            - region (use "auto" for R2)
 *   STORAGE_ACCESS_KEY_ID     - access key
 *   STORAGE_SECRET_ACCESS_KEY - secret key
 *   STORAGE_ENDPOINT          - custom endpoint (required for R2/Spaces, omit for AWS)
 *   STORAGE_PUBLIC_BASE_URL   - public base URL used to build the returned link
 *                               (e.g. CDN domain, R2 public bucket URL, Spaces CDN)
 */

// Load the SDK through an indirect import so the bundler (webpack/Turbopack)
// never tries to resolve "@aws-sdk/client-s3" at build time. The package is an
// OPTIONAL peer — only required when STORAGE_PROVIDER is set to an S3 backend.
// Using `new Function` hides the specifier from static analysis entirely.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importDynamic = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<unknown>

async function loadS3() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await importDynamic('@aws-sdk/client-s3')) as any
  } catch {
    throw new Error(
      'Storage provider "s3" selected but @aws-sdk/client-s3 is not installed. Run: pnpm add @aws-sdk/client-s3',
    )
  }
}

function publicUrl(key: string): string {
  const base = process.env.STORAGE_PUBLIC_BASE_URL
  if (base) return `${base.replace(/\/$/, '')}/${key}`
  // Fallback to the virtual-hosted-style AWS URL.
  const bucket = process.env.STORAGE_BUCKET
  const region = process.env.STORAGE_REGION || 'us-east-1'
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

let client: unknown = null

async function getClient() {
  if (client) return client
  const { S3Client } = await loadS3()
  client = new S3Client({
    region: process.env.STORAGE_REGION || 'auto',
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: !!process.env.STORAGE_ENDPOINT, // needed for R2/Spaces/MinIO
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    },
  })
  return client
}

export const s3Provider: StorageProvider = {
  name: 's3',
  async upload({ key, data, contentType, access = 'public' }: UploadInput) {
    const { PutObjectCommand } = await loadS3()
    const c = await getClient()
    const body = await toBuffer(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).send(
      new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(access === 'public' ? { ACL: 'public-read' } : {}),
      }),
    )
    return { url: publicUrl(key), key }
  },
  async delete(key: string) {
    const { DeleteObjectCommand } = await loadS3()
    const c = await getClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).send(new DeleteObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: key }))
  },
}
