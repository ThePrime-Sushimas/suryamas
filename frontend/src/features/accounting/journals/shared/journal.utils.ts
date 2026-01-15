import type { JournalLine, JournalBalance } from './journal.types'

/**
 * Calculate balance from journal lines
 * Returns total debit, credit, balance, and balanced status
 */
export const calculateBalance = (lines: JournalLine[]): JournalBalance => {
  const total_debit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0)
  const total_credit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0)
  const balance = total_debit - total_credit
  
  // Allow 0.01 rounding difference
  const is_balanced = Math.abs(balance) < 0.01
  
  return {
    total_debit,
    total_credit,
    balance,
    is_balanced,
  }
}

/**
 * Validate journal lines structure
 * Returns array of error messages
 */
export const validateJournalLines = (lines: JournalLine[]): string[] => {
  const errors: string[] = []
  
  if (!lines || lines.length < 2) {
    errors.push('Journal must have at least 2 lines')
    return errors
  }
  
  const lineNumbers = new Set<number>()
  
  lines.forEach((line) => {
    // Validate line_number exists
    if (!line.line_number) {
      errors.push('Line is missing line number')
      return
    }
    
    // Validate line_number uniqueness
    if (lineNumbers.has(line.line_number)) {
      errors.push(`Line ${line.line_number}: Duplicate line number`)
    } else {
      lineNumbers.add(line.line_number)
    }
    
    // Validate account_id
    if (!line.account_id) {
      errors.push(`Line ${line.line_number}: Account is required`)
    }
    
    // Validate amounts
    if (line.debit_amount === 0 && line.credit_amount === 0) {
      errors.push(`Line ${line.line_number}: Amount cannot be zero`)
    }
    
    if (line.debit_amount > 0 && line.credit_amount > 0) {
      errors.push(`Line ${line.line_number}: Cannot have both debit and credit`)
    }
    
    if (line.debit_amount < 0 || line.credit_amount < 0) {
      errors.push(`Line ${line.line_number}: Amount cannot be negative`)
    }
  })
  
  return errors
}

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number | undefined | null, currency: string = 'IDR'): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0)
  }
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date for display
 */
export const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return '-'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

/**
 * Generate next line number
 */
export const getNextLineNumber = (lines: JournalLine[]): number => {
  if (lines.length === 0) return 1
  const maxLineNumber = Math.max(...lines.map((l) => l.line_number || 0))
  return maxLineNumber + 1
}
