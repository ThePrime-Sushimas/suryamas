import api from '@/lib/axios'
import type {
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankVoucherFilter,
  BankAccountOption,
} from '../types/bank-vouchers.types'

/**
 * API Response wrapper type
 */
type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

/**
 * Bank Vouchers API Service
 * All endpoints require authentication
 */
export const bankVouchersApi = {
  /**
   * GET /api/v1/bank-vouchers/preview
   * Preview vouchers untuk periode tertentu
   * Query params: period_month, period_year, branch_id?, bank_account_id?
   */
  preview: async (filter: BankVoucherFilter): Promise<BankVoucherPreviewResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)
    if (filter.bank_account_id) params.append('bank_account_id', String(filter.bank_account_id))

    const res = await api.get<ApiResponse<BankVoucherPreviewResult>>(
      `/bank-vouchers/preview?${params}`
    )

    if (!res.data.success) {
      throw new Error(res.data.message ?? 'Gagal memuat preview voucher')
    }

    return res.data.data
  },

  /**
   * GET /api/v1/bank-vouchers/summary
   * Get summary dengan totals dan running balance
   * Query params: period_month, period_year, branch_id?
   */
  summary: async (filter: Omit<BankVoucherFilter, 'bank_account_id'>): Promise<BankVoucherSummaryResult> => {
    const params = new URLSearchParams()
    params.append('period_month', String(filter.period_month))
    params.append('period_year', String(filter.period_year))
    if (filter.branch_id) params.append('branch_id', filter.branch_id)

    const res = await api.get<ApiResponse<BankVoucherSummaryResult>>(
      `/bank-vouchers/summary?${params}`
    )

    if (!res.data.success) {
      throw new Error(res.data.message ?? 'Gagal memuat ringkasan voucher')
    }

    return res.data.data
  },

  /**
   * GET /api/v1/bank-vouchers/bank-accounts
   * Get dropdown list bank accounts untuk filter
   */
  getBankAccounts: async (): Promise<BankAccountOption[]> => {
    const res = await api.get<ApiResponse<BankAccountOption[]>>(
      '/bank-vouchers/bank-accounts'
    )

    if (!res.data.success) {
      throw new Error('Gagal memuat daftar bank')
    }

    return res.data.data
  },

  /**
   * POST /api/v1/bank-vouchers/confirm
   * Konfirmasi/persist voucher ke journal
   * Body: { transaction_dates: string[] }
   */
  confirm: async (dates: string[]): Promise<void> => {
    const res = await api.post<ApiResponse<any>>(
      '/bank-vouchers/confirm',
      { transaction_dates: dates }
    )

    if (!res.data.success) {
      throw new Error(res.data.message ?? 'Gagal mengonfirmasi voucher')
    }
  },
}

/**
 * Error handler untuk API responses
 */
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan pada server'
}