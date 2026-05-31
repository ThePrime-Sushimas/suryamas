import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class StockTransferNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Stock Transfer ${id} tidak ditemukan`) }
}

export class StockTransferInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Transfer status ${current} tidak valid untuk operasi ini, butuh ${expected}`)
  }
}

export class StockTransferInsufficientStockError extends BusinessRuleError {
  constructor(productName: string, available: number, requested: number) {
    super(`Stok ${productName} tidak cukup: tersedia ${available}, dibutuhkan ${requested}`)
  }
}

export class StockTransferSameWarehouseError extends BusinessRuleError {
  constructor() {
    super('Gudang sumber dan tujuan tidak boleh sama')
  }
}
