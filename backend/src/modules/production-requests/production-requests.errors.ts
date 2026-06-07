import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class ProductionRequestNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Production Request ${id} tidak ditemukan`) }
}

export class ProductionRequestInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Status ${current} tidak valid untuk operasi ini, butuh status ${expected}`)
  }
}
