export class PricelistNotFoundError extends Error {
  statusCode = 404
  
  constructor(id?: string) {
    super(id ? `Pricelist with ID ${id} not found` : 'Pricelist not found')
    this.name = 'PricelistNotFoundError'
  }
}

export class DuplicateActivePricelistError extends Error {
  statusCode = 409
  
  constructor() {
    super('Active pricelist already exists for this supplier, product, and UOM combination')
    this.name = 'DuplicateActivePricelistError'
  }
}

export class InvalidDateRangeError extends Error {
  statusCode = 422
  
  constructor() {
    super('valid_to must be greater than or equal to valid_from')
    this.name = 'InvalidDateRangeError'
  }
}

export class InvalidStatusTransitionError extends Error {
  statusCode = 422
  
  constructor(from: string, to: string) {
    super(`Cannot transition from ${from} to ${to}`)
    this.name = 'InvalidStatusTransitionError'
  }
}

export class PricelistNotDraftError extends Error {
  statusCode = 422
  
  constructor() {
    super('Only DRAFT pricelists can be approved or rejected')
    this.name = 'PricelistNotDraftError'
  }
}

export class PricelistNotApprovedError extends Error {
  statusCode = 422
  
  constructor() {
    super('Only APPROVED pricelists can be used for PO')
    this.name = 'PricelistNotApprovedError'
  }
}

export class DuplicateRestoreError extends Error {
  statusCode = 409
  
  constructor() {
    super('Cannot restore: Another active pricelist exists for this supplier-product-UOM combination')
    this.name = 'DuplicateRestoreError'
  }
}
