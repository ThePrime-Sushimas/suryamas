// File size limits
export const POS_IMPORT_MAX_FILE_SIZE_MB = 100
export const POS_IMPORT_MAX_FILE_SIZE_BYTES = POS_IMPORT_MAX_FILE_SIZE_MB * 1024 * 1024

// Display limits
export const POS_IMPORT_MAX_VISIBLE_DUPLICATES = 10

// Timeouts
export const POS_IMPORT_UPLOAD_TIMEOUT_MS = 120000 // 2 minutes

// Pagination
export const POS_IMPORT_DEFAULT_PAGE_SIZE = 50
export const POS_IMPORT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Rate limiting
export const POS_IMPORT_UPLOAD_COOLDOWN_MS = 5000 // 5 seconds

// Status colors
export const STATUS_COLORS = {
  PENDING: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  ANALYZED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  IMPORTED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  MAPPED: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  POSTED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
} as const
