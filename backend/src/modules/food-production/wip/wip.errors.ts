import { NotFoundError, ConflictError, BusinessRuleError } from '../../../utils/errors.base'

export class WipItemNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `WIP item ${id} not found` : 'WIP item not found') }
}

export class WipItemDuplicateError extends ConflictError {
  constructor(code: string) { super(`WIP item with code '${code}' already exists`) }
}

export class WipItemInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete WIP item that is used in active recipes') }
}
