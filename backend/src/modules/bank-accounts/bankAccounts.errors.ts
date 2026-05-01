/**
 * Bank Accounts Error Classes
 * Module-specific error classes untuk bank accounts operations
 */

import { 
  NotFoundError, 
  ConflictError, 
  ValidationError, 
  BusinessRuleError 
} from '../../utils/errors.base'

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class BankAccountNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('bank_account', id)
    this.name = 'BankAccountNotFoundError'
  }
}

export class BankNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('bank', id)
    this.name = 'BankNotFoundError'
  }
}

export class CoaAccountNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('coa_account', id)
    this.name = 'CoaAccountNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS  
// ============================================================================

export class DuplicateBankAccountError extends ConflictError {
  constructor(accountNumber: string, bankId?: string) {
    super(
      `Account number '${accountNumber}' already exists for this bank`,
      { conflictType: 'duplicate', accountNumber, bankId }
    )
    this.name = 'DuplicateBankAccountError'
  }
}

export class DuplicateBankAccountHolderError extends ConflictError {
  constructor(holderId: string, holderType: string) {
    super(
      `Bank account holder '${holderId}' already has an active bank account`,
      { conflictType: 'duplicate', holderId, holderType }
    )
    this.name = 'DuplicateBankAccountHolderError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidOwnerError extends ValidationError {
  constructor(ownerType: string, ownerId: string) {
    super(`Invalid ${ownerType} with ID ${ownerId}`, {
      ownerType,
      ownerId
    })
    this.name = 'InvalidOwnerError'
  }
}

export class InvalidOwnerTypeError extends ValidationError {
  constructor(ownerType: string, validTypes?: string[]) {
    super(`Invalid owner type: ${ownerType}`, {
      ownerType,
      validTypes
    })
    this.name = 'InvalidOwnerTypeError'
  }
}

export class InvalidAccountNumberError extends ValidationError {
  constructor(accountNumber: string, reason?: string) {
    super(`Invalid account number format: ${accountNumber}`, {
      accountNumber,
      reason
    })
    this.name = 'InvalidAccountNumberError'
  }
}

export class InvalidCurrencyError extends ValidationError {
  constructor(currency: string) {
    super(`Unsupported currency: ${currency}`, { currency })
    this.name = 'InvalidCurrencyError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class OwnerDeletedError extends BusinessRuleError {
  constructor(ownerType: string, ownerId: string) {
    super(
      `${ownerType} with ID ${ownerId} has been deleted and cannot have bank accounts`,
      { 
        rule: 'owner_not_deleted',
        ownerType, 
        ownerId 
      }
    )
    this.name = 'OwnerDeletedError'
  }
}

export class BankNotActiveError extends BusinessRuleError {
  constructor(bankId: number, bankName?: string) {
    super(
      `Bank with ID ${bankId} is not active`,
      { 
        rule: 'bank_active',
        bankId,
        bankName 
      }
    )
    this.name = 'BankNotActiveError'
  }
}

export class BankAccountNotActiveError extends BusinessRuleError {
  constructor(accountNumber: string, status: string) {
    super(
      `Bank account '${accountNumber}' is ${status} and cannot be used`,
      {
        rule: 'account_active',
        accountNumber,
        status
      }
    )
    this.name = 'BankAccountNotActiveError'
  }
}

export class CannotDeletePrimaryAccountError extends BusinessRuleError {
  constructor(accountNumber: string, ownerType: string, ownerId: string) {
    super(
      `Cannot delete primary bank account '${accountNumber}' for ${ownerType} ${ownerId}`,
      {
        rule: 'primary_account_deletion',
        accountNumber,
        ownerType,
        ownerId
      }
    )
    this.name = 'CannotDeletePrimaryAccountError'
  }
}

export class DuplicatePrimaryAccountError extends BusinessRuleError {
  constructor(ownerType: string, ownerId: string) {
    super(
      `${ownerType} ${ownerId} already has a primary bank account`,
      {
        rule: 'single_primary_account',
        ownerType,
        ownerId
      }
    )
    this.name = 'DuplicatePrimaryAccountError'
  }
}

export class CoaAccountNotActiveError extends BusinessRuleError {
  constructor(coaAccountId: string) {
    super(
      `COA account with ID ${coaAccountId} is not active`,
      { rule: 'coa_active', coaAccountId }
    )
    this.name = 'CoaAccountNotActiveError'
  }
}

export class CoaAccountInvalidTypeError extends BusinessRuleError {
  constructor(coaAccountId: string, accountType: string) {
    super(
      `Bank account should be linked to an ASSET type COA account, got ${accountType}`,
      { rule: 'coa_asset_type', coaAccountId, accountType }
    )
    this.name = 'CoaAccountInvalidTypeError'
  }
}

export class OwnerClosedError extends BusinessRuleError {
  constructor(ownerType: string, ownerId: string) {
    super(
      `${ownerType} with ID ${ownerId} is closed and cannot have bank accounts`,
      { rule: 'owner_not_closed', ownerType, ownerId }
    )
    this.name = 'OwnerClosedError'
  }
}

