/**
 * Bank Statement Import Errors
 * Error definitions untuk bank statement import module
 */

import { AppError, ValidationError, NotFoundError, ConflictError } from '../../../utils/error-handler.util'

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

export class BankStatementImportError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
    context?: any
  ) {
    super(message, statusCode, code, context)
    this.name = 'BankStatementImportError'
  }
}

// ============================================================================
// ERROR CODES & MESSAGES
// ============================================================================

export const BankStatementImportErrors = {
  // File errors
  FILE_TOO_LARGE: (maxSizeMB: number) => 
    new BankStatementImportError(`File too large. Maximum size is ${maxSizeMB}MB`, 400, 'BS_FILE_TOO_LARGE'),
  
  INVALID_FILE_TYPE: () => 
    new BankStatementImportError('Invalid file type. Please upload Excel file (.xlsx or .xls)', 400, 'BS_INVALID_FILE_TYPE'),
  
  NO_FILE_UPLOADED: () => 
    new BankStatementImportError('No file uploaded', 400, 'BS_NO_FILE_UPLOADED'),
  
  // Format errors
  INVALID_EXCEL_FORMAT: () => 
    new BankStatementImportError('Invalid Excel format. Could not read the file', 400, 'BS_INVALID_EXCEL_FORMAT'),
  
  MISSING_REQUIRED_COLUMNS: (columns: string[]) => 
    new ValidationError(`Missing required columns: ${columns.join(', ')}`),
  
  INVALID_DATE_FORMAT: (column: string) => 
    new ValidationError(`Invalid date format in column: ${column}. Use YYYY-MM-DD`),
  
  INVALID_AMOUNT_FORMAT: (column: string) => 
    new ValidationError(`Invalid amount format in column: ${column}. Use numeric values`),
  
  INVALID_ROW: (rowNumber: number, errors: string[]) => 
    new ValidationError(`Invalid row ${rowNumber}: ${errors.join('; ')}`, { rowNumber, errors }),
  
  EMPTY_FILE: () => 
    new ValidationError('File is empty or contains no valid data'),
  
  INVALID_FILE: (reason: string) => 
    new ValidationError(`Invalid file: ${reason}`),
  
  // Import errors
  IMPORT_NOT_FOUND: (id: number) => 
    new NotFoundError(`Bank statement import with ID ${id} not found`, { id }),
  
  INVALID_STATUS_TRANSITION: (currentStatus: string, newStatus: string) => 
    new BankStatementImportError(`Cannot transition from ${currentStatus} to ${newStatus}`, 400, 'BS_INVALID_STATUS_TRANSITION', { currentStatus, newStatus }),
  
  INVALID_STATUS: (status: string) => 
    new ValidationError(`Invalid import status: ${status}`),
  
  // Duplicate errors
  DUPLICATE_FILE: () => 
    new ConflictError('This file has already been uploaded'),
  
  DUPLICATE_TRANSACTION: (reference: string, date: string) => 
    new ConflictError(`Duplicate transaction detected: ${reference} on ${date}`, { reference, date }),
  
  // Processing errors
  PROCESSING_FAILED: (error: string) => 
    new BankStatementImportError(`Import processing failed: ${error}`, 500, 'BS_PROCESSING_FAILED', { error }),
  
  TEMPORARY_DATA_NOT_FOUND: () => 
    new ValidationError('Temporary data not found. Please re-upload the file'),
  
  // Bank account errors
  BANK_ACCOUNT_NOT_FOUND: (id: number) => 
    new NotFoundError(`Bank account with ID ${id} not found`, { id }),
  
  BANK_ACCOUNT_INACTIVE: (id: number) => 
    new BankStatementImportError(`Bank account with ID ${id} is inactive`, 400, 'BS_BANK_ACCOUNT_INACTIVE', { id }),
  
  BANK_ACCOUNT_NOT_BELONG_TO_COMPANY: (id: number, companyId: string) => 
    new BankStatementImportError(`Bank account ${id} does not belong to your company`, 403, 'BS_BANK_ACCOUNT_COMPANY_MISMATCH', { id, companyId }),
  
  // Company access errors
  COMPANY_ACCESS_DENIED: (companyId: string) => 
    new BankStatementImportError(`Access denied to company ${companyId}`, 403, 'BS_COMPANY_ACCESS_DENIED', { companyId }),
  
  // Operation errors
  CANNOT_DELETE_COMPLETED: () => 
    new BankStatementImportError('Cannot delete a completed import', 400, 'BS_CANNOT_DELETE_COMPLETED'),
  
  CANNOT_DELETE_PROCESSING: () => 
    new BankStatementImportError('Cannot delete an import that is currently being processed', 400, 'BS_CANNOT_DELETE_PROCESSING'),
  
  // Statement errors
  STATEMENT_NOT_FOUND: (id: number) => 
    new NotFoundError(`Bank statement with ID ${id} not found`, { id }),
  
  // Validation errors
  INVALID_TRANSACTION_DATE_RANGE: () => 
    new ValidationError('Invalid transaction date range'),
  
  INVALID_BANK_ACCOUNT: () => 
    new ValidationError('Invalid bank account'),
  
  // Generic errors
  CREATE_FAILED: () => 
    new BankStatementImportError('Failed to create bank statement import', 500, 'BS_CREATE_FAILED'),
  
  UPDATE_FAILED: () => 
    new BankStatementImportError('Failed to update bank statement import', 500, 'BS_UPDATE_FAILED'),
  
  DELETE_FAILED: () => 
    new BankStatementImportError('Failed to delete bank statement import', 500, 'BS_DELETE_FAILED'),
  
  IMPORT_FAILED: () => 
    new BankStatementImportError('Failed to import bank statements', 500, 'BS_IMPORT_FAILED'),
}

// ============================================================================
// ERROR CONSTANTS
// ============================================================================

export const BankStatementImportConfig = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ],
  REQUIRED_COLUMNS: ['transaction_date', 'description', 'credit_amount'],
  OPTIONAL_COLUMNS: ['transaction_time', 'reference_number', 'debit_amount', 'balance', 'transaction_type'],
  
  VALID_STATUS_TRANSITIONS: {
    'PENDING': ['ANALYZED'],
    'ANALYZED': ['IMPORTING', 'COMPLETED', 'FAILED'],
    'IMPORTING': ['COMPLETED', 'FAILED'],
    'COMPLETED': [],
    'FAILED': ['PENDING'] // Allow retry
  } as Record<string, string[]>,
  
  BATCH_SIZE: 1000, // Rows per batch insert
  
  DATE_FORMATS: [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'YYYY/MM/DD'
  ]
}