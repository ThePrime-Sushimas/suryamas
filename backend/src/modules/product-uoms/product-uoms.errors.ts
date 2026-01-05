export class ProductUomError extends Error {
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

export class ProductUomNotFoundError extends ProductUomError {
  constructor(id: string) {
    super('PRODUCT_UOM_NOT_FOUND', `Product UOM with ID '${id}' not found`, 404)
  }
}

export class DuplicateUnitNameError extends ProductUomError {
  constructor(unitName: string) {
    super('DUPLICATE_UNIT_NAME', `UOM "${unitName}" already exists for this product`, 409)
  }
}

export class BaseUnitExistsError extends ProductUomError {
  constructor() {
    super('BASE_UNIT_EXISTS', 'Product already has a base unit', 409)
  }
}

export class InvalidConversionFactorError extends ProductUomError {
  constructor(message: string) {
    super('INVALID_CONVERSION_FACTOR', message, 422)
  }
}

export class InvalidUomStatusError extends ProductUomError {
  constructor(status: string, validStatuses: string[]) {
    super(
      'INVALID_UOM_STATUS',
      `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
      422
    )
  }
}

export class ProductUomValidationError extends ProductUomError {
  constructor(message: string, details?: any) {
    super('PRODUCT_UOM_VALIDATION_ERROR', message, 422, details)
  }
}
