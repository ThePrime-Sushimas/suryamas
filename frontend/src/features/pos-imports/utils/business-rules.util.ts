/**
 * Business Rules Validation
 * Centralized business rule enforcement for POS Imports
 */

import type { PosImport } from '../types/pos-imports.types'
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

export const validateDeletion = (posImport: PosImport): ValidationResult => {
  if (posImport.status === 'IMPORTED' && !BUSINESS_RULES.deletion.allowDeleteImported) {
    return { valid: false, error: 'Cannot delete imported data. Contact administrator if deletion is required.' }
  }

  const importAge = Date.now() - new Date(posImport.import_date).getTime()
  const maxAgeMs = BUSINESS_RULES.deletion.maxAgeForDeletionDays * 24 * 60 * 60 * 1000
  if (importAge > maxAgeMs) {
    return { 
      valid: false, 
      error: `Import is older than ${BUSINESS_RULES.deletion.maxAgeForDeletionDays} days and cannot be deleted` 
    }
  }

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
