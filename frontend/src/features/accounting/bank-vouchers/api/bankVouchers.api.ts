import api from '@/lib/axios'
import type {
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankVoucherFilter,
  BankAccountOption,
} from '../types/bank-vouchers.types'

type ApiResponse<T> = { success: boolean; data: T }

export const bankVouchersApi = {
  // GET /bank-vouchers/preview
  preview: async (filter: BankVoucherFilter): Promise<BankVoucherPreviewResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)
    if (filter.bank_account_id) params.append('bank_account_id', String(filter.bank_account_id))

    const res = await api.get<ApiResponse<BankVoucherPreviewResult>>(
      `/bank-vouchers/preview?${params}`
    )
    return res.data.data
  },

  // GET /bank-vouchers/summary
  summary: async (filter: Omit<BankVoucherFilter, 'bank_account_id'>): Promise<BankVoucherSummaryResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)

    const res = await api.get<ApiResponse<BankVoucherSummaryResult>>(
      `/bank-vouchers/summary?${params}`
    )
    return res.data.data
  },

  // GET /bank-vouchers/bank-accounts
  getBankAccounts: async (): Promise<BankAccountOption[]> => {
    const res = await api.get<ApiResponse<BankAccountOption[]>>('/bank-vouchers/bank-accounts')
    return res.data.data
  },
}
