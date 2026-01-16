// File size limits
export const POS_IMPORT_MAX_FILE_SIZE_MB = 100
export const POS_IMPORT_MAX_FILE_SIZE_BYTES = POS_IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024

// Display limits
export const POS_IMPORT_MAX_VISIBLE_DUPLICATES = 10

// Timeouts
export const POS_IMPORT_UPLOAD_TIMEOUT_MS = 120000 // 2 minutes

// Pagination
export const POS_IMPORT_DEFAULT_PAGE_SIZE = 50

// Rate limiting
export const POS_IMPORT_UPLOAD_COOLDOWN_MS = 5000 // 5 seconds

// Status colors
export const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-800',
  ANALYZED: 'bg-blue-100 text-blue-800',
  IMPORTED: 'bg-green-100 text-green-800',
  MAPPED: 'bg-purple-100 text-purple-800',
  POSTED: 'bg-indigo-100 text-indigo-800',
  FAILED: 'bg-red-100 text-red-800'
} as const
