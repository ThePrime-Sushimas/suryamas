/**
 * Pricelist Module Constants
 * 
 * Single source of truth for:
 * - Business rules
 * - UI options
 * - Validation rules
 * - Default values
 * 
 * @module pricelists/constants
 */

import type { Currency, PricelistStatus, SortField, SortOrder } from '../types/pricelist.types'

// ============================================================================
// BUSINESS RULES
// ============================================================================

/**
 * Status transition rules
 * Defines which status transitions are allowed
 */
export const STATUS_TRANSITIONS: Record<PricelistStatus, PricelistStatus[]> = {
  DRAFT: ['APPROVED', 'REJECTED'],
  APPROVED: ['EXPIRED'],
  REJECTED: [], // Terminal state
  EXPIRED: [] // Terminal state
}

/**
 * Editable statuses
 * Only DRAFT pricelists can be edited
 */
export const EDITABLE_STATUSES: PricelistStatus[] = ['DRAFT']

/**
 * Approvable statuses
 * Only DRAFT pricelists can be approved/rejected
 */
export const APPROVABLE_STATUSES: PricelistStatus[] = ['DRAFT']

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const VALIDATION_RULES = {
  PRICE: {
    MIN: 0,
    MAX: 999999999999.99,
    DECIMAL_PLACES: 2
  },
  VALID_FROM: {
    MIN_DATE: '2000-01-01',
    MAX_YEARS_AHEAD: 10
  },
  VALID_TO: {
    MIN_DAYS_FROM_START: 1,
    MAX_YEARS_AHEAD: 10
  }
} as const

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_VALUES = {
  CURRENCY: 'IDR' as Currency,
  IS_ACTIVE: true,
  PAGE: 1,
  LIMIT: 10,
  SORT_BY: 'created_at' as SortField,
  SORT_ORDER: 'desc' as SortOrder
} as const

// ============================================================================
// UI OPTIONS
// ============================================================================

/**
 * Currency options for dropdown
 */
export const CURRENCY_OPTIONS: ReadonlyArray<{ value: Currency; label: string }> = [
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' }
] as const

/**
 * Status options for filter dropdown
 */
export const STATUS_OPTIONS: ReadonlyArray<{ value: PricelistStatus; label: string; color: string }> = [
  { value: 'DRAFT', label: 'Draft', color: 'gray' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
  { value: 'EXPIRED', label: 'Expired', color: 'yellow' }
] as const

/**
 * Active status options for filter
 */
export const ACTIVE_OPTIONS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' }
] as const

/**
 * Page size options
 */
export const PAGE_SIZE_OPTIONS: ReadonlyArray<number> = [10, 25, 50, 100] as const

/**
 * Sort field options
 */
export const SORT_FIELD_OPTIONS: ReadonlyArray<{ value: SortField; label: string }> = [
  { value: 'price', label: 'Price' },
  { value: 'valid_from', label: 'Valid From' },
  { value: 'valid_to', label: 'Valid To' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' }
] as const

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Get status color for UI
 */
export function getStatusColor(status: PricelistStatus): string {
  const option = STATUS_OPTIONS.find(opt => opt.value === status)
  return option?.color || 'gray'
}

/**
 * Check if status can transition to target
 */
export function canTransitionTo(from: PricelistStatus, to: PricelistStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) || false
}

/**
 * Check if pricelist is editable
 */
export function isEditable(status: PricelistStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}

/**
 * Check if pricelist can be approved/rejected
 */
export function isApprovable(status: PricelistStatus): boolean {
  return APPROVABLE_STATUSES.includes(status)
}
