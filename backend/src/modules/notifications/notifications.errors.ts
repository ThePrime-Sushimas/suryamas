import { NotFoundError, ValidationError, DatabaseError } from '../../utils/errors.base'

export class NotificationNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('notification', id)
    this.name = 'NotificationNotFoundError'
  }
}

export class NotificationValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'NotificationValidationError'
  }
}

export class NotificationOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} notification`,
      { code: `NOTIFICATION_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'NotificationOperationError'
  }
}

export const NotificationErrors = {
  NOT_FOUND: (id?: string) => new NotificationNotFoundError(id),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new NotificationValidationError(message, details),
  CREATE_FAILED: (error?: string) => new NotificationOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new NotificationOperationError('update', error),
  DELETE_FAILED: (error?: string) => new NotificationOperationError('delete', error),
}
