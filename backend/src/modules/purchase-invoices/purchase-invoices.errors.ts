import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'
import type { UnpostPricelistBlockedItem } from '../pricelists/pricelists.types'

export class PurchaseInvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Purchase invoice', id)
  }
}

export class PurchaseInvoiceInvalidStatusError extends BusinessRuleError {
  constructor(actual: string, expected: string) {
    super(`Invalid purchase invoice status: expected ${expected} but got ${actual}`)
  }
}

export class PurchaseInvoiceCannotEditPostedError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice cannot be edited after posted')
  }
}

export class PurchaseInvoiceGrNotEligibleError extends BusinessRuleError {
  constructor(detail?: string) {
    super(detail ?? 'Goods receipt not eligible for purchase invoice')
  }
}

export class PurchaseInvoiceJournalAlreadyExistsError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice already posted (journal exists)')
  }
}

export class PurchaseInvoiceNotPostedError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice is not posted — nothing to unpost')
  }
}

export class PurchaseInvoiceNoJournalError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice has no linked journal')
  }
}

/** TODO(purchase-payments): block unpost when linked payments exist — module belum ada. */
// export class PurchaseInvoiceHasPaymentsError extends BusinessRuleError {
//   constructor() {
//     super('Cannot unpost: payment already recorded against this invoice')
//   }
// }

export class PurchaseInvoiceGpNotConfirmedError extends BusinessRuleError {
  constructor(gpNumber: string) {
    super(`Cannot post: Goods Processing ${gpNumber} is not CONFIRMED`)
  }
}

export class PurchaseInvoiceMixedAssetLinesError extends BusinessRuleError {
  constructor() {
    super(
      'Tidak dapat posting: invoice ini berisi campuran produk asset dan non-asset. ' +
      'Hubungi admin untuk memisahkan data (kemungkinan data lama sebelum pemisahan jalur asset).'
    )
  }
}

export class PurchaseInvoiceChargesInvalidError extends BusinessRuleError {
  constructor(message: string) {
    super(message)
  }
}

export class PurchaseInvoicePricelistSupersededError extends ConflictError {
  constructor(blocked: UnpostPricelistBlockedItem[]) {
    const lines = blocked.map((b) => {
      const suffix = b.superseding_invoice_number
        ? ` Invoice ${b.superseding_invoice_number}`
        : ''
      return `${b.product_name} (${b.uom_name}): harga sudah diupdate${suffix} — unpost dibatalkan.`
    })
    super(lines.join(' '), { blocked_items: blocked })
    this.name = 'PurchaseInvoicePricelistSupersededError'
  }
}

export class PurchaseInvoicePlaceholderNumberError extends BusinessRuleError {
  constructor() {
    super(
      'Nomor invoice masih placeholder staging. Isi nomor invoice supplier yang sebenarnya sebelum submit.',
    )
  }
}

export class PurchaseInvoiceSplitValidationError extends BusinessRuleError {
  constructor(message: string) {
    super(message)
  }
}

export class PurchaseInvoiceGrLineOverAllocatedError extends BusinessRuleError {
  constructor(grLineId: string, detail?: string) {
    super(
      detail ??
        `Baris GR ${grLineId} melebihi qty yang tersedia untuk di-invoice (sudah dialokasi di invoice lain).`,
    )
  }
}

export class PurchaseInvoiceDuplicateNumberError extends ConflictError {
  constructor(invoiceNumber: string) {
    super(`Nomor invoice supplier "${invoiceNumber}" sudah digunakan untuk supplier ini.`)
  }
}

export class PurchaseInvoiceHasChargesError extends BusinessRuleError {
  constructor() {
    super(
      'Invoice masih memiliki baris charge (diskon/ongkir). Hapus atau alokasikan charge manual sebelum pecah invoice.',
    )
  }
}
