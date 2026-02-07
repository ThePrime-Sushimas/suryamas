/**
 * Centralized configuration constants for Bank Reconciliation
 * All magic numbers should be defined here
 */

// Pagination Configuration
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  LARGE_LIMIT: 10000, // Legacy - avoid using this
};

// Multi-Match Configuration
export const MULTI_MATCH_CONFIG = {
  TOLERANCE_PERCENT: 5, // 5% tolerance for amount difference
  MIN_STATEMENTS: 2,    // Minimum statements for multi-match
  MAX_STATEMENTS: 10,  // Maximum recommended statements
  DATE_TOLERANCE_DAYS: 3,
};

// Auto-Match Configuration
export const AUTO_MATCH_CONFIG = {
  AMOUNT_TOLERANCE: 0.01, // 0.01% tolerance
  DATE_BUFFER_DAYS: 3,     // Days buffer for date matching
  DIFFERENCE_THRESHOLD: 1000, // IDR threshold
};

// Default Matching Criteria (from legacy file)
export const DEFAULT_MATCHING_CRITERIA = {
  amountTolerance: 0.01,
  dateBufferDays: 3,
  differenceThreshold: 1000,
};

// Reconciliation Status Configuration
export const RECONCILIATION_STATUS = {
  PENDING: 'PENDING',
  AUTO_MATCHED: 'AUTO_MATCHED',
  MANUALLY_MATCHED: 'MANUALLY_MATCHED',
  DISCREPANCY: 'DISCREPANCY',
  UNRECONCILED: 'UNRECONCILED',
  RECONCILED: 'RECONCILED', // For UI filter purposes
} as const;

export type ReconciliationStatus = typeof RECONCILIATION_STATUS[keyof typeof RECONCILIATION_STATUS];

export const STATUS_CONFIG: Record<ReconciliationStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  AUTO_MATCHED: { label: 'Auto-Matched', color: 'text-green-700', bg: 'bg-green-100' },
  MANUALLY_MATCHED: { label: 'Manually Matched', color: 'text-blue-700', bg: 'bg-blue-100' },
  DISCREPANCY: { label: 'Discrepancy', color: 'text-red-700', bg: 'bg-red-100' },
  UNRECONCILED: { label: 'Unreconciled', color: 'text-orange-700', bg: 'bg-orange-100' },
  RECONCILED: { label: 'Reconciled', color: 'text-green-700', bg: 'bg-green-100' },
};

// Legacy status colors (for backward compatibility)
export const RECONCILIATION_STATUS_COLORS: Record<string, string> = {
  PENDING: "gray",
  AUTO_MATCHED: "green",
  MANUALLY_MATCHED: "blue",
  DISCREPANCY: "red",
  UNRECONCILED: "orange",
};

// Date Formatting
export const DATE_FORMAT = {
  DISPLAY: 'id-ID',
  OPTIONS: {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  } as const,
  DATETIME_OPTIONS: {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  } as const,
};

// Currency Formatting
export const CURRENCY_FORMAT = {
  LOCALE: 'id-ID',
  CURRENCY: 'IDR',
  MAX_FRACTION_DIGITS: 0,
};

// Filter Configuration
export const FILTER_CONFIG = {
  DEBOUNCE_DELAY: 300, // ms for debouncing filter changes
  MIN_DATE_RANGE_DAYS: 1,
  MAX_DATE_RANGE_DAYS: 365,
};

// LocalStorage Keys
export const STORAGE_KEYS = {
  HIDE_DEBIT_COLUMN: 'bankReconciliationHideDebit',
  LAST_FILTER: 'bankReconciliationLastFilter',
};

// Match Criteria Types
export const MATCH_CRITERIA_TYPES = {
  EXACT_REF: 'EXACT_REF',
  EXACT_AMOUNT_DATE: 'EXACT_AMOUNT_DATE',
  FUZZY_AMOUNT_DATE: 'FUZZY_AMOUNT_DATE',
  AMOUNT_ONLY: 'AMOUNT_ONLY',
} as const;

export type MatchCriteriaType = typeof MATCH_CRITERIA_TYPES[keyof typeof MATCH_CRITERIA_TYPES];

// Group Status Types
export const GROUP_STATUS = {
  PENDING: 'PENDING',
  RECONCILED: 'RECONCILED',
  DISCREPANCY: 'DISCREPANCY',
  UNDO: 'UNDO',
} as const;

export type GroupStatus = typeof GROUP_STATUS[keyof typeof GROUP_STATUS];

export const GROUP_STATUS_CONFIG: Record<typeof GROUP_STATUS[keyof typeof GROUP_STATUS], { color: string; bg: string }> = {
  PENDING: { color: 'text-amber-700', bg: 'bg-amber-100' },
  RECONCILED: { color: 'text-green-700', bg: 'bg-green-100' },
  DISCREPANCY: { color: 'text-red-700', bg: 'bg-red-100' },
  UNDO: { color: 'text-gray-700', bg: 'bg-gray-100' },
};
