/**
 * Business Rules Validation
 * Centralized business rule enforcement for POS Imports
 */

import { POS_IMPORT_MAX_FILE_SIZE} from '../api/pos-imports.api'
import { POS_IMPORT_UPLOAD_COOLDOWN_MS } from '../constants/pos-imports.constants'

export interface ValidationResult {
  valid: boolean
  error?: string
  warning?: string
}

export const BUSINESS_RULES = {
  upload: {
    maxFileSize: POS_IMPORT_MAX_FILE_SIZE,
    allowedExtensions: ['.xlsx', '.xls', '.csv'],
    cooldownMs: POS_IMPORT_UPLOAD_COOLDOWN_MS,
    maxUploadsPerDay: 50
  },
  confirmation: {
    allowFutureDates: false,
    maxDuplicatePercentage: 30
  },
  deletion: {
    allowDeleteImported: false,
    maxAgeForDeletionDays: 30,
    requireReason: true
  }
} as const

export const validateUpload = (file: File, lastUploadTime: number | null): ValidationResult => {
  if (file.size > BUSINESS_RULES.upload.maxFileSize) {
    return { valid: false, error: `File size exceeds ${BUSINESS_RULES.upload.maxFileSize / 1024 / 1024}MB limit` }
  }

  const hasValidExt = BUSINESS_RULES.upload.allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  if (!hasValidExt) {
    return { valid: false, error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files allowed' }
  }

  if (lastUploadTime) {
    const timeSince = Date.now() - lastUploadTime
    if (timeSince < BUSINESS_RULES.upload.cooldownMs) {
      const waitSeconds = Math.ceil((BUSINESS_RULES.upload.cooldownMs - timeSince) / 1000)
      return { valid: false, error: `Please wait ${waitSeconds} seconds before uploading another file` }
    }
  }

  return { valid: true }
}

export const validateDeletion = (): ValidationResult => {
  // Allow all deletions - backend will handle permission checks
  return { valid: true }
}

export const validateConfirmation = (duplicatePercentage: number): ValidationResult => {
  if (duplicatePercentage > BUSINESS_RULES.confirmation.maxDuplicatePercentage) {
    return {
      valid: true,
      warning: `High duplicate rate (${duplicatePercentage.toFixed(1)}%). Please review before confirming.`
    }
  }

  return { valid: true }
}
