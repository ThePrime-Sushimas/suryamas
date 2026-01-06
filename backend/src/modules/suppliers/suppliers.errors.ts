export class SupplierNotFoundError extends Error {
  statusCode = 404
  
  constructor(id?: string) {
    super(id ? `Supplier with ID ${id} not found` : 'Supplier not found')
    this.name = 'SupplierNotFoundError'
  }
}

export class SupplierCodeAlreadyExistsError extends Error {
  statusCode = 409
  
  constructor(code: string) {
    super(`Supplier code '${code}' already exists`)
    this.name = 'SupplierCodeAlreadyExistsError'
  }
}

export class SupplierInUseError extends Error {
  statusCode = 409
  
  constructor(id: string) {
    super(`Supplier ${id} cannot be deleted as it is being used in procurement`)
    this.name = 'SupplierInUseError'
  }
}