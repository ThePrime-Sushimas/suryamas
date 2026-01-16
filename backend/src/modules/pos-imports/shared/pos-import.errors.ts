/**
 * POS Import Errors
 * Following journal-headers.errors.ts pattern
 */

export class PosImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PosImportError'
  }
}

export const PosImportErrors = {
  NOT_FOUND: () => new PosImportError(
    'POS import not found',
    'POS_IMPORT_NOT_FOUND',
    404
  ),

  INVALID_FILE: (message: string) => new PosImportError(
    `Invalid file: ${message}`,
    'INVALID_FILE'
  ),

  INVALID_STATUS_TRANSITION: (from: string, to: string) => new PosImportError(
    `Cannot change status from ${from} to ${to}`,
    'INVALID_STATUS_TRANSITION'
  ),

  BRANCH_MISMATCH: (excelBranch: string, selectedBranch: string) => new PosImportError(
    `Branch mismatch: Excel has "${excelBranch}", but you selected "${selectedBranch}"`,
    'BRANCH_MISMATCH'
  ),

  ALREADY_POSTED: () => new PosImportError(
    'Import is already posted',
    'ALREADY_POSTED'
  ),

  CANNOT_DELETE_POSTED: () => new PosImportError(
    'Cannot delete posted import',
    'CANNOT_DELETE_POSTED'
  ),

  DUPLICATE_TRANSACTION: (billNumber: string, salesNumber: string) => new PosImportError(
    `Transaction already exists: Bill ${billNumber}, Sales ${salesNumber}`,
    'DUPLICATE_TRANSACTION',
    409
  ),

  FILE_TOO_LARGE: (maxSize: number) => new PosImportError(
    `File size exceeds maximum allowed size of ${maxSize}MB`,
    'FILE_TOO_LARGE',
    413
  ),

  INVALID_EXCEL_FORMAT: () => new PosImportError(
    'Invalid Excel file format. Please upload a valid .xlsx or .xls file',
    'INVALID_EXCEL_FORMAT'
  ),

  MISSING_REQUIRED_COLUMNS: (columns: string[]) => new PosImportError(
    `Missing required columns: ${columns.join(', ')}`,
    'MISSING_REQUIRED_COLUMNS'
  ),

  IMPORT_IN_PROGRESS: () => new PosImportError(
    'Import is already in progress',
    'IMPORT_IN_PROGRESS',
    409
  )
}
