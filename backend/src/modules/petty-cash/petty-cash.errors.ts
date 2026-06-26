import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class PettyCashRequestNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Petty cash request not found: ${id}`)
  }
}

export class PettyCashInvalidStatusError extends BusinessRuleError {
  constructor(actual: string, expected: string | string[]) {
    const expectedStr = Array.isArray(expected) ? expected.join(' or ') : expected
    super(`Status request tidak valid: expected ${expectedStr}, got ${actual}`, {
      actual,
      expected: expectedStr,
    })
  }
}

export class PettyCashBranchHasActiveRequestError extends BusinessRuleError {
  constructor(branchId: string, activeRequestNumber: string) {
    super(
      `Branch ini sudah memiliki request aktif (${activeRequestNumber}). Selesaikan settlement terlebih dahulu.`,
      { branch_id: branchId, active_request_number: activeRequestNumber },
    )
  }
}

export class PettyCashCoaMissingError extends BusinessRuleError {
  constructor(detail: string) {
    super(`COA mapping tidak ditemukan: ${detail}`)
  }
}

export class PettyCashExpenseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Petty cash expense not found: ${id}`)
  }
}

export class PettyCashInventoryFieldsRequiredError extends BusinessRuleError {
  constructor(missingFields: string[]) {
    super(
      `Kategori ini affects_inventory — field berikut wajib diisi: ${missingFields.join(', ')}`,
      { missing_fields: missingFields },
    )
  }
}

export class PettyCashInsufficientBalanceError extends BusinessRuleError {
  constructor(available: number, requested: number) {
    super(
      `Saldo kas kecil tidak mencukupi. Tersedia: ${available.toLocaleString('id-ID')}, diminta: ${requested.toLocaleString('id-ID')}`,
      { available, requested },
    )
  }
}

export class PettyCashExpenseAlreadySettledError extends BusinessRuleError {
  constructor(expenseId: string) {
    super(
      `Expense ini sudah ter-settle dan tidak bisa diubah/dihapus.`,
      { expense_id: expenseId },
    )
  }
}

export class PettyCashSettlementExistsError extends BusinessRuleError {
  constructor(requestId: string) {
    super(`Request ini sudah memiliki settlement.`, { request_id: requestId })
  }
}

export class PettyCashReturnBankRequiredError extends BusinessRuleError {
  constructor() {
    super('return_bank_account_id wajib diisi karena amount_returned > 0')
  }
}

export class PettyCashRefillBankRequiredError extends BusinessRuleError {
  constructor() {
    super('refill_bank_account_id wajib diisi karena refill_amount > 0')
  }
}

export class PettyCashNegativeBalanceError extends BusinessRuleError {
  constructor(remaining: number) {
    super(
      `Bug: remaining_balance negatif (${remaining}). Balance check sebelumnya mungkin gagal.`,
      { remaining_balance: remaining },
    )
  }
}

export class PettyCashReturnExceedsBalanceError extends BusinessRuleError {
  constructor(remaining: number, returned: number) {
    super(
      `amount_returned (${returned.toLocaleString('id-ID')}) melebihi remaining_balance (${remaining.toLocaleString('id-ID')})`,
      { remaining_balance: remaining, amount_returned: returned },
    )
  }
}

export class PettyCashSettlementNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Petty cash settlement not found: ${id}`)
  }
}

export class PettyCashVoidBlockedByExpenseError extends BusinessRuleError {
  constructor(carriedToId: string, expenseCount: number) {
    super(
      `Void dibatalkan: request hasil carry (${carriedToId}) sudah memiliki ${expenseCount} expense. Hapus expense-nya terlebih dahulu.`,
      { carried_to_id: carriedToId, expense_count: expenseCount },
    )
  }
}

export class PettyCashVoidBlockedByRefillError extends BusinessRuleError {
  constructor(carriedToId: string) {
    super(
      `Void dibatalkan: request hasil carry (${carriedToId}) sudah memiliki journal disburse (refill sudah diposting).`,
      { carried_to_id: carriedToId },
    )
  }
}
