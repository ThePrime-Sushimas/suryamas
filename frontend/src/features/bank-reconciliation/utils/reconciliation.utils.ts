/**
 * Utility functions for Bank Reconciliation feature
 */

import { DATE_FORMAT, CURRENCY_FORMAT } from '../constants/reconciliation.config';

/**
 * Format date for consistent display across all components
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(
    DATE_FORMAT.DISPLAY,
    DATE_FORMAT.OPTIONS
  );
}

/**
 * Format datetime with time component
 */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(
    DATE_FORMAT.DISPLAY,
    DATE_FORMAT.DATETIME_OPTIONS
  );
}

/**
 * Format currency for IDR
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '-';
  return amount.toLocaleString(CURRENCY_FORMAT.LOCALE, {
    style: 'currency',
    currency: CURRENCY_FORMAT.CURRENCY,
    maximumFractionDigits: CURRENCY_FORMAT.MAX_FRACTION_DIGITS,
  });
}

/**
 * Format number without currency
 */
export function formatNumber(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '-';
  return amount.toLocaleString(CURRENCY_FORMAT.LOCALE, {
    maximumFractionDigits: CURRENCY_FORMAT.MAX_FRACTION_DIGITS,
  });
}

/**
 * Calculate difference percentage between two amounts
 */
export function calculateDifferencePercent(
  actual: number,
  expected: number
): number {
  if (expected === 0) return 0;
  return Math.abs(actual - expected) / expected * 100;
}

/**
 * Check if difference is within tolerance
 */
export function isWithinTolerance(
  actual: number,
  expected: number,
  tolerancePercent: number
): boolean {
  return calculateDifferencePercent(actual, expected) <= tolerancePercent;
}

/**
 * Create a Map from items array for O(1) lookup
 */
export function createItemsMap<T extends { id: string }>(
  items: T[]
): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Calculate total amount from selected IDs
 */
export function calculateSelectedTotal<T extends { id: string; credit_amount?: number; debit_amount?: number }>(
  items: T[],
  selectedIds: string[]
): number {
  const itemMap = createItemsMap(items);
  return selectedIds.reduce((sum, id) => {
    const item = itemMap.get(id);
    if (!item) return sum;
    return sum + (item.credit_amount || 0) - (item.debit_amount || 0);
  }, 0);
}

/**
 * Debounce function for filter inputs
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Get net amount from statement (credit - debit)
 */
export function getNetAmount(
  creditAmount?: number,
  debitAmount?: number
): number {
  return (creditAmount ?? 0) - (debitAmount ?? 0);
}

/**
 * Format amount with sign for display
 */
export function formatAmountWithSign(amount: number): string {
  const formatted = formatNumber(Math.abs(amount));
  if (amount >= 0) return `+${formatted}`;
  return `-${formatted}`;
}

/**
 * Check if value is empty/undefined
 */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Safe array check
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

