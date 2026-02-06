/**
 * Base Error Classes
 * Base error classes yang digunakan oleh seluruh aplikasi
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly context?: any,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, options?: { cause?: Error; context?: any }) {
    super(message, 500, 'DATABASE_ERROR', options?.context, options?.cause)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 400, 'VALIDATION_ERROR', context)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 404, 'NOT_FOUND', context)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 409, 'CONFLICT', context)
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', context)
  }
}

