import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class DpoNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Daily Prep Order ${id} tidak ditemukan`) }
}

export class DpoInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`DPO status ${current} tidak valid untuk operasi ini, butuh ${expected}`)
  }
}

export class DpoAlreadyExistsError extends BusinessRuleError {
  constructor(branchId: string, prepDate: string) {
    super(`DPO untuk cabang ${branchId} tanggal ${prepDate} sudah ada. Cancel dulu yang existing.`)
  }
}

export class DpoLockConflictError extends BusinessRuleError {
  constructor() {
    super('DPO sedang dikonfirmasi oleh pengguna lain. Coba lagi dalam beberapa saat.')
  }
}

export class DpoLockExpiredError extends BusinessRuleError {
  constructor() {
    super('Sesi konfirmasi sudah expired. Refresh halaman dan coba lagi.')
  }
}

export class DpoNoLinesError extends BusinessRuleError {
  constructor() { super('Tidak ada baris yang bisa di-transfer (semua confirmed_qty = 0 atau null)') }
}

export class DpoForecastConfigNotFoundError extends BusinessRuleError {
  constructor(branchId: string) {
    super(`Forecast config untuk cabang ${branchId} belum dikonfigurasi. Buat config dulu di halaman Konfigurasi DPO.`)
  }
}

export class DpoInsufficientMainStockError extends BusinessRuleError {
  constructor(productName: string, available: number, requested: number) {
    super(`Stok MAIN tidak cukup untuk ${productName}: tersedia ${available}, diminta ${requested}`)
  }
}