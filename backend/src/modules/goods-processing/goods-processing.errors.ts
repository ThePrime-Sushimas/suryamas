import { NotFoundError, BusinessRuleError } from '../../utils/errors.base'

export class GoodsProcessingNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Goods Processing dengan ID ${id} tidak ditemukan`)
  }
}

export class GoodsProcessingInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string) {
    super(`Status saat ini "${current}", harus "${expected}" untuk operasi ini`)
  }
}

function fmtGpQty(n: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(n)
}

export class GoodsProcessingOutputExceedsInputError extends BusinessRuleError {
  constructor(productName: string, baseInputQty: number, baseUom: string, totalOutputBase: number) {
    super(
      `Total output (${fmtGpQty(totalOutputBase)} ${baseUom}) melebihi input (${fmtGpQty(baseInputQty)} ${baseUom}) untuk ${productName}`,
    )
  }
}

export class GoodsProcessingPhotoRequiredError extends BusinessRuleError {
  constructor(productName: string) {
    super(`Foto timbangan wajib untuk output "${productName}" (disassembly)`)
  }
}

export class GoodsProcessingAlreadyExistsError extends BusinessRuleError {
  constructor(grNumber: string) {
    super(`Goods Processing untuk GR ${grNumber} sudah ada`)
  }
}

export class GoodsProcessingReturnNotPendingError extends BusinessRuleError {
  constructor() {
    super('Barang retur ini sudah diproses atau tidak ditandai retur')
  }
}

export class GoodsProcessingReturnDiscardForbiddenError extends BusinessRuleError {
  constructor() {
    super('Anda tidak berwenang membuang barang retur. Hubungi atasan / tim yang punya akses pembuangan retur.')
  }
}

export class GoodsProcessingReturnStockForbiddenError extends BusinessRuleError {
  constructor() {
    super('Anda tidak berwenang memasukkan barang retur ke gudang. Hubungi tim QC / persetujuan gudang.')
  }
}

export class GoodsProcessingInputsNotCompleteError extends BusinessRuleError {
  constructor(doneCount: number, totalCount: number) {
    super(
      `Belum semua item selesai (${doneCount}/${totalCount}). Selesaikan tiap item dengan "Selesaikan item ini" terlebih dahulu.`,
    )
  }
}

export class GoodsProcessingPendingReturnError extends BusinessRuleError {
  constructor(pendingCount: number) {
    super(
      `Masih ada ${pendingCount} barang retur yang belum diproses. Selesaikan di bagian Barang Retur Tiba (masuk gudang atau buang) sebelum finalisasi GP.`,
    )
  }
}

export class GoodsProcessingNotReopenableError extends BusinessRuleError {
  constructor(current: string) {
    super(`GP status "${current}" tidak bisa dibuka kembali. Hanya GP berstatus CONFIRMED.`)
  }
}

export class GoodsProcessingReopenNotNeededError extends BusinessRuleError {
  constructor() {
    super('Semua item sudah selesai — GP tidak perlu dibuka kembali.')
  }
}

export class GoodsProcessingPostedInvoiceBlocksUnconfirmError extends BusinessRuleError {
  constructor() {
    super('Tidak bisa dikoreksi: Purchase Invoice sudah POSTED untuk GP ini')
  }
}

export class GoodsProcessingInputNotConfirmableError extends BusinessRuleError {
  constructor(current: string) {
    super(
      `Baris input tidak bisa dikonfirmasi (status: ${current}). ` +
        'Selesaikan dari status PENDING/PROCESSING, atau buka GP untuk koreksi jika sudah difinalisasi.',
    )
  }
}

export class GoodsProcessingMustUnconfirmForEditError extends BusinessRuleError {
  constructor() {
    super(
      'GP sudah difinalisasi. Gunakan tombol "Buka untuk koreksi" di sidebar sebelum mengubah item.',
    )
  }
}
