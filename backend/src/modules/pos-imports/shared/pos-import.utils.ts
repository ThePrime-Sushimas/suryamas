/**
 * POS Import Utilities
 * Following journal.utils.ts pattern
 */

import { POS_IMPORT_STATUS_TRANSITIONS } from './pos-import.constants'
import { PosImportStatus } from './pos-import.types'

/**
 * Validate status transition
 */
export function canTransition(from: PosImportStatus, to: PosImportStatus): boolean {
  return POS_IMPORT_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Extract date range from POS data with proper error handling
 */
export function extractDateRange(lines: Array<{ sales_date: string | Date }>) {
  if (lines.length === 0) {
    return { start: null, end: null }
  }

  const dates = lines
    .map(l => {
      try {
        const date = new Date(l.sales_date)
        return isNaN(date.getTime()) ? null : date
      } catch {
        return null
      }
    })
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length === 0) {
    return { start: null, end: null }
  }

  return {
    start: dates[0].toISOString().split('T')[0],
    end: dates[dates.length - 1].toISOString().split('T')[0]
  }
}

/**
 * Validate Excel row has required fields with comprehensive checks
 */
export function validatePosRow(row: any, rowNumber: number): string[] {
  const errors: string[] = []

  // Required fields
  if (!row['Bill Number']) {
    errors.push(`Row ${rowNumber}: Bill Number is required`)
  }

  if (!row['Sales Number']) {
    errors.push(`Row ${rowNumber}: Sales Number is required`)
  }

  if (!row['Sales Date']) {
    errors.push(`Row ${rowNumber}: Sales Date is required`)
  } else {
    // Validate date format
    const date = new Date(row['Sales Date'])
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowNumber}: Invalid Sales Date format`)
    }
  }

  // Validate numeric fields if present
  const numericFields = ['Qty', 'Price', 'Subtotal', 'Total', 'Nett Sales']
  numericFields.forEach(field => {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      const value = Number(row[field])
      if (isNaN(value)) {
        errors.push(`Row ${rowNumber}: ${field} must be a number`)
      }
    }
  })

  return errors
}
