import { NotFoundError, BusinessRuleError } from '../../../utils/errors.base'

export class RecipeMenuNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Menu ${id} not found`) }
}

export class RecipeInvalidLineError extends BusinessRuleError {
  constructor() { super('Each recipe line must have either product_id or wip_id, not both') }
}
