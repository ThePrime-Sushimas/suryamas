/**
 * Jobs Error Classes
 * Module-specific error classes untuk jobs operations
 * 
 * Design Principles:
 * - Extend dari BaseError classes untuk konsistensi
 * - Bilingual support (Indonesian + English)
 * - Actionable error messages dengan guidance
 */

import { 
  NotFoundError, 
  ConflictError, 
  ValidationError,
  BusinessRuleError,
  DatabaseError
} from '../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class JobError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'JobError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class JobNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('job', id)
    this.name = 'JobNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class JobCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Job with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'JobCodeExistsError'
  }
}

export class JobNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Job with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'JobNameExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidJobCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Job code must not exceed 50 characters',
      { code: { maxLength: 50 } }
    )
    this.name = 'InvalidJobCodeError'
  }
}

export class InvalidJobNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Job name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidJobNameError'
  }
}

export class InvalidJobStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid job status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidJobStatusError'
  }
}

export class JobValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'JobValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class JobInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Job cannot be deleted as it is being used by ${usageCount} employees`,
      { rule: 'job_in_use', jobId: id, usageCount }
    )
    this.name = 'JobInUseError'
  }
}

export class CannotDeleteDefaultJobError extends BusinessRuleError {
  constructor(jobName: string) {
    super(
      `Cannot delete default job '${jobName}'`,
      { rule: 'default_job_deletion', jobName }
    )
    this.name = 'CannotDeleteDefaultJobError'
  }
}

export class JobAlreadyProcessingError extends BusinessRuleError {
  constructor(id?: string) {
    super(
      `Job ${id || 'unknown'} is already being processed`,
      { rule: 'job_processing', jobId: id }
    )
    this.name = 'JobAlreadyProcessingError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class JobOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} job`,
      { code: `JOB_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'JobOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const JobErrors = {
  NOT_FOUND: (id?: string) => new JobNotFoundError(id),
  CODE_EXISTS: (code: string) => new JobCodeExistsError(code),
  NAME_EXISTS: (name: string) => new JobNameExistsError(name),
  INVALID_CODE: (message?: string) => new InvalidJobCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidJobNameError(message),
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new InvalidJobStatusError(status, validStatuses),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new JobValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new JobInUseError(id, usageCount || 0),
  DELETE_DEFAULT: (name: string) => new CannotDeleteDefaultJobError(name),
  ALREADY_PROCESSING: (id?: string) => new JobAlreadyProcessingError(id),
  CREATE_FAILED: (error?: string) => new JobOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new JobOperationError('update', error),
  DELETE_FAILED: (error?: string) => new JobOperationError('delete', error),
  FILE_UPLOAD_FAILED: (error?: string) => new JobOperationError('file_upload', error),
}

