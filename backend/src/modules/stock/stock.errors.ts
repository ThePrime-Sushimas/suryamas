import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class StockBalanceNotFoundError extends NotFoundError {
  constructor(warehouseId: string, productId: string) {
    super(`Stock balance not found for warehouse ${warehouseId} and product ${productId}`)
  }
}

export class InsufficientStockError extends BusinessRuleError {
  constructor(productName: string, available: number, requested: number) {
    super(`Insufficient stock for ${productName}: available ${available}, requested ${requested}`, {
      product_name: productName, available, requested
    })
  }
}

export class DuplicateOpeningBalanceError extends BusinessRuleError {
  constructor(productName: string, warehouseName: string) {
    super(`Opening balance already exists for ${productName} in ${warehouseName}`)
  }
}

export class InvalidMovementError extends BusinessRuleError {
  constructor(message: string) { super(message) }
}

export class WarehouseAccessDeniedError extends BusinessRuleError {
  constructor(warehouseId: string) {
    super(`Warehouse ${warehouseId} does not belong to your company or does not exist`)
  }
}

export class InvalidReferenceError extends BusinessRuleError {
  constructor(message: string) {
    super(`Invalid reference: ${message}`)
  }
}
