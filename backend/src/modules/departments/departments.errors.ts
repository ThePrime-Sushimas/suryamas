import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class DepartmentNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `Department ${id} tidak ditemukan` : 'Department tidak ditemukan') }
}

export class DepartmentDuplicateError extends ConflictError {
  constructor(code: string) { super(`Department dengan kode '${code}' sudah ada`) }
}

export class DepartmentInUseError extends BusinessRuleError {
  constructor() { super('Department masih memiliki position aktif, tidak bisa dihapus') }
}
