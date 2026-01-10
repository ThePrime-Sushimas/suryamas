/**
 * Pricelist Format Utilities
 * Consistent formatting for display with memoization
 * 
 * @module pricelists/utils/format
 */

import type { Currency, PricelistStatus } from '../types/pricelist.types'

// Memoized formatters to prevent recreation on each render
const priceFormatters = new Map<Currency, Intl.NumberFormat>()
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})
const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

// Cached status labels
const STATUS_LABELS: Record<PricelistStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired'
}

/**
 * Format price with currency (memoized formatter)
 */
export function formatPrice(price: number, currency: Currency = 'IDR'): string {
  let formatter = priceFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    priceFormatters.set(currency, formatter)
  }
  return formatter.format(price)
}

/**
 * Format date to locale string (memoized formatter)
 */
export function formatDate(date: string | null): string {
  if (!date) return '-'
  try {
    return dateFormatter.format(new Date(date))
  } catch {
    return date
  }
}

/**
 * Format datetime to locale string (memoized formatter)
 */
export function formatDateTime(date: string): string {
  try {
    return dateTimeFormatter.format(new Date(date))
  } catch {
    return date
  }
}

/**
 * Format status to display label (cached lookup)
 */
export function formatStatus(status: PricelistStatus): string {
  return STATUS_LABELS[status] || status
}

/**
 * Format validity period
 */
export function formatValidityPeriod(validFrom: string, validTo: string | null): string {
  const from = formatDate(validFrom)
  const to = validTo ? formatDate(validTo) : 'Permanent'
  return `${from} - ${to}`
}

/**
 * Check if pricelist is currently valid
 */
export function isCurrentlyValid(validFrom: string, validTo: string | null): boolean {
  const now = new Date()
  const from = new Date(validFrom)
  
  if (now < from) return false
  
  if (validTo) {
    const to = new Date(validTo)
    if (now > to) return false
  }
  
  return true
}

/**
 * Get validity status label
 */
export function getValidityStatus(validFrom: string, validTo: string | null): {
  label: string
  color: 'green' | 'yellow' | 'red'
} {
  const now = new Date()
  const from = new Date(validFrom)
  
  if (now < from) {
    return { label: 'Not yet valid', color: 'yellow' }
  }
  
  if (validTo) {
    const to = new Date(validTo)
    if (now > to) {
      return { label: 'Expired', color: 'red' }
    }
  }
  
  return { label: 'Valid', color: 'green' }
}
