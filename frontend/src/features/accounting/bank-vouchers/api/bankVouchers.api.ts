import api from '@/lib/axios'
import type {
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankVoucherFilter,
  BankAccountOption,
  ConfirmResult,
  VoucherListResult,
  VoucherDetail,
  ManualVoucherInput,
  OpeningBalanceData,
  PaymentMethodOption,
  AvailableAggregate,
} from '../types/bank-vouchers.types'

type ApiResponse<T> = { success: boolean; data: T; message?: string }

const toParams = (obj: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') p.append(k, String(v))
  }
  return p.toString()
}

export const bankVouchersApi = {
  preview: async (filter: BankVoucherFilter): Promise<BankVoucherPreviewResult> => {
    const res = await api.get<ApiResponse<BankVoucherPreviewResult>>(
      `/bank-vouchers/preview?${toParams(filter as any)}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat preview')
    return res.data.data
  },

  summary: async (filter: Omit<BankVoucherFilter, 'bank_account_id'>): Promise<BankVoucherSummaryResult> => {
    const res = await api.get<ApiResponse<BankVoucherSummaryResult>>(
      `/bank-vouchers/summary?${toParams(filter as any)}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat ringkasan')
    return res.data.data
  },

  getBankAccounts: async (): Promise<BankAccountOption[]> => {
    const res = await api.get<ApiResponse<BankAccountOption[]>>('/bank-vouchers/bank-accounts')
    if (!res.data.success) throw new Error('Gagal memuat daftar bank')
    return res.data.data
  },

  confirm: async (params: {
    transaction_dates: string[]
    branch_id?: string
    bank_account_id?: number
  }): Promise<ConfirmResult> => {
    const res = await api.post<ApiResponse<ConfirmResult>>('/bank-vouchers/confirm', params)
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal konfirmasi voucher')
    return res.data.data
  },

  list: async (filter: BankVoucherFilter & { status?: string }): Promise<VoucherListResult> => {
    const res = await api.get<ApiResponse<VoucherListResult>>(
      `/bank-vouchers/list?${toParams(filter as any)}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat daftar voucher')
    return res.data.data
  },

  getById: async (id: string): Promise<VoucherDetail> => {
    const res = await api.get<ApiResponse<VoucherDetail>>(`/bank-vouchers/${id}`)
    if (!res.data.success) throw new Error(res.data.message ?? 'Voucher tidak ditemukan')
    return res.data.data
  },

  createManual: async (data: ManualVoucherInput): Promise<{ voucher_number: string; voucher_id: string }> => {
    const res = await api.post<ApiResponse<{ voucher_number: string; voucher_id: string }>>(
      '/bank-vouchers/manual', data
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal membuat voucher manual')
    return res.data.data
  },

  voidVoucher: async (id: string, reason: string): Promise<{ voucher_number: string; status: string }> => {
    const res = await api.post<ApiResponse<{ voucher_number: string; status: string }>>(
      `/bank-vouchers/${id}/void`, { reason }
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal void voucher')
    return res.data.data
  },

  getOpeningBalance: async (params: {
    bank_account_id: number; period_month: number; period_year: number
  }): Promise<OpeningBalanceData> => {
    const res = await api.get<ApiResponse<OpeningBalanceData>>(
      `/bank-vouchers/opening-balance?${toParams(params as any)}`
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal memuat saldo awal')
    return res.data.data
  },

  setOpeningBalance: async (params: {
    bank_account_id: number; period_month: number; period_year: number; opening_balance: number
  }): Promise<{ id: string; opening_balance: number; closing_balance: number }> => {
    const res = await api.post<ApiResponse<{ id: string; opening_balance: number; closing_balance: number }>>(
      '/bank-vouchers/opening-balance', params
    )
    if (!res.data.success) throw new Error(res.data.message ?? 'Gagal set saldo awal')
    return res.data.data
  },

  getPrintUrl: (id: string) => `/bank-vouchers/${id}/print`,

  getPaymentMethods: async (): Promise<PaymentMethodOption[]> => {
    const res = await api.get<ApiResponse<PaymentMethodOption[]>>('/bank-vouchers/payment-methods')
    if (!res.data.success) throw new Error('Gagal memuat payment methods')
    return res.data.data
  },

  getAvailableAggregates: async (params?: {
    date_start?: string; date_end?: string; bank_account_id?: number; search?: string
  }): Promise<AvailableAggregate[]> => {
    const qs = params ? `?${toParams(params as any)}` : ''
    const res = await api.get<ApiResponse<AvailableAggregate[]>>(`/bank-vouchers/available-aggregates${qs}`)
    if (!res.data.success) throw new Error('Gagal memuat data aggregate')
    return res.data.data
  },
}
