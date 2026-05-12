import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class GoodsReceiptNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Goods receipt ${id} not found` : 'Goods receipt not found') }
}

export class GoodsReceiptDuplicateError extends ConflictError {
  constructor(number: string) { super(`Goods receipt with number '${number}' already exists`) }
}

export class GoodsReceiptAlreadyConfirmedError extends BusinessRuleError {
  constructor() { super('Goods receipt is already confirmed') }
}

export class GoodsReceiptInvalidPOStatusError extends BusinessRuleError {
  constructor(poStatus: string) { super(`Cannot create GR: PO status is '${poStatus}', expected ORDERED or PARTIAL_RECEIVED`) }
}

export class GoodsReceiptExceedsOrderedError extends BusinessRuleError {
  constructor(productName: string, ordered: number, alreadyReceived: number, thisReceive: number) {
    super(`${productName}: qty received (${alreadyReceived} + ${thisReceive}) exceeds qty ordered (${ordered})`)
  }
}

export class GoodsReceiptInvoiceRequiredError extends BusinessRuleError {
  constructor() { super('Upload lampiran invoice terlebih dahulu sebelum konfirmasi') }
}

export class GoodsReceiptAttachmentNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Attachment ${id} not found` : 'Attachment not found') }
}
