/**
 * POS Import Constants
 * Following journal.constants.ts pattern
 */

export const POS_IMPORT_STATUS = {
  PENDING: 'PENDING',
  ANALYZED: 'ANALYZED',
  IMPORTED: 'IMPORTED',
  MAPPED: 'MAPPED',
  POSTED: 'POSTED',
  FAILED: 'FAILED'
} as const

export const POS_IMPORT_STATUS_LABELS = {
  PENDING: 'Pending Analysis',
  ANALYZED: 'Analyzed',
  IMPORTED: 'Imported',
  MAPPED: 'Mapped to Journal',
  POSTED: 'Posted',
  FAILED: 'Failed'
}

export const POS_IMPORT_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ANALYZED', 'FAILED'],
  ANALYZED: ['IMPORTED', 'FAILED'],
  IMPORTED: ['MAPPED', 'FAILED'],
  MAPPED: ['POSTED', 'FAILED'],
  POSTED: [],
  FAILED: ['PENDING']
}
