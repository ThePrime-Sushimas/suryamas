import { NotFoundError, BusinessRuleError } from '../../../utils/errors.base'

export class ProductionOrderNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Production order ${id} tidak ditemukan` : 'Production order tidak ditemukan') }
}

export class ProductionOrderNotDraftError extends BusinessRuleError {
  constructor() { super('Order harus berstatus DRAFT untuk operasi ini') }
}

export class ProductionOrderNotCompletedError extends BusinessRuleError {
  constructor() { super('Order harus berstatus COMPLETED untuk generate jurnal') }
}

export class ProductionOrderNotVoidableError extends BusinessRuleError {
  constructor() { super('Order berstatus VOID tidak bisa di-void lagi') }
}

export class WasteExceedsActualError extends BusinessRuleError {
  constructor(product: string) { super(`Waste tidak boleh melebihi actual qty untuk ${product}`) }
}

export class FiscalPeriodClosedError extends BusinessRuleError {
  constructor() { super('Periode fiskal untuk tanggal produksi ini sudah ditutup') }
}

export class COANotFoundError extends BusinessRuleError {
  constructor(code: string) { super(`Akun COA ${code} tidak ditemukan`) }
}

export class OrderNumberCollisionError extends BusinessRuleError {
  constructor() { super('Gagal generate order number setelah 3 percobaan') }
}
