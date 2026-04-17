/**
 * Storage Abstraction Layer
 *
 * Saat ini pakai Supabase Storage.
 * Untuk migrasi ke Cloudflare R2, ganti implementasi di sini saja.
 * Database hanya simpan path (bukan full URL).
 *
 * ENV:
 *   STORAGE_PROVIDER=supabase (default) | cloudflare
 *   STORAGE_BUCKET=deposits
 *   STORAGE_BASE_URL= (optional, untuk generate public URL)
 */
import { supabase } from '../config/supabase'

const PROVIDER = process.env.STORAGE_PROVIDER || 'supabase'
const BUCKET = process.env.STORAGE_BUCKET || 'bukti_setoran'

export interface UploadResult {
  path: string
  publicUrl: string
}

export const storageService = {
  async upload(file: Buffer, fileName: string, contentType: string): Promise<UploadResult> {
    const path = `deposits/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`

    if (PROVIDER === 'supabase') {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType,
        upsert: true,
      })
      if (error) throw new Error(`Storage upload failed: ${error.message}`)

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { path, publicUrl: urlData.publicUrl }
    }

    // ── Cloudflare R2 placeholder ──
    // if (PROVIDER === 'cloudflare') {
    //   const r2 = new S3Client({ ... })
    //   await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: path, Body: file, ContentType: contentType }))
    //   return { path, publicUrl: `${process.env.STORAGE_BASE_URL}/${path}` }
    // }

    throw new Error(`Unknown storage provider: ${PROVIDER}`)
  },

  getPublicUrl(path: string): string {
    if (PROVIDER === 'supabase') {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return data.publicUrl
    }
    return `${process.env.STORAGE_BASE_URL || ''}/${path}`
  },

  async delete(path: string): Promise<void> {
    if (PROVIDER === 'supabase') {
      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) throw new Error(`Storage delete failed: ${error.message}`)
      return
    }
  },
}
