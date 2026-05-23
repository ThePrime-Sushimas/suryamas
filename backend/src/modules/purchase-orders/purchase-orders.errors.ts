import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class PurchaseOrderNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Purchase order ${id} not found` : 'Purchase order not found') }
}

export class PurchaseOrderDuplicateError extends ConflictError {
  constructor(number: string) { super(`Purchase order with number '${number}' already exists`) }
}

export class PurchaseOrderInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Purchase order is '${current}', expected '${expected}'`)
  }
}

export class PurchaseOrderEmptyLinesError extends BusinessRuleError {
  constructor() { super('Purchase order must have at least 1 line item') }
}

export class PurchaseRequestNotApprovedError extends BusinessRuleError {
  constructor(prId: string) { super(`Purchase request ${prId} is not in APPROVED status`) }
}

export class PurchaseOrderManualCreateDisabledError extends BusinessRuleError {
  constructor() {
    super('Purchase order must be created via PR Approval (Approve & Generate PO)')
  }
}

export class PurchaseOrderHasReceiptsError extends BusinessRuleError {
  constructor() { super('Cannot cancel purchase order that already has goods receipts') }
}

export class PurchaseOrderShortCloseLineNotFoundError extends NotFoundError {
  constructor(poLineId: string) {
    super(`Purchase order line ${poLineId} not found on this PO`)
  }
}

export class PurchaseOrderShortCloseQtyError extends BusinessRuleError {
  constructor(productName: string, maxQty: number, requested: number) {
    super(
      `Qty tutup sisa untuk ${productName} melebihi sisa terbuka (${maxQty}). Diminta: ${requested}`,
    )
  }
}
