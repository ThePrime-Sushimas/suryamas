export class AccountingError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message)
    this.name = 'AccountingError'
  }
}

export class JournalError extends AccountingError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode)
    this.name = 'JournalError'
  }
}

export class LedgerError extends AccountingError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode)
    this.name = 'LedgerError'
  }
}

export class AccountingPurposeError extends AccountingError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode)
    this.name = 'AccountingPurposeError'
  }
}