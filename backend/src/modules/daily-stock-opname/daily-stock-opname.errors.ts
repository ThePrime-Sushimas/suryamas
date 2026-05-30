import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class OpnameNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('Opname session', id)
  }
}

export class OpnameDuplicateError extends ConflictError {
  constructor(branchName: string, date: string) {
    super(`Opname session untuk cabang "${branchName}" tanggal ${date} sudah ada`)
  }
}

export class OpnameNotDraftError extends BusinessRuleError {
  constructor(currentStatus: string) {
    super(`Opname session berstatus "${currentStatus}", harus "DRAFT" untuk operasi ini`)
  }
}

export class OpnameNotFlaggedError extends BusinessRuleError {
  constructor(currentStatus: string) {
    super(`Opname session berstatus "${currentStatus}", harus "FLAGGED" untuk di-resolve`)
  }
}

export class OpnameTimeExpiredError extends BusinessRuleError {
  constructor(closingTime: string) {
    super(`Waktu input opname sudah lewat batas (${closingTime} + grace period). Tidak bisa melanjutkan operasi.`)
  }
}

export class OpnameBackdateError extends BusinessRuleError {
  constructor() {
    super('Tidak diperbolehkan membuat opname untuk tanggal yang sudah lewat (backdate)')
  }
}

export class OpnameIncompleteError extends BusinessRuleError {
  constructor(completedCount: number, totalCount: number) {
    super(
      `Belum semua item diisi (${completedCount}/${totalCount}). Lengkapi semua actual qty sebelum konfirmasi.`,
    )
  }
}

export class OpnamePhotoRequiredError extends BusinessRuleError {
  constructor(productNames: string[]) {
    super(
      `Foto wajib untuk produk high-risk: ${productNames.join(', ')}. Upload foto sebelum konfirmasi.`,
    )
  }
}

export class OpnameSessionExpiredError extends BusinessRuleError {
  constructor(closingDate: string) {
    super(`Opname session tanggal ${closingDate} sudah kedaluwarsa (DRAFT dari hari sebelumnya). Tidak bisa diedit atau dikonfirmasi.`)
  }
}

export class DpoBlockedByOpnameError extends BusinessRuleError {
  constructor() {
    super('DPO tidak bisa dikonfirmasi karena opname harian sudah difinalisasi untuk tanggal dan cabang ini')
  }
}
