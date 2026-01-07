export class ProductError extends Error {
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

export class ProductNotFoundError extends ProductError {
  constructor(id: string) {
    super('PRODUCT_NOT_FOUND', `Product with ID '${id}' not found`, 404)
  }
}

export class DuplicateProductCodeError extends ProductError {
  constructor(code: string) {
    super('DUPLICATE_PRODUCT_CODE', `Product with code '${code}' already exists`, 409)
  }
}

export class DuplicateProductNameError extends ProductError {
  constructor(name: string) {
    super('DUPLICATE_PRODUCT_NAME', `Product with name '${name}' already exists`, 409)
  }
}

export class InvalidProductStatusError extends ProductError {
  constructor(status: string, validStatuses: string[]) {
    super(
      'INVALID_PRODUCT_STATUS',
      `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
      422
    )
  }
}

export class ProductCodeUpdateError extends ProductError {
  constructor() {
    super('PRODUCT_CODE_UPDATE_FORBIDDEN', 'Product code cannot be updated', 400)
  }
}

export class BulkOperationLimitError extends ProductError {
  constructor(limit: number) {
    super(
      'BULK_OPERATION_LIMIT_EXCEEDED',
      `Bulk operation exceeds maximum limit of ${limit} items`,
      400
    )
  }
}

export class InvalidProductTypeError extends ProductError {
  constructor(type: string, validTypes: string[]) {
    super(
      'INVALID_PRODUCT_TYPE',
      `Invalid product type '${type}'. Must be one of: ${validTypes.join(', ')}`,
      422
    )
  }
}

export class InvalidAverageCostError extends ProductError {
  constructor(cost: number) {
    super(
      'INVALID_AVERAGE_COST',
      `Average cost must be >= 0, got ${cost}`,
      422
    )
  }
}

export class ProductValidationError extends ProductError {
  constructor(message: string, details?: any) {
    super('PRODUCT_VALIDATION_ERROR', message, 422, details)
  }
}
