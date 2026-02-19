/**
 * Monitoring Module Error Classes
 * Error classes untuk audit log dan error monitoring operations
 */

import {
  NotFoundError,
  ValidationError,
  DatabaseError
} from '../../utils/errors.base'

// ============================================================================
// AUDIT LOG ERRORS
// ============================================================================

export class AuditLogNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('audit_log', id)
    this.name = 'AuditLogNotFoundError'
  }
}

export class AuditLogCreationError extends DatabaseError {
  constructor(cause?: Error) {
    super('Failed to create audit log', {
      cause,
      code: 'AUDIT_LOG_CREATE_ERROR'
    })
    this.name = 'AuditLogCreationError'
  }
}

export class AuditLogFetchError extends DatabaseError {
  constructor(cause?: Error) {
    super('Failed to fetch audit logs', {
      cause,
      code: 'AUDIT_LOG_FETCH_ERROR'
    })
    this.name = 'AuditLogFetchError'
  }
}

// ============================================================================
// ERROR REPORT ERRORS
// ============================================================================

export class ErrorReportNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('error_report', id)
    this.name = 'ErrorReportNotFoundError'
  }
}

export class ErrorReportCreationError extends DatabaseError {
  constructor(cause?: Error) {
    super('Failed to create error report', {
      cause,
      code: 'ERROR_REPORT_CREATE_ERROR'
    })
    this.name = 'ErrorReportCreationError'
  }
}

export class ErrorReportFetchError extends DatabaseError {
  constructor(cause?: Error) {
    super('Failed to fetch error reports', {
      cause,
      code: 'ERROR_REPORT_FETCH_ERROR'
    })
    this.name = 'ErrorReportFetchError'
  }
}

export class ErrorStatsFetchError extends DatabaseError {
  constructor(cause?: Error) {
    super('Failed to fetch error statistics', {
      cause,
      code: 'ERROR_STATS_FETCH_ERROR'
    })
    this.name = 'ErrorStatsFetchError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidAuditActionError extends ValidationError {
  constructor(action: string) {
    super(`Invalid audit action: ${action}`, {
      action,
      validActions: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE']
    })
    this.name = 'InvalidAuditActionError'
  }
}

export class InvalidEntityTypeError extends ValidationError {
  constructor(entityType: string) {
    super(`Invalid entity type: ${entityType}`, {
      entityType
    })
    this.name = 'InvalidEntityTypeError'
  }
}

// ============================================================================
// CLEANUP ERRORS
// ============================================================================

export class CleanupOperationError extends DatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, {
      cause,
      code: 'CLEANUP_OPERATION_ERROR'
    })
    this.name = 'CleanupOperationError'
  }
}

export class ArchiveOperationError extends DatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, {
      cause,
      code: 'ARCHIVE_OPERATION_ERROR'
    })
    this.name = 'ArchiveOperationError'
  }
}

