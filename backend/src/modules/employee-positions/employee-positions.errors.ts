import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class EmployeePositionNotFoundError extends NotFoundError {
  constructor() { super('Position assignment tidak ditemukan') }
}

export class EmployeePositionDuplicateError extends ConflictError {
  constructor() { super('Employee sudah memiliki position ini') }
}

export class CannotRemoveLastPositionError extends BusinessRuleError {
  constructor() { super('Tidak bisa menghapus position terakhir. Employee harus punya minimal 1 position.') }
}

export class PrimaryPositionConflictError extends BusinessRuleError {
  constructor() { super('Employee sudah memiliki primary position. Set primary yang lama ke false dulu, atau gunakan endpoint set-primary.') }
}
