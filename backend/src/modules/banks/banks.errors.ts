import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/error-handler.util'

export class BankNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super(
      id ? `Bank with ID ${id} not found` : 'Bank not found',
      id ? { bankId: id } : undefined
    )
  }
}

export class BankCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(`Bank code '${code}' already exists`, { bankCode: code })
  }
}

export class BankInUseError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Bank ${id} cannot be deleted as it is being used in bank accounts`,
      { bankId: id }
    )
  }
}

export class BankAlreadyInactiveError extends BusinessRuleError {
  constructor(id: string) {
    super(`Bank ${id} is already inactive`, { bankId: id })
  }
}
