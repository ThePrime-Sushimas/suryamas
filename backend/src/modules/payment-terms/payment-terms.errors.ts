// backend/src/modules/payment-terms/payment-terms.errors.ts

export class PaymentTermError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class PaymentTermNotFoundError extends PaymentTermError {
  constructor(id: string) {
    super('PAYMENT_TERM_NOT_FOUND', `Payment term with ID '${id}' not found`, 404)
  }
}

export class DuplicateTermCodeError extends PaymentTermError {
  constructor(code: string) {
    super('DUPLICATE_TERM_CODE', `Payment term with code '${code}' already exists`, 409)
  }
}

export class InvalidCalculationTypeError extends PaymentTermError {
  constructor(type: string, validTypes: string[]) {
    super(
      'INVALID_CALCULATION_TYPE',
      `Invalid calculation type '${type}'. Must be one of: ${validTypes.join(', ')}`,
      422
    )
  }
}

export class TermCodeUpdateError extends PaymentTermError {
  constructor() {
    super('TERM_CODE_UPDATE_FORBIDDEN', 'Term code cannot be updated', 400)
  }
}

export class PaymentTermValidationError extends PaymentTermError {
  constructor(message: string, details?: any) {
    super('PAYMENT_TERM_VALIDATION_ERROR', message, 422, details)
  }
}
