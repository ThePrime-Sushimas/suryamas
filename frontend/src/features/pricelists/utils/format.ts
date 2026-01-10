/**
 * Pricelist Format Utilities
 * Consistent formatting for display
 * 
 * @module pricelists/utils/format
 */

import type { Currency, PricelistStatus } from '../types/pricelist.types'

/**
 * Format price with currency
 */
export function formatPrice(price: number, currency: Currency = 'IDR'): string {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return formatter.format(price)
}

/**
 * Format date to locale string
 */
export function formatDate(date: string | null): string {
  if (!date) return '-'
  try {
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return date
  }
}

/**
 * Format datetime to locale string
 */
export function formatDateTime(date: string): string {
  try {
    return new Date(date).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return date
  }
}

/**
 * Format status to display label
 */
export function formatStatus(status: PricelistStatus): string {
  const labels: Record<PricelistStatus, string> = {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    EXPIRED: 'Expired'
  }
  return labels[status] || status
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
