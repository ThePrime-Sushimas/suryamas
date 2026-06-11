import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class MonthlyOpnameNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('Monthly stock opname session', id)
  }
}

export class MonthlyOpnameDuplicateError extends ConflictError {
  constructor(branchName: string, warehouseName: string, date: string, positionName?: string) {
    const posInfo = positionName ? ` position "${positionName}"` : ''
    super(`Monthly stock opname untuk cabang "${branchName}" warehouse "${warehouseName}"${posInfo} tanggal ${date} sudah ada`)
  }
}

export class MonthlyOpnameNotEditableError extends BusinessRuleError {
  constructor(currentStatus: string) {
    super(`Monthly stock opname berstatus "${currentStatus}", harus "DRAFT" atau "REOPENED" untuk operasi ini`)
  }
}

export class MonthlyOpnameIncompleteError extends BusinessRuleError {
  constructor(completedCount: number, totalCount: number) {
    super(
      `Belum semua item diisi (${completedCount}/${totalCount}). Lengkapi semua actual qty sebelum konfirmasi.`,
    )
  }
}

export class MonthlyOpnameInvestigasiRequiredError extends BusinessRuleError {
  constructor(productNames: string[]) {
    const list = productNames.slice(0, 10).join(', ')
    const more = productNames.length > 10 ? ` dan ${productNames.length - 10} lainnya` : ''
    super(
      `Investigasi note wajib diisi untuk produk dengan selisih: ${list}${more}`,
    )
  }
}

export class MonthlyOpnameNotConfirmedError extends BusinessRuleError {
  constructor(status: string) {
    super(`Sesi opname dengan status "${status}" tidak dapat diminta reopen. Hanya sesi CONFIRMED yang eligible.`)
  }
}

export class MonthlyOpnameReopenPendingExistsError extends BusinessRuleError {
  constructor() {
    super('Sudah ada permintaan reopen yang masih menunggu approval untuk sesi ini.')
  }
}

export class MonthlyOpnameReopenAlreadyRespondedError extends BusinessRuleError {
  constructor() {
    super('Permintaan reopen ini sudah direspon sebelumnya.')
  }
}

export class MonthlyOpnameReopenNotFoundError extends BusinessRuleError {
  constructor(id: string) {
    super(`Permintaan reopen dengan ID "${id}" tidak ditemukan.`)
  }
}

export class MonthlyOpnameCannotCancelError extends BusinessRuleError {
  constructor(status: string) {
    super(`Opname dengan status "${status}" tidak bisa dibatalkan. Hanya status DRAFT yang bisa dibatalkan.`)
  }
}
