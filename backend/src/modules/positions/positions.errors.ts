import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class PositionNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Position ${id} tidak ditemukan` : 'Position tidak ditemukan') }
}

export class PositionDuplicateError extends ConflictError {
  constructor(code: string) { super(`Position dengan kode '${code}' sudah ada`) }
}

export class PositionInUseError extends BusinessRuleError {
  constructor() { super('Position masih di-assign ke employee aktif, tidak bisa dihapus') }
}
