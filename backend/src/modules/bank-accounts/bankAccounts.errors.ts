import { NotFoundError, ConflictError, ValidationError, BusinessRuleError } from '../../utils/error-handler.util'

export class BankAccountNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super(
      id ? `Bank account with ID ${id} not found` : 'Bank account not found',
      id ? { bankAccountId: id } : undefined
    )
  }
}

export class DuplicateBankAccountError extends ConflictError {
  constructor(accountNumber: string) {
    super(
      `Account number '${accountNumber}' already exists for this bank`,
      { accountNumber }
    )
  }
}

export class InvalidOwnerError extends ValidationError {
  constructor(ownerType: string, ownerId: number) {
    super(`Invalid ${ownerType} with ID ${ownerId}`, { ownerType, ownerId })
  }
}

export class InvalidOwnerTypeError extends ValidationError {
  constructor(ownerType: string) {
    super(`Invalid owner type: ${ownerType}`, { ownerType })
  }
}

export class OwnerDeletedError extends BusinessRuleError {
  constructor(ownerType: string, ownerId: number) {
    super(
      `${ownerType} with ID ${ownerId} has been deleted and cannot have bank accounts`,
      { ownerType, ownerId }
    )
  }
}

export class BankNotActiveError extends BusinessRuleError {
  constructor(bankId: number) {
    super(`Bank with ID ${bankId} is not active`, { bankId })
  }
}
