export class FiscalPeriodError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'FiscalPeriodError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export const FiscalPeriodErrors = {
  NOT_FOUND: (id: string) =>
    new FiscalPeriodError(
      `Fiscal period with ID ${id} not found`,
      'FISCAL_PERIOD_NOT_FOUND',
      404
    ),

  PERIOD_EXISTS: (period: string, companyId: string) =>
    new FiscalPeriodError(
      `Period ${period} already exists for this company`,
      'FISCAL_PERIOD_EXISTS',
      409
    ),

  INVALID_PERIOD_FORMAT: () =>
    new FiscalPeriodError(
      'Period format must be YYYY-MM (e.g., 2024-01)',
      'INVALID_PERIOD_FORMAT',
      400
    ),

  INVALID_DATE_RANGE: () =>
    new FiscalPeriodError(
      'Period start date must be before or equal to end date',
      'INVALID_DATE_RANGE',
      400
    ),

  PERIOD_ALREADY_CLOSED: () =>
    new FiscalPeriodError(
      'Period is already closed',
      'PERIOD_ALREADY_CLOSED',
      409
    ),

  CANNOT_REOPEN_PERIOD: () =>
    new FiscalPeriodError(
      'Period is already closed and cannot be reopened',
      'CANNOT_REOPEN_PERIOD',
      400
    ),

  PERIOD_IN_USE: (period: string) =>
    new FiscalPeriodError(
      `Period ${period} is being used by journal entries and cannot be deleted`,
      'PERIOD_IN_USE',
      400
    ),

  VALIDATION_ERROR: (field: string, message: string) =>
    new FiscalPeriodError(
      message,
      `VALIDATION_ERROR_${field.toUpperCase()}`,
      400
    ),

  BULK_OPERATION_LIMIT_EXCEEDED: (operation: string, limit: number, actual: number) =>
    new FiscalPeriodError(
      `Bulk ${operation} limit exceeded. Maximum: ${limit}, Requested: ${actual}`,
      'BULK_OPERATION_LIMIT_EXCEEDED',
      400
    ),

  REPOSITORY_ERROR: (operation: string, error: Error) =>
    new FiscalPeriodError(
      'An unexpected error occurred while processing fiscal period data',
      `REPOSITORY_ERROR_${operation.toUpperCase()}`,
      500
    )
}
