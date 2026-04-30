import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BusinessRuleError,
} from '../../utils/errors.base'

export class EmployeeNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('employee', id)
    this.name = 'EmployeeNotFoundError'
  }
}

export class EmployeeConflictError extends ConflictError {
  constructor(message = 'Employee ID already exists') {
    super(message)
    this.name = 'EmployeeConflictError'
  }
}

export class EmployeeValidationError extends ValidationError {
  constructor(message: string) {
    super(message)
    this.name = 'EmployeeValidationError'
  }
}

export class EmployeeBusinessError extends BusinessRuleError {
  constructor(message: string) {
    super(message)
    this.name = 'EmployeeBusinessError'
  }
}

export const EmployeeErrors = {
  NOT_FOUND: (id?: string) => new EmployeeNotFoundError(id),
  CONFLICT: (msg?: string) => new EmployeeConflictError(msg),
  VALIDATION: (msg: string) => new EmployeeValidationError(msg),
  BUSINESS: (msg: string) => new EmployeeBusinessError(msg),
  NO_FILE: () => new EmployeeValidationError('No file uploaded'),
  NO_CHANGES: () => new EmployeeValidationError('No changes to update'),
  NO_SELECTION: () => new EmployeeValidationError('Please select at least one employee'),
  PROFILE_NOT_FOUND: () => new EmployeeNotFoundError('profile'),
  GENERATE_ID_FAILED: () => new EmployeeBusinessError('Failed to generate employee ID'),
}
