import { NotFoundError, ConflictError, BusinessRuleError } from '../../../utils/errors.base'

export class MenuGroupNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Menu group ${id} not found` : 'Menu group not found') }
}

export class MenuGroupDuplicateError extends ConflictError {
  constructor(code: string) { super(`Menu group with code '${code}' already exists`) }
}

export class MenuGroupInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete menu group that has active menus') }
}
