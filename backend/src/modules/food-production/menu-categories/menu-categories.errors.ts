import { BusinessRuleError, NotFoundError, ConflictError } from '../../../utils/errors.base'

export class MenuCategoryNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Menu category ${id} not found` : 'Menu category not found') }
}

export class MenuCategoryDuplicateError extends ConflictError {
  constructor(code: string) { super(`Menu category with code '${code}' already exists`) }
}

export class MenuCategoryInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete menu category that has menu groups or menus') }
}
