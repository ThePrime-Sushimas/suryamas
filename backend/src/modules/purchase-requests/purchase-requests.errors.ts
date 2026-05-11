import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class PurchaseRequestNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Purchase request ${id} not found` : 'Purchase request not found') }
}

export class PurchaseRequestDuplicateError extends ConflictError {
  constructor(number: string) { super(`Purchase request with number '${number}' already exists`) }
}

export class PurchaseRequestInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Purchase request is '${current}', expected '${expected}'`)
  }
}

export class PurchaseRequestEmptyLinesError extends BusinessRuleError {
  constructor() { super('Purchase request must have at least 1 line item') }
}
