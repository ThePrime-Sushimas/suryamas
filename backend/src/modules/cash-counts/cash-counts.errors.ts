import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BusinessRuleError,
  DatabaseError,
} from '../../utils/errors.base'

export class CashCountNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('cash_count', id)
    this.name = 'CashCountNotFoundError'
  }
}

export class CashCountDuplicatePeriodError extends ConflictError {
  constructor() {
    super(
      'Cash count untuk periode, cabang, dan payment method ini sudah ada',
      { conflictType: 'duplicate' }
    )
    this.name = 'CashCountDuplicatePeriodError'
  }
}

export class CashCountInvalidStatusError extends BusinessRuleError {
  constructor(currentStatus: string, expectedStatus: string) {
    super(
      `Cash count status harus ${expectedStatus}, saat ini ${currentStatus}`,
      { rule: 'invalid_status_transition', currentStatus, expectedStatus }
    )
    this.name = 'CashCountInvalidStatusError'
  }
}

export class CashCountInvalidDateRangeError extends ValidationError {
  constructor() {
    super('Tanggal akhir harus >= tanggal awal', { field: 'end_date' })
    this.name = 'CashCountInvalidDateRangeError'
  }
}

export class CashCountDeficitRequiresEmployeeError extends ValidationError {
  constructor() {
    super(
      'Deficit (selisih kurang) wajib mengisi responsible_employee_id',
      { field: 'responsible_employee_id' }
    )
    this.name = 'CashCountDeficitRequiresEmployeeError'
  }
}

export class CashCountOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Gagal ${operation} cash count`,
      { code: `CASH_COUNT_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'CashCountOperationError'
  }
}
