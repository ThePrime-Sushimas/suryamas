import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class StockAdjustmentNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Stock Adjustment ${id} tidak ditemukan`) }
}

export class StockAdjustmentInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Adjustment status ${current} tidak valid untuk operasi ini, butuh ${expected}`)
  }
}

export class StockAdjustmentInsufficientStockError extends BusinessRuleError {
  constructor(productName: string, available: number, requested: number) {
    super(`Stok ${productName} tidak cukup: tersedia ${available}, dibutuhkan ${requested}`)
  }
}

export class StockAdjustmentOutputExceedsInputError extends BusinessRuleError {
  constructor() {
    super('Total output qty tidak boleh melebihi input qty')
  }
}
