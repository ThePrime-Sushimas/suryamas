import { NotFoundError, ConflictError, BusinessRuleError } from '../../../utils/errors.base'

export class MenuBranchPriceNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Menu branch price ${id} not found` : 'Menu branch price not found') }
}

export class MenuBranchPriceDuplicateError extends ConflictError {
  constructor() { super('Active price already exists for this menu + branch + price_type combination') }
}

export class MenuBranchPriceSyncError extends BusinessRuleError {
  constructor(msg: string) { super(`Sync from POS failed: ${msg}`) }
}
