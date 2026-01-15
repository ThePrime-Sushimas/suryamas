export { 
  JOURNAL_TYPES,
  JOURNAL_STATUS,
  JOURNAL_TYPE_LABELS,
  JOURNAL_STATUS_LABELS,
  JOURNAL_STATUS_COLORS,
  JOURNAL_STATUS_TRANSITIONS,
  canTransitionTo,
  getAvailableActions,
} from '../../shared/journal.constants'

// Default form values
export const DEFAULT_JOURNAL_FORM = {
  journal_date: new Date().toISOString().split('T')[0],
  journal_type: 'MANUAL' as const,
  description: '',
  currency: 'IDR',
  exchange_rate: 1,
  lines: [],
}

// Validation messages
export const VALIDATION_MESSAGES = {
  JOURNAL_DATE_REQUIRED: 'Journal date is required',
  JOURNAL_TYPE_REQUIRED: 'Journal type is required',
  DESCRIPTION_REQUIRED: 'Description is required',
  DESCRIPTION_MIN_LENGTH: 'Description must be at least 3 characters',
  LINES_MIN_COUNT: 'Journal must have at least 2 lines',
  LINES_NOT_BALANCED: 'Journal is not balanced. Total debit must equal total credit',
  ACCOUNT_REQUIRED: 'Account is required',
  AMOUNT_REQUIRED: 'Amount is required',
  AMOUNT_POSITIVE: 'Amount must be positive',
  DEBIT_OR_CREDIT: 'Line must have either debit or credit, not both',
}
