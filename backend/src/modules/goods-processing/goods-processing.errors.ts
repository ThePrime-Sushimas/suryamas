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

export class GoodsProcessingOutputExceedsInputError extends BusinessRuleError {
  constructor(productName: string, inputQty: number, totalOutput: number) {
    super(`Total output (${totalOutput}) melebihi input (${inputQty}) untuk ${productName}`)
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
