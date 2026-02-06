/**
 * Duplicate Detection Utility
 * Centralized logic untuk mendeteksi dan memproses data duplikat
 */

import type { BankStatementDuplicateRow } from '../types/bank-statement-import.types'

/**
 * Extract row numbers dari duplicate data structure
 * Handle berbagai format dari backend:
 * - { row_numbers: number[] }
 * - { row_number: number }
 * - { row_numbers: string } (comma-separated)
 */
export function extractDuplicateRowNumbers(
  duplicate: BankStatementDuplicateRow | Record<string, unknown>
): Set<number> {
  const rowNumbers = new Set<number>()

  // Handle row_numbers array
  if ('row_numbers' in duplicate) {
    const rowNums = duplicate.row_numbers
    if (Array.isArray(rowNums)) {
      rowNums.forEach(num => {
        if (typeof num === 'number') {
          rowNumbers.add(num)
        } else if (typeof num === 'string') {
          const parsed = parseInt(num, 10)
          if (!isNaN(parsed)) {
            rowNumbers.add(parsed)
          }
        }
      })
    } else if (typeof rowNums === 'string') {
      // Handle comma-separated string
      rowNums.split(',').forEach(num => {
        const parsed = parseInt(num.trim(), 10)
        if (!isNaN(parsed)) {
          rowNumbers.add(parsed)
        }
      })
    }
  }

  // Handle single row_number
  if ('row_number' in duplicate) {
    const rowNum = duplicate.row_number
    if (typeof rowNum === 'number') {
      rowNumbers.add(rowNum)
    } else if (typeof rowNum === 'string') {
      const parsed = parseInt(rowNum, 10)
      if (!isNaN(parsed)) {
        rowNumbers.add(parsed)
      }
    }
  }

  return rowNumbers
}

/**
 * Get all duplicate row numbers dari array of duplicates
 */
export function getAllDuplicateRowNumbers(
  duplicates: BankStatementDuplicateRow[] | Record<string, unknown>[] | null | undefined
): Set<number> {
  if (!duplicates || !Array.isArray(duplicates)) {
    return new Set<number>()
  }

  const allRowNumbers = new Set<number>()
  
  duplicates.forEach(duplicate => {
    const rowNumbers = extractDuplicateRowNumbers(duplicate)
    rowNumbers.forEach(num => allRowNumbers.add(num))
  })

  return allRowNumbers
}

/**
 * Get duplicate count
 */
export function getDuplicateCount(
  duplicates: BankStatementDuplicateRow[] | Record<string, unknown>[] | null | undefined
): number {
  if (!duplicates || !Array.isArray(duplicates)) {
    return 0
  }

  return duplicates.length
}

/**
 * Check if a row is duplicate based on its row number
 */
export function isDuplicateRow(
  rowNumber: number,
  duplicateRowNumbers: Set<number>
): boolean {
  return duplicateRowNumbers.has(rowNumber)
}

/**
 * Categorize rows into valid, duplicate, dan invalid
 */
export function categorizeRows<T extends { row_number?: number; is_valid?: boolean }>(
  rows: T[],
  duplicateRowNumbers: Set<number>
): {
  valid: T[]
  duplicates: T[]
  invalid: T[]
} {
  const valid: T[] = []
  const duplicates: T[] = []
  const invalid: T[] = []

  rows.forEach(row => {
    const rowNum = row.row_number ?? 0
    const isDuplicate = duplicateRowNumbers.has(rowNum)
    const isInvalid = row.is_valid === false

    if (isDuplicate) {
      duplicates.push(row)
    } else if (isInvalid) {
      invalid.push(row)
    } else {
      valid.push(row)
    }
  })

  return { valid, duplicates, invalid }
}

/**
 * Filter out duplicate rows dari array
 */
export function filterOutDuplicates<T extends { row_number?: number }>(
  rows: T[],
  duplicateRowNumbers: Set<number>
): T[] {
  return rows.filter(row => {
    const rowNum = row.row_number ?? 0
    return !duplicateRowNumbers.has(rowNum)
  })
}

/**
 * Create duplicate summary statistics
 */
export interface DuplicateSummary {
  totalDuplicates: number
  duplicateRowCount: number
  uniqueDuplicateRows: number
}

export function getDuplicateSummary(
  duplicates: BankStatementDuplicateRow[] | Record<string, unknown>[] | null | undefined
): DuplicateSummary {
  if (!duplicates || !Array.isArray(duplicates)) {
    return {
      totalDuplicates: 0,
      duplicateRowCount: 0,
      uniqueDuplicateRows: 0,
    }
  }

  const allRowNumbers = getAllDuplicateRowNumbers(duplicates)

  return {
    totalDuplicates: duplicates.length,
    duplicateRowCount: Array.from(allRowNumbers).reduce((sum, rowNum) => {
      // Count how many duplicates reference this row
      const refCount = duplicates.filter(dup => {
        const nums = extractDuplicateRowNumbers(dup)
        return nums.has(rowNum)
      }).length
      return sum + refCount
    }, 0),
    uniqueDuplicateRows: allRowNumbers.size,
  }
}

