import { JournalStatus } from './journal.types'

export class JournalError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'JournalError'
  }
}

export const JournalErrors = {
  NOT_FOUND: (id?: string) => new JournalError(
    id ? `Journal ${id} not found` : 'Journal not found',
    'JOURNAL_NOT_FOUND',
    404
  ),
  
  NOT_BALANCED: () => new JournalError(
    'Journal is not balanced. Total debit must equal total credit',
    'JOURNAL_NOT_BALANCED'
  ),
  
  INVALID_LINES: (errors: string[]) => new JournalError(
    `Invalid journal lines: ${errors.join(', ')}`,
    'INVALID_JOURNAL_LINES'
  ),
  
  CANNOT_EDIT_NON_DRAFT: (currentStatus: JournalStatus) => new JournalError(
    `Cannot edit journal with status ${currentStatus}. Only DRAFT journals can be edited`,
    'CANNOT_EDIT_NON_DRAFT'
  ),
  
  CANNOT_EDIT_POSTED: () => new JournalError(
    'Cannot edit posted journal. Please reverse it first',
    'CANNOT_EDIT_POSTED'
  ),
  
  CANNOT_DELETE_POSTED: () => new JournalError(
    'Cannot delete posted journal. Please reverse it first',
    'CANNOT_DELETE_POSTED'
  ),
  
  ALREADY_POSTED: () => new JournalError(
    'Journal is already posted',
    'ALREADY_POSTED'
  ),
  
  ALREADY_REVERSED: () => new JournalError(
    'Journal is already reversed',
    'ALREADY_REVERSED'
  ),
  
  INVALID_STATUS_TRANSITION: (from: JournalStatus, to: JournalStatus) => new JournalError(
    `Cannot change status from ${from} to ${to}`,
    'INVALID_STATUS_TRANSITION'
  ),
  
  ACCOUNT_NOT_POSTABLE: (accountCode: string) => new JournalError(
    `Account ${accountCode} is not postable (header accounts cannot be used)`,
    'ACCOUNT_NOT_POSTABLE'
  ),
  
  PERIOD_CLOSED: (period: string) => new JournalError(
    `Period ${period} is closed. Cannot post journal`,
    'PERIOD_CLOSED'
  ),
  
  VALIDATION_ERROR: (field: string, message: string) => new JournalError(
    `${field}: ${message}`,
    'VALIDATION_ERROR'
  )
}
