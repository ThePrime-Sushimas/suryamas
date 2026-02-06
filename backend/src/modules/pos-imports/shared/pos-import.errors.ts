/**
 * POS Imports Error Classes
 * Module-specific error classes untuk pos-imports operations
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
} from '../../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class PosImportError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PosImportError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PosImportNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('pos_import', id)
    this.name = 'PosImportNotFoundError'
  }
}

// ============================================================================
// FILE UPLOAD ERRORS
// ============================================================================

export class PosImportFileTooLargeError extends ValidationError {
  constructor(maxSizeMB: number) {
    super(
      `File too large. Maximum size is ${maxSizeMB}MB`,
      { maxSizeMB }
    )
    this.name = 'PosImportFileTooLargeError'
  }
}

export class PosImportInvalidFileTypeError extends ValidationError {
  constructor(allowedTypes: string[]) {
    super(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      { allowedTypes }
    )
    this.name = 'PosImportInvalidFileTypeError'
  }
}

export class PosImportEmptyFileError extends ValidationError {
  constructor() {
    super('File is empty or contains no valid data')
    this.name = 'PosImportEmptyFileError'
  }
}

export class PosImportCorruptedFileError extends ValidationError {
  constructor() {
    super('File appears to be corrupted or damaged')
    this.name = 'PosImportCorruptedFileError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PosImportDuplicateFileError extends ConflictError {
  constructor(fileName: string) {
    super(
      `File "${fileName}" has already been uploaded`,
      { conflictType: 'duplicate', fileName }
    )
    this.name = 'PosImportDuplicateFileError'
  }
}

// ============================================================================
// DATA VALIDATION ERRORS
// ============================================================================

export class PosImportMissingColumnsError extends ValidationError {
  constructor(columns: string[]) {
    super(
      `Missing required columns: ${columns.join(', ')}`,
      { requiredColumns: columns }
    )
    this.name = 'PosImportMissingColumnsError'
  }
}

export class PosImportInvalidDateFormatError extends ValidationError {
  constructor(column: string, examples: string[]) {
    super(
      `Invalid date format in column: ${column}. Use formats like: ${examples.join(', ')}`,
      { column, validFormats: examples }
    )
    this.name = 'PosImportInvalidDateFormatError'
  }
}

export class PosImportInvalidAmountError extends ValidationError {
  constructor(column: string, rowNumber?: number) {
    super(
      `Invalid amount format in column: ${column}${rowNumber ? ` at row ${rowNumber}` : ''}`,
      { column, rowNumber }
    )
    this.name = 'PosImportInvalidAmountError'
  }
}

export class PosImportInvalidRowError extends ValidationError {
  constructor(rowNumber: number, errors: string[]) {
    super(
      `Invalid row ${rowNumber}: ${errors.join('; ')}`,
      { rowNumber, errors }
    )
    this.name = 'PosImportInvalidRowError'
  }
}

export class PosImportTooManyInvalidRowsError extends ValidationError {
  constructor(invalidCount: number, totalRows: number) {
    super(
      `Too many invalid rows: ${invalidCount} out of ${totalRows}`,
      { invalidCount, totalRows, percentage: Math.round(invalidCount/totalRows*100) }
    )
    this.name = 'PosImportTooManyInvalidRowsError'
  }
}

// ============================================================================
// STATUS ERRORS
// ============================================================================

export class PosImportInvalidStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid import status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`,
      { status, validStatuses }
    )
    this.name = 'PosImportInvalidStatusError'
  }
}

export class PosImportInvalidStatusTransitionError extends BusinessRuleError {
  constructor(currentStatus: string, newStatus: string) {
    super(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      { rule: 'status_transition', currentStatus, newStatus }
    )
    this.name = 'PosImportInvalidStatusTransitionError'
  }
}

export class PosImportAlreadyAnalyzedError extends BusinessRuleError {
  constructor() {
    super('Import is already in analyzed state')
    this.name = 'PosImportAlreadyAnalyzedError'
  }
}

export class PosImportCannotCancelCompletedError extends BusinessRuleError {
  constructor() {
    super('Cannot cancel a completed import')
    this.name = 'PosImportCannotCancelCompletedError'
  }
}

// ============================================================================
// PERMISSION ERRORS
// ============================================================================

export class PosImportCompanyAccessDeniedError extends BusinessRuleError {
  constructor(companyId: string) {
    super(
      `Access denied to company ${companyId}`,
      { rule: 'company_access', companyId }
    )
    this.name = 'PosImportCompanyAccessDeniedError'
  }
}

export class PosImportPermissionDeniedError extends BusinessRuleError {
  constructor(action: string) {
    super(
      `Permission denied: ${action}`,
      { rule: 'permission', action }
    )
    this.name = 'PosImportPermissionDeniedError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class PosImportCannotDeleteCompletedError extends BusinessRuleError {
  constructor() {
    super('Cannot delete a completed import')
    this.name = 'PosImportCannotDeleteCompletedError'
  }
}

export class PosImportCannotDeleteProcessingError extends BusinessRuleError {
  constructor() {
    super('Cannot delete an import that is currently being processed')
    this.name = 'PosImportCannotDeleteProcessingError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PosImportProcessingFailedError extends DatabaseError {
  constructor(phase: string, error?: string) {
    super(
      `Import processing failed at phase: ${phase}`,
      { code: 'POS_IMPORT_PROCESSING_FAILED', context: { phase, error } }
    )
    this.name = 'PosImportProcessingFailedError'
  }
}

export class PosImportOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} POS import`,
      { code: `POS_IMPORT_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'PosImportOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PosImportErrors = {
  NOT_FOUND: (id?: string) => new PosImportNotFoundError(id),
  
  // File upload
  FILE_TOO_LARGE: (maxSizeMB: number) => new PosImportFileTooLargeError(maxSizeMB),
  INVALID_FILE_TYPE: (allowedTypes: string[]) => new PosImportInvalidFileTypeError(allowedTypes),
  EMPTY_FILE: () => new PosImportEmptyFileError(),
  CORRUPTED_FILE: () => new PosImportCorruptedFileError(),
  
  // Conflict
  DUPLICATE_FILE: (fileName: string) => new PosImportDuplicateFileError(fileName),
  
  // Data validation
  MISSING_COLUMNS: (columns: string[]) => new PosImportMissingColumnsError(columns),
  INVALID_DATE_FORMAT: (column: string, examples: string[]) => 
    new PosImportInvalidDateFormatError(column, examples),
  INVALID_AMOUNT: (column: string, rowNumber?: number) => 
    new PosImportInvalidAmountError(column, rowNumber),
  INVALID_ROW: (rowNumber: number, errors: string[]) => 
    new PosImportInvalidRowError(rowNumber, errors),
  TOO_MANY_INVALID_ROWS: (invalidCount: number, totalRows: number) => 
    new PosImportTooManyInvalidRowsError(invalidCount, totalRows),
  
  // Status
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new PosImportInvalidStatusError(status, validStatuses),
  INVALID_STATUS_TRANSITION: (currentStatus: string, newStatus: string) => 
    new PosImportInvalidStatusTransitionError(currentStatus, newStatus),
  ALREADY_ANALYZED: () => new PosImportAlreadyAnalyzedError(),
  CANNOT_CANCEL_COMPLETED: () => new PosImportCannotCancelCompletedError(),
  
  // Permission
  COMPANY_ACCESS_DENIED: (companyId: string) => new PosImportCompanyAccessDeniedError(companyId),
  PERMISSION_DENIED: (action: string) => new PosImportPermissionDeniedError(action),
  
  // Business rules
  CANNOT_DELETE_COMPLETED: () => new PosImportCannotDeleteCompletedError(),
  CANNOT_DELETE_PROCESSING: () => new PosImportCannotDeleteProcessingError(),
  
  // Database
  PROCESSING_FAILED: (phase: string, error?: string) => 
    new PosImportProcessingFailedError(phase, error),
  CREATE_FAILED: (error?: string) => new PosImportOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new PosImportOperationError('update', error),
  DELETE_FAILED: (error?: string) => new PosImportOperationError('delete', error),
  
  // Additional error factories for compatibility
  INVALID_FILE: (message?: string) => new PosImportInvalidRowError(0, [message || 'Invalid file']),
  MISSING_REQUIRED_COLUMNS: (columns: string[]) => new PosImportMissingColumnsError(columns),
  INVALID_EXCEL_FORMAT: () => new PosImportInvalidRowError(0, ['Invalid Excel file format']),
  CANNOT_DELETE_POSTED: () => new PosImportCannotDeleteCompletedError(),
}

