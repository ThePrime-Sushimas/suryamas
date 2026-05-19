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
