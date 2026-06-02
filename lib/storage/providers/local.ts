import { mkdir, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { type StorageProvider, type UploadInput, toBuffer } from '../types'

/*
 * Local filesystem provider — for VPS / self-hosted deployments where you
 * control the disk. Files are written under <STORAGE_LOCAL_DIR> (default
 * "public/uploads") and served as static files by Next.js / your reverse proxy.
 *
 * Env vars:
 *   STORAGE_LOCAL_DIR        - directory to write to (default "public/uploads")
 *   STORAGE_PUBLIC_BASE_URL  - URL prefix the files are served under (default "/uploads")
 */

const ROOT = process.env.STORAGE_LOCAL_DIR || join(process.cwd(), 'public', 'uploads')
const BASE_URL = process.env.STORAGE_PUBLIC_BASE_URL || '/uploads'

export const localProvider: StorageProvider = {
  name: 'local',
  async upload({ key, data, contentType }: UploadInput) {
    void contentType
    const filePath = join(ROOT, key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, await toBuffer(data))
    return { url: `${BASE_URL.replace(/\/$/, '')}/${key}`, key }
  },
  async delete(key: string) {
    await unlink(join(ROOT, key)).catch(() => {})
  },
}
