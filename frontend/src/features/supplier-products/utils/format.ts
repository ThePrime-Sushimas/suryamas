// Supplier Product Formatting Utilities

import { CURRENCY_SYMBOLS } from '../constants/supplier-product.constants'

/**
 * Format price with currency
 * @param price - The price number
 * @param currency - Currency code (IDR, USD, EUR, etc.)
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'IDR'): string {
  if (currency === 'IDR') {
    // Indonesian Rupiah - no decimal places for large numbers
    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    return formatter.format(price)
  }

  // Other currencies - show 2 decimal places
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return formatter.format(price)
}

/**
 * Format price with symbol only
 * @param price - The price number
 * @param currency - Currency code
 * @returns Price with symbol
 */
export function formatPriceSimple(price: number, currency: string = 'IDR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(price)
  return `${symbol} ${formatted}`
}

/**
 * Format lead time to human readable string
 * @param days - Number of days (0-365)
 * @returns Formatted lead time string
 */
export function formatLeadTime(days: number | null): string {
  if (days === null || days === undefined) return '-'
  if (days === 0) return 'Same day'
  if (days === 1) return '1 day'
  return `${days} days`
}

/**
 * Format minimum order quantity
 * @param qty - Quantity number or null
 * @returns Formatted quantity string
 */
export function formatMinOrderQty(qty: number | null): string {
  if (qty === null || qty === undefined) return 'No minimum'
  return new Intl.NumberFormat('id-ID').format(qty)
}

/**
 * Format date to Indonesian format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/**
 * Format date only (without time)
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDateOnly(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/**
 * Get status badge color
 * @param isActive - Active status
 * @returns Tailwind color class
 */
export function getStatusColor(isActive: boolean): string {
  return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
}

/**
 * Get preferred badge color
 * @param isPreferred - Preferred status
 * @returns Tailwind color class
 */
export function getPreferredColor(isPreferred: boolean): string {
  return isPreferred ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-400'
}

