import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class WarehouseNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Warehouse ${id} not found` : 'Warehouse not found') }
}

export class WarehouseDuplicateError extends ConflictError {
  constructor(code: string) { super(`Warehouse with code '${code}' already exists`) }
}

export class WarehouseInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete warehouse that has stock balances or movements') }
}
