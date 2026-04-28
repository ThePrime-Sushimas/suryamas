/**
 * Storage Service — Cloudflare R2 (S3-compatible)
 *
 * ENV:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — S3 API access key
 *   R2_SECRET_ACCESS_KEY — S3 API secret key
 *   R2_PUBLIC_URL        — Public URL prefix for non-signed access (optional)
 *
 * Bucket names (R2 doesn't allow hyphens in some contexts, use flat names):
 *   buktisetoran, posimportstemp, jobresults, profilepictures, bankstatementimportstemp
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

// ── Default bucket (deposits/bukti setoran) ──
const DEFAULT_BUCKET = 'buktisetoran'

export interface UploadResult {
  path: string
  publicUrl: string
}

export const storageService = {
  /**
   * Upload file with auto-generated path (deposits/{year}/{month}/{fileName})
   */
  async upload(file: Buffer, fileName: string, contentType: string, bucket?: string): Promise<UploadResult> {
    const now = new Date()
    const path = `deposits/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`
    const b = bucket || DEFAULT_BUCKET

    await s3.send(new PutObjectCommand({
      Bucket: b,
      Key: path,
      Body: file,
      ContentType: contentType,
    }))

    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${path}` : path
    return { path, publicUrl }
  },

  /**
   * Get public URL for a path
   */
  getPublicUrl(path: string): string {
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${path}` : path
  },

  /**
   * Delete single file
   */
  async delete(path: string, bucket?: string): Promise<void> {
    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket || DEFAULT_BUCKET,
      Delete: { Objects: [{ Key: path }] },
    }))
  },

  /**
   * Upload to explicit path (no auto-prefix)
   */
  async uploadToPath(file: Buffer | string, path: string, contentType: string, bucket?: string): Promise<string> {
    const body = typeof file === 'string' ? Buffer.from(file, 'utf-8') : file

    await s3.send(new PutObjectCommand({
      Bucket: bucket || DEFAULT_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
    }))

    return path
  },

  /**
   * Generate pre-signed download URL
   */
  async createSignedUrl(path: string, expiresInSeconds: number, bucket?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket || DEFAULT_BUCKET,
      Key: path,
    })
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
  },

  /**
   * Download file content as text
   */
  async download(path: string, bucket?: string): Promise<string> {
    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: bucket || DEFAULT_BUCKET,
      Key: path,
    }))
    if (!Body) throw new Error(`Storage download failed: empty body for ${path}`)
    return await Body.transformToString('utf-8')
  },

  /**
   * Remove multiple files
   */
  async remove(paths: string[], bucket?: string): Promise<void> {
    if (paths.length === 0) return
    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket || DEFAULT_BUCKET,
      Delete: { Objects: paths.map(Key => ({ Key })) },
    }))
  },
}
