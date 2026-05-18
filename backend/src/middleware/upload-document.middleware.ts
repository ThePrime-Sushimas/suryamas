import multer from 'multer'
import type { RequestHandler } from 'express'

/** Align with marketplace-po / goods-receipts attachment limits in service layer */
export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

const storage = multer.memoryStorage()

const IMAGE_MIME_PREFIX = 'image/'
const ALLOWED_EXACT_MIMES = new Set([
  'application/pdf',
  'image/heic',
  'image/heif',
])

export const documentUpload = multer({
  storage,
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith(IMAGE_MIME_PREFIX) || ALLOWED_EXACT_MIMES.has(file.mimetype)
    if (ok) {
      cb(null, true)
      return
    }
    cb(
      new Error(
        'Format file tidak didukung. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
      ),
    )
  },
})

/** Multer wrapper — maps size / filter errors to JSON 400 */
export function documentUploadSingle(fieldName: string): RequestHandler {
  return (req, res, next) => {
    documentUpload.single(fieldName)(req, res, (err: unknown) => {
      if (!err) {
        next()
        return
      }
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'File terlalu besar. Maksimal 10MB.',
          })
          return
        }
        res.status(400).json({
          success: false,
          message: err.message || 'Upload gagal',
        })
        return
      }
      if (err instanceof Error) {
        res.status(400).json({ success: false, message: err.message })
        return
      }
      res.status(400).json({ success: false, message: 'Upload gagal' })
    })
  }
}
