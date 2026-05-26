/** Shared validation + helpers for payment proof uploads (AP + General AP). */
export const PROOF_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

export const PROOF_MAX_FILE_SIZE = 10 * 1024 * 1024

export const PROOF_ACCEPT_STRING = PROOF_ACCEPTED_MIME_TYPES.join(',')

export function formatProofFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isProofImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
}

export function isProofImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(path.split('?')[0])
}

export function validateProofFile(file: File): string | null {
  if (!PROOF_ACCEPTED_MIME_TYPES.includes(file.type as (typeof PROOF_ACCEPTED_MIME_TYPES)[number])) {
    return 'Format file tidak didukung. Gunakan JPG, PNG, WEBP, HEIC, atau PDF.'
  }
  if (file.size > PROOF_MAX_FILE_SIZE) {
    return 'Ukuran file melebihi 10MB.'
  }
  return null
}
