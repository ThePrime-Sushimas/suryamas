import { BusinessRuleError, NotFoundError } from '@/utils/errors.base'

export class FeeDiscrepancyNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Fee discrepancy ${id} not found`)
  }
}

export class FeeDiscrepancyAlreadyCorrectedError extends BusinessRuleError {
  constructor(id: string) {
    super(`Fee discrepancy ${id} sudah dikoreksi`)
  }
}
