import api from '@/lib/axios'
import type {
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankVoucherFilter,
  BankAccountOption,
} from '../types/bank-vouchers.types'

type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

export const bankVouchersApi = {
  // GET /api/v1/bank-vouchers/preview
  preview: async (filter: BankVoucherFilter): Promise<BankVoucherPreviewResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)
    if (filter.bank_account_id) params.append('bank_account_id', String(filter.bank_account_id))

    const res = await api.get<ApiResponse<BankVoucherPreviewResult>>(
      `/bank-vouchers/preview?${params}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat preview voucher')
    return res.data.data
  },

  // GET /api/v1/bank-vouchers/summary
  summary: async (filter: Omit<BankVoucherFilter, 'bank_account_id'>): Promise<BankVoucherSummaryResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)

    const res = await api.get<ApiResponse<BankVoucherSummaryResult>>(
      `/bank-vouchers/summary?${params}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat ringkasan')
    return res.data.data
  },

  // GET /api/v1/bank-vouchers/bank-accounts
  getBankAccounts: async (): Promise<BankAccountOption[]> => {
    const res = await api.get<ApiResponse<BankAccountOption[]>>('/bank-vouchers/bank-accounts')
    if (!res.data.success) throw new Error('Gagal memuat daftar bank')
    return res.data.data
  },

  // ============================================
  // PHASE 2 (uncomment setelah backend ready)
  // ============================================

  // confirm: async (params: {
  //   dates: string[]
  //   branch_id?: string
  //   bank_account_id?: number
  // }): Promise<void> => {
  //   const res = await api.post<ApiResponse<null>>('/bank-vouchers/confirm', {
  //     transaction_dates: params.dates,
  //     branch_id: params.branch_id,
  //     bank_account_id: params.bank_account_id,
  //   })
  //   if (!res.data.success) throw new Error(res.data.message ?? 'Gagal konfirmasi voucher')
  // },
}