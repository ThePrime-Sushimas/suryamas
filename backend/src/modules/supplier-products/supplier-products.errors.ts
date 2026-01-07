export class SupplierProductError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class SupplierProductNotFoundError extends SupplierProductError {
  constructor(id: string) {
    super('SUPPLIER_PRODUCT_NOT_FOUND', `Supplier product with ID '${id}' not found`, 404)
  }
}

export class DuplicateSupplierProductError extends SupplierProductError {
  constructor(supplierId: number, productId: string) {
    super(
      'DUPLICATE_SUPPLIER_PRODUCT', 
      `Product '${productId}' already exists for supplier '${supplierId}'`, 
      409,
      { supplier_id: supplierId, product_id: productId }
    )
  }
}

export class InvalidSupplierError extends SupplierProductError {
  constructor(supplierId: number, reason: 'not_found' | 'inactive' | 'deleted' = 'not_found') {
    const messages = {
      not_found: `Supplier with ID '${supplierId}' not found`,
      inactive: `Supplier with ID '${supplierId}' is inactive`,
      deleted: `Supplier with ID '${supplierId}' has been deleted`
    }
    super('INVALID_SUPPLIER', messages[reason], 400, { supplier_id: supplierId, reason })
  }
}

export class InvalidProductError extends SupplierProductError {
  constructor(productId: string, reason: 'not_found' | 'inactive' | 'deleted' = 'not_found') {
    const messages = {
      not_found: `Product with ID '${productId}' not found`,
      inactive: `Product with ID '${productId}' is inactive`,
      deleted: `Product with ID '${productId}' has been deleted`
    }
    super('INVALID_PRODUCT', messages[reason], 400, { product_id: productId, reason })
  }
}

export class InvalidPriceError extends SupplierProductError {
  constructor(price: number, min: number, max: number) {
    super(
      'INVALID_PRICE', 
      `Price ${price} is invalid. Must be between ${min} and ${max}`, 
      422,
      { price, min, max }
    )
  }
}

export class InvalidCurrencyError extends SupplierProductError {
  constructor(currency: string, validCurrencies: string[]) {
    super(
      'INVALID_CURRENCY', 
      `Currency '${currency}' is not supported. Valid currencies: ${validCurrencies.join(', ')}`, 
      422,
      { currency, valid_currencies: validCurrencies }
    )
  }
}

export class BulkOperationLimitError extends SupplierProductError {
  constructor(limit: number, attempted: number) {
    super(
      'BULK_OPERATION_LIMIT_EXCEEDED',
      `Bulk operation limit exceeded. Maximum ${limit} items, attempted ${attempted}`,
      400,
      { limit, attempted }
    )
  }
}

export class MaxPreferredSuppliersError extends SupplierProductError {
  constructor(productId: string, maxAllowed: number) {
    super(
      'MAX_PREFERRED_SUPPLIERS_EXCEEDED',
      `Product '${productId}' already has maximum ${maxAllowed} preferred suppliers`,
      422,
      { product_id: productId, max_allowed: maxAllowed }
    )
  }
}

export class SupplierProductValidationError extends SupplierProductError {
  constructor(message: string, details?: any) {
    super('SUPPLIER_PRODUCT_VALIDATION_ERROR', message, 422, details)
  }
}