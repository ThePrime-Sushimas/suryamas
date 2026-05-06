import { NotFoundError, ConflictError, BusinessRuleError } from '../../../utils/errors.base'

export class MenuNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Menu ${id} not found` : 'Menu not found') }
}

export class MenuDuplicateError extends ConflictError {
  constructor(code: string) { super(`Menu with code '${code}' already exists`) }
}

export class MenuInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete menu that has active recipes or COGS calculations') }
}
