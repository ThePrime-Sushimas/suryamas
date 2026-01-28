/**
 * Duplicate Detection Utility
 * Detects duplicate bank statement transactions
 */

import { DUPLICATE_DETECTION } from '../bank-statement-import.constants'
import type { 
  BankStatement, 
  BankStatementDuplicate, 
  ParsedBankStatementRow 
} from '../bank-statement-import.types'
import { logWarn } from '@/config/logger'

/**
 * Duplicate Detection Utility Class
 */
export class DuplicateDetector {
  private readonly threshold = DUPLICATE_DETECTION.MATCH_THRESHOLD

  /**
   * Calculate match score between two transactions
   */
  calculateMatchScore(row: ParsedBankStatementRow, existing: BankStatement): number {
    let score = 0

    // Date match (30 points)
    if (String(row.transaction_date) === existing.transaction_date) {
      score += 30
    }

    // Amount match (40 points)
    const rowDebit = typeof row.debit_amount === 'number' 
      ? row.debit_amount 
      : parseFloat(String(row.debit_amount || 0))
    const rowCredit = typeof row.credit_amount === 'number'
      ? row.credit_amount
      : parseFloat(String(row.credit_amount || 0))

    if (rowDebit === existing.debit_amount && rowCredit === existing.credit_amount) {
      score += 40
    }

    // Reference number match (20 points)
    if (row.reference_number && row.reference_number === existing.reference_number) {
      score += 20
    }

    // Description similarity (10 points)
    if (row.description && existing.description) {
      const similarity = this.calculateStringSimilarity(
        String(row.description).toLowerCase(),
        existing.description.toLowerCase()
      )
      score += similarity * 10
    }

    return Math.min(score, 100)
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Detect duplicates between new rows and existing statements
   */
  detectDuplicates(
    rows: ParsedBankStatementRow[],
    existingStatements: BankStatement[],
    threshold?: number
  ): BankStatementDuplicate[] {
    const duplicates: BankStatementDuplicate[] = []
    const matchThreshold = threshold || this.threshold

    rows.forEach((row) => {
      existingStatements.forEach((existing) => {
        const matchScore = this.calculateMatchScore(row, existing)

        if (matchScore >= matchThreshold) {
          const debitAmount = typeof row.debit_amount === 'number'
            ? row.debit_amount
            : parseFloat(String(row.debit_amount || 0))
          const creditAmount = typeof row.credit_amount === 'number'
            ? row.credit_amount
            : parseFloat(String(row.credit_amount || 0))

          duplicates.push({
            reference_number: row.reference_number || undefined,
            transaction_date: String(row.transaction_date),
            debit_amount: debitAmount,
            credit_amount: creditAmount,
            existing_import_id: existing.import_id || 0,
            existing_statement_id: existing.id,
            row_numbers: [row.row_number],
          })
        }
      })
    })

    // Remove duplicate entries
    const uniqueDuplicates = duplicates.filter((dup, index, self) =>
      index === self.findIndex((d) =>
        d.transaction_date === dup.transaction_date &&
        d.debit_amount === dup.debit_amount &&
        d.credit_amount === dup.credit_amount &&
        d.reference_number === dup.reference_number
      )
    )

    if (uniqueDuplicates.length > 0) {
      logWarn('DuplicateDetector: Found duplicates', { count: uniqueDuplicates.length })
    }

    return uniqueDuplicates
  }

  /**
   * Quick check for exact duplicates (date + amount)
   */
  checkExactDuplicates(
    rows: ParsedBankStatementRow[],
    existingStatements: BankStatement[]
  ): BankStatementDuplicate[] {
    const duplicates: BankStatementDuplicate[] = []

    rows.forEach((row) => {
      const rowKey = `${row.transaction_date}-${row.debit_amount}-${row.credit_amount}`
      
      existingStatements.forEach((existing) => {
        const existingKey = `${existing.transaction_date}-${existing.debit_amount}-${existing.credit_amount}`
        
        if (rowKey === existingKey) {
          const debitAmount = typeof row.debit_amount === 'number'
            ? row.debit_amount
            : parseFloat(String(row.debit_amount || 0))
          const creditAmount = typeof row.credit_amount === 'number'
            ? row.credit_amount
            : parseFloat(String(row.credit_amount || 0))

          duplicates.push({
            reference_number: row.reference_number || existing.reference_number,
            transaction_date: String(row.transaction_date),
            debit_amount: debitAmount,
            credit_amount: creditAmount,
            existing_import_id: existing.import_id || 0,
            existing_statement_id: existing.id,
            row_numbers: [row.row_number],
          })
        }
      })
    })

    return duplicates
  }
}

// Export singleton instance
export const duplicateDetector = new DuplicateDetector()

