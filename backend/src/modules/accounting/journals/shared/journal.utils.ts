import { JournalLine, JournalStatus, JournalType } from './journal.types'
import { JOURNAL_NUMBER_PREFIX, JOURNAL_STATUS_TRANSITIONS } from './journal.constants'

export function validateJournalBalance(lines: JournalLine[]): boolean {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit_amount, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.credit_amount, 0)
  
  // Allow small rounding differences (0.01)
  return Math.abs(totalDebit - totalCredit) < 0.01
}

export function calculateTotals(lines: JournalLine[]) {
  return {
    total_debit: lines.reduce((sum, line) => sum + line.debit_amount, 0),
    total_credit: lines.reduce((sum, line) => sum + line.credit_amount, 0)
  }
}

export function generateJournalNumber(type: JournalType, date: string, sequence: number): string {
  const prefix = JOURNAL_NUMBER_PREFIX[type]
  const year = date.substring(0, 4)
  const month = date.substring(5, 7)
  const seq = sequence.toString().padStart(5, '0')
  
  return `${prefix}/${year}${month}/${seq}`
}

export function getPeriodFromDate(date: string): string {
  return date.substring(0, 7) // YYYY-MM
}

/**
 * Validate journal lines structure and per-line rules
 * Does NOT validate balance (use validateJournalBalance separately)
 */
export function validateJournalLines(lines: JournalLine[]): string[] {
  const errors: string[] = []
  
  if (!lines || lines.length < 2) {
    errors.push('Journal must have at least 2 lines')
    return errors // Early return if no lines
  }
  
  // Track line numbers for uniqueness check
  const lineNumbers = new Set<number>()
  
  lines.forEach((line) => {
    // Validate line_number exists
    if (!line.line_number) {
      errors.push(`Line is missing line_number`)
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

export function canTransition(from: JournalStatus, to: JournalStatus): boolean {
  const allowedTransitions = JOURNAL_STATUS_TRANSITIONS[from]
  return allowedTransitions?.includes(to) ?? false
}
