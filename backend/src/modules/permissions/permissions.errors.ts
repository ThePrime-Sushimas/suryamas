// =====================================================
// PERMISSIONS ERRORS
// Responsibility: Custom error types for permissions module
// =====================================================

export class OperationalError extends Error {
  public readonly isOperational: boolean
  public readonly statusCode: number

  constructor(message: string, statusCode: number = 400) {
    super(message)
    this.name = 'OperationalError'
    this.isOperational = true
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends OperationalError {
  constructor(resource: string) {
    super(`${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends OperationalError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends OperationalError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}
