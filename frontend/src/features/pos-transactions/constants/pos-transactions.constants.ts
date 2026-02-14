/**
 * Centralized configuration constants for POS Transactions
 * All magic numbers and strings should be defined here
 */

// Pagination Configuration
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  BRANCHES_PAGE_SIZE: 100,
  PAYMENT_METHODS_PAGE_SIZE: 100,
} as const

// Date Presets
export const DATE_PRESETS = {
  TODAY: 'today',
  WEEK: 'week',
  MONTH: 'month',
  LAST_MONTH: 'lastMonth',
} as const

// Locale Configuration
export const LOCALE_CONFIG = {
  CURRENCY_LOCALE: 'id-ID',
  CURRENCY_CODE: 'IDR',
  DATE_DISPLAY_LOCALE: 'id-ID',
} as const

// Table Configuration
export const TABLE_CONFIG = {
  EMPTY_MESSAGE: 'Click "Apply Filters" to search transactions',
  LOADING_MESSAGE: 'Loading transactions...',
} as const

// Filter Configuration
export const FILTER_CONFIG = {
  DEBOUNCE_DELAY: 300,
} as const

// Dropdown Configuration
export const DROPDOWN_CONFIG = {
  MAX_HEIGHT: 240, // max-h-60 = 15rem = 240px
} as const

// Message Configuration
export const MESSAGE_CONFIG = {
  EXPORT_SUCCESS: 'Export job created! Check the notification bell for progress.',
  NO_BRANCH_SELECTED: 'Please select a branch to view transactions',
  ERROR_TITLE: 'Terjadi Kesalahan',
  ERROR_MESSAGE: 'Gagal memuat halaman transaksi POS. Silakan coba lagi.',
  RELOAD_BUTTON: 'Muat Ulang Halaman',
} as const

