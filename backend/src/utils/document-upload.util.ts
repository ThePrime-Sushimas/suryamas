/** Extensions allowed for invoice/payment document uploads (R2 object key suffix). */
export const DOCUMENT_UPLOAD_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'heic',
  'heif',
] as const

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export type DocumentUploadFile = Pick<Express.Multer.File, 'originalname' | 'mimetype'>

/**
 * Resolve stable file extension for storage path (prefer MIME over ambiguous names).
 * Normalizes jpeg → jpg so proof_url paths stay consistent.
 */
export function resolveDocumentUploadExtension(file: DocumentUploadFile): string | null {
  const fromMime = MIME_TO_EXT[file.mimetype]
  if (fromMime) return fromMime

  const raw = (file.originalname.split('.').pop() ?? '').toLowerCase()
  if (raw === 'jpeg') return 'jpg'
  if ((DOCUMENT_UPLOAD_EXTENSIONS as readonly string[]).includes(raw)) {
    return raw === 'jpeg' ? 'jpg' : raw
  }
  return null
}
