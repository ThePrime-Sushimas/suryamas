/**
 * Banks Module Error Classes
 * Module-specific error classes untuk banks operations
 */

import { 
  NotFoundError, 
  ConflictError, 
  BusinessRuleError 
} from '../../utils/errors.base'

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class BankNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('bank', id)
    this.name = 'BankNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class BankCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Bank code '${code}' already exists`,
      { conflictType: 'duplicate', bankCode: code }
    )
    this.name = 'BankCodeAlreadyExistsError'
  }
}

export class BankNameAlreadyExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Bank name '${name}' already exists`,
      { conflictType: 'duplicate', bankName: name }
    )
    this.name = 'BankNameAlreadyExistsError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class BankInUseError extends BusinessRuleError {
  constructor(id: string | number, bankName?: string) {
    super(
      `Bank '${bankName || id}' cannot be deleted as it is being used in bank accounts`,
      { rule: 'bank_in_use', bankId: id, bankName }
    )
    this.name = 'BankInUseError'
  }
}

export class BankAlreadyInactiveError extends BusinessRuleError {
  constructor(id: string | number, bankName?: string) {
    super(
      `Bank '${bankName || id}' is already inactive`,
      { rule: 'bank_status', bankId: id, bankName, currentState: 'inactive' }
    )
    this.name = 'BankAlreadyInactiveError'
  }
}

export class BankAlreadyActiveError extends BusinessRuleError {
  constructor(id: string | number, bankName?: string) {
    super(
      `Bank '${bankName || id}' is already active`,
      { rule: 'bank_status', bankId: id, bankName, currentState: 'active' }
    )
    this.name = 'BankAlreadyActiveError'
  }
}

export class CannotDeleteDefaultBankError extends BusinessRuleError {
  constructor(bankName: string) {
    super(
      `Cannot delete default bank '${bankName}'`,
      { rule: 'default_bank_deletion', bankName }
    )
    this.name = 'CannotDeleteDefaultBankError'
  }
}

