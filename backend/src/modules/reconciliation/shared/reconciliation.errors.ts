// Reconciliation Module Errors

export class ReconciliationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

// Settlement Import Errors
export class SettlementImportError extends ReconciliationError {
  constructor(message: string, details?: any) {
    super(message, 'SETTLEMENT_IMPORT_ERROR', 400, details);
    this.name = 'SettlementImportError';
  }
}

export class DuplicateSettlementError extends SettlementImportError {
  constructor(filename: string, hash: string) {
    super(
      `Settlement file ${filename} has already been imported`,
      { filename, hash }
    );
    this.name = 'DuplicateSettlementError';
  }
}

export class InvalidSettlementFormatError extends SettlementImportError {
  constructor(expectedColumns: string[], foundColumns: string[]) {
    super(
      `Invalid settlement format. Expected columns: ${expectedColumns.join(', ')}, found: ${foundColumns.join(', ')}`,
      { expectedColumns, foundColumns }
    );
    this.name = 'InvalidSettlementFormatError';
  }
}

// Bank Statement Import Errors
export class BankStatementImportError extends ReconciliationError {
  constructor(message: string, details?: any) {
    super(message, 'BANK_STATEMENT_IMPORT_ERROR', 400, details);
    this.name = 'BankStatementImportError';
  }
}

export class InvalidBankStatementFormatError extends BankStatementImportError {
  constructor(config: any, error: string) {
    super(
      `Invalid bank statement format: ${error}`,
      { config, error }
    );
    this.name = 'InvalidBankStatementFormatError';
  }
}

export class BankAccountNotFoundError extends BankStatementImportError {
  constructor(bankAccountId: string) {
    super(
      `Bank account ${bankAccountId} not found`,
      { bankAccountId }
    );
    this.name = 'BankAccountNotFoundError';
  }
}

// Reconciliation Processing Errors
export class ReconciliationProcessingError extends ReconciliationError {
  constructor(message: string, details?: any) {
    super(message, 'RECONCILIATION_PROCESSING_ERROR', 500, details);
    this.name = 'ReconciliationProcessingError';
  }
}

export class MatchingEngineError extends ReconciliationProcessingError {
  constructor(message: string, settlementId?: string, statementId?: string) {
    super(
      `Matching engine error: ${message}`,
      { settlementId, statementId }
    );
    this.name = 'MatchingEngineError';
  }
}

export class FeeCalculationError extends ReconciliationProcessingError {
  constructor(message: string, settlementId: string, feeType?: string) {
    super(
      `Fee calculation error: ${message}`,
      { settlementId, feeType }
    );
    this.name = 'FeeCalculationError';
  }
}

// Manual Review Errors
export class ManualReviewError extends ReconciliationError {
  constructor(message: string, details?: any) {
    super(message, 'MANUAL_REVIEW_ERROR', 400, details);
    this.name = 'ManualReviewError';
  }
}

export class ReviewNotFoundError extends ManualReviewError {
  constructor(reviewId: string) {
    super(
      `Review ${reviewId} not found`,
      { reviewId }
    );
    this.name = 'ReviewNotFoundError';
  }
}

export class UnauthorizedReviewActionError extends ManualReviewError {
  constructor(userId: string, action: string) {
    super(
      `User ${userId} is not authorized to perform ${action}`,
      { userId, action }
    );
    this.name = 'UnauthorizedReviewActionError';
  }
}

// Permission Errors
export class ReconciliationPermissionError extends ReconciliationError {
  constructor(message: string, requiredPermission?: string) {
    super(message, 'RECONCILIATION_PERMISSION_ERROR', 403, { requiredPermission });
    this.name = 'ReconciliationPermissionError';
  }
}

// Validation Errors
export class ReconciliationValidationError extends ReconciliationError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'RECONCILIATION_VALIDATION_ERROR', 400, { field, value });
    this.name = 'ReconciliationValidationError';
  }
}

export class InvalidReconciliationStatusError extends ReconciliationValidationError {
  constructor(currentStatus: string, attemptedStatus: string, allowedStatuses: string[]) {
    super(
      `Cannot change status from ${currentStatus} to ${attemptedStatus}. Allowed transitions: ${allowedStatuses.join(', ')}`,
      'status',
      { currentStatus, attemptedStatus, allowedStatuses }
    );
    this.name = 'InvalidReconciliationStatusError';
  }
}

// Database Errors
export class ReconciliationDatabaseError extends ReconciliationError {
  constructor(message: string, operation?: string, table?: string) {
    super(message, 'RECONCILIATION_DATABASE_ERROR', 500, { operation, table });
    this.name = 'ReconciliationDatabaseError';
  }
}

// External Service Errors
export class ExternalServiceError extends ReconciliationError {
  constructor(service: string, message: string, details?: any) {
    super(
      `External service ${service} error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { service, ...details }
    );
    this.name = 'ExternalServiceError';
  }
}

// File Processing Errors
export class FileProcessingError extends ReconciliationError {
  constructor(message: string, filename?: string, details?: any) {
    super(message, 'FILE_PROCESSING_ERROR', 400, { filename, ...details });
    this.name = 'FileProcessingError';
  }
}

export class FileTooLargeError extends FileProcessingError {
  constructor(filename: string, size: number, maxSize: number) {
    super(
      `File ${filename} is too large (${size} bytes). Maximum allowed: ${maxSize} bytes`,
      filename,
      { size, maxSize }
    );
    this.name = 'FileTooLargeError';
  }
}

export class UnsupportedFileTypeError extends FileProcessingError {
  constructor(filename: string, mimeType: string, supportedTypes: string[]) {
    super(
      `File type ${mimeType} is not supported for ${filename}. Supported types: ${supportedTypes.join(', ')}`,
      filename,
      { mimeType, supportedTypes }
    );
    this.name = 'UnsupportedFileTypeError';
  }
}

// Job Processing Errors
export class JobProcessingError extends ReconciliationError {
  constructor(message: string, jobId?: string, details?: any) {
    super(message, 'JOB_PROCESSING_ERROR', 500, { jobId, ...details });
    this.name = 'JobProcessingError';
  }
}

export class JobTimeoutError extends JobProcessingError {
  constructor(jobId: string, timeout: number) {
    super(
      `Job ${jobId} timed out after ${timeout}ms`,
      jobId,
      { timeout }
    );
    this.name = 'JobTimeoutError';
  }
}

// Notification Errors
export class NotificationError extends ReconciliationError {
  constructor(message: string, recipient?: string, details?: any) {
    super(message, 'NOTIFICATION_ERROR', 500, { recipient, ...details });
    this.name = 'NotificationError';
  }
}

// Helper function to create error responses
export function createErrorResponse(error: ReconciliationError) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
}

// Error code mappings for HTTP status codes
export const ERROR_STATUS_MAP: Record<string, number> = {
  SETTLEMENT_IMPORT_ERROR: 400,
  BANK_STATEMENT_IMPORT_ERROR: 400,
  RECONCILIATION_PROCESSING_ERROR: 500,
  MANUAL_REVIEW_ERROR: 400,
  RECONCILIATION_PERMISSION_ERROR: 403,
  RECONCILIATION_VALIDATION_ERROR: 400,
  RECONCILIATION_DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
  FILE_PROCESSING_ERROR: 400,
  JOB_PROCESSING_ERROR: 500,
  NOTIFICATION_ERROR: 500
};
