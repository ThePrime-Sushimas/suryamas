export type BankMutationEntryType =
  | 'BANK_FEE'
  | 'INTEREST'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'SUPPLIER_PAYMENT'
  | 'RECEIVABLE'
  | 'REFUND'
  | 'TAX_PAYMENT'
  | 'PAYROLL'
  | 'OTHER'

export type BankMutationEntryStatus = 'ACTIVE' | 'VOIDED'

export const BANK_MUTATION_ENTRY_TYPE_CONFIG: Record<
  BankMutationEntryType,
  { label: string; defaultCoaHint: string; isDebit: boolean }
> = {
  BANK_FEE:         { label: 'Biaya Administrasi Bank', defaultCoaHint: 'Bank Charges',                isDebit: true  },
  INTEREST:         { label: 'Bunga / Jasa Giro',       defaultCoaHint: 'Interest Income',              isDebit: false },
  TRANSFER_IN:      { label: 'Transfer Masuk',           defaultCoaHint: 'Bank',                         isDebit: false },
  TRANSFER_OUT:     { label: 'Transfer Keluar',          defaultCoaHint: 'Bank',                         isDebit: true  },
  SUPPLIER_PAYMENT: { label: 'Pembayaran Supplier',      defaultCoaHint: 'Account payable purchase',     isDebit: true  },
  RECEIVABLE:       { label: 'Penerimaan Piutang',       defaultCoaHint: 'receivable',                   isDebit: false },
  REFUND:           { label: 'Refund',                   defaultCoaHint: 'Customer Refund',              isDebit: false },
  TAX_PAYMENT:      { label: 'Pembayaran Pajak',         defaultCoaHint: 'tax',                          isDebit: true  },
  PAYROLL:          { label: 'Penggajian',               defaultCoaHint: 'Salary payable',               isDebit: true  },
  OTHER:            { label: 'Lainnya',                  defaultCoaHint: '',                             isDebit: false },
}

/** DB row shape */
export interface BankMutationEntryRow {
  id: string
  company_id: string
  entry_date: string
  entry_type: BankMutationEntryType
  description: string
  amount: string // NUMERIC → string from DB
  reference_number: string | null
  bank_account_id: number | null
  coa_id: string | null
  coa_code: string | null
  coa_name: string | null
  bank_statement_id: number | null
  is_reconciled: boolean
  reconciled_at: string | null
  reconciled_by: string | null
  journal_header_id: string | null
  status: BankMutationEntryStatus
  void_reason: string | null
  voided_at: string | null
  voided_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

/** One-step create + reconcile DTO */
export interface ReconcileBankStatementWithMutationEntryDto {
  bankStatementId: string
  entryType: BankMutationEntryType
  description: string
  referenceNumber?: string
  /** COA wajib — untuk auto-generate journal */
  coaId: string
  /** Override entry date (default: bank statement date) */
  entryDate?: string
  /** Override amount (default: bank statement amount). Must match sign with entry type */
  amount?: number
  notes?: string
}

/** Void entry DTO */
export interface VoidBankMutationEntryDto {
  voidReason: string
}

/** Response / view */
export interface BankMutationEntryDetail {
  id: string
  entryDate: string
  entryType: BankMutationEntryType
  entryTypeLabel: string
  description: string
  amount: number
  referenceNumber: string | null
  bankAccountId: number | null
  bankAccountName: string | null
  coaId: string | null
  coaCode: string | null
  coaName: string | null
  bankStatementId: number | null
  isReconciled: boolean
  reconciledAt: string | null
  journalHeaderId: string | null
  status: BankMutationEntryStatus
  notes: string | null
  createdAt: string
}

/** List filter */
export interface ListBankMutationEntriesFilter {
  companyId: string
  bankAccountId?: number
  entryType?: BankMutationEntryType
  status?: BankMutationEntryStatus
  isReconciled?: boolean
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}
