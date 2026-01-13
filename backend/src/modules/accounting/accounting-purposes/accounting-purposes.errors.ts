export class AccountingPurposeError extends Error {
  constructor(
    message: string, 
    public statusCode: number = 400, 
    public code: string = 'ACCOUNTING_PURPOSE_ERROR',
    public category: 'CLIENT_ERROR' | 'SERVER_ERROR' = 'CLIENT_ERROR',
    public cause?: Error
  ) {
    super(message)
    this.name = 'AccountingPurposeError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export const AccountingPurposeErrors = {
  NOT_FOUND: (id: string) => new AccountingPurposeError(
    `Accounting purpose with ID ${id} not found. Please verify the ID and try again.`, 
    404, 
    'PURPOSE_NOT_FOUND',
    'CLIENT_ERROR'
  ),
  
  CODE_EXISTS: (code: string, companyId: string) => new AccountingPurposeError(
    `Purpose code '${code}' already exists in this company. Please use a different code.`, 
    409, 
    'PURPOSE_CODE_EXISTS',
    'CLIENT_ERROR'
  ),
  
  SYSTEM_PURPOSE_READONLY: () => new AccountingPurposeError(
    'System purposes are read-only and cannot be modified or deleted. Please contact your administrator if changes are needed.', 
    403, 
    'SYSTEM_PURPOSE_READONLY',
    'CLIENT_ERROR'
  ),
  
  COMPANY_ACCESS_DENIED: (companyId: string) => new AccountingPurposeError(
    `Access denied to company ${companyId}. Please verify your permissions.`, 
    403, 
    'COMPANY_ACCESS_DENIED',
    'CLIENT_ERROR'
  ),
  
  INVALID_APPLIED_TO: (appliedTo: string) => new AccountingPurposeError(
    `Invalid applied_to value: ${appliedTo}. Must be one of: SALES, PURCHASE, CASH, BANK, INVENTORY.`, 
    400, 
    'INVALID_APPLIED_TO',
    'CLIENT_ERROR'
  ),
  
  CREATE_FAILED: (cause?: Error) => new AccountingPurposeError(
    'Failed to create accounting purpose. Please try again or contact support if the problem persists.', 
    500, 
    'CREATE_FAILED',
    'SERVER_ERROR',
    cause
  ),
  
  UPDATE_FAILED: (cause?: Error) => new AccountingPurposeError(
    'Failed to update accounting purpose. Please try again or contact support if the problem persists.', 
    500, 
    'UPDATE_FAILED',
    'SERVER_ERROR',
    cause
  ),

  REPOSITORY_ERROR: (operation: string, cause?: Error) => new AccountingPurposeError(
    `Database operation '${operation}' failed. Please try again or contact support if the problem persists.`,
    500,
    'REPOSITORY_ERROR',
    'SERVER_ERROR',
    cause
  ),

  VALIDATION_ERROR: (field: string, message: string) => new AccountingPurposeError(
    `Validation failed for field '${field}': ${message}`,
    400,
    'VALIDATION_ERROR',
    'CLIENT_ERROR'
  ),

  BULK_OPERATION_LIMIT_EXCEEDED: (operation: string, limit: number, actual: number) => new AccountingPurposeError(
    `Bulk ${operation} operation limit exceeded. Maximum allowed: ${limit}, requested: ${actual}.`,
    400,
    'BULK_OPERATION_LIMIT_EXCEEDED',
    'CLIENT_ERROR'
  )
}