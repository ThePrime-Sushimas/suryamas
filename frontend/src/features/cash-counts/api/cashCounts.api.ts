import api from '@/lib/axios'
import type { CashCount, CashDeposit, CreateCashCountDto, UpdatePhysicalCountDto, CreateDepositDto, ConfirmDepositDto, CashCountListFilter } from '../types'

export interface CashCountPreviewRow {
  branch_name: string
  transaction_date: string
  system_balance: number
  transaction_count: number
  cash_count_id: string | null
  physical_count: number | null
  large_denomination: number | null
  small_denomination: number | null
  difference: number | null
  status: string | null
  cash_deposit_id: string | null
  responsible_employee_id: string | null
  notes: string | null
}

export const cashCountsApi = {
  async preview(startDate: string, endDate: string, paymentMethodId: number): Promise<CashCountPreviewRow[]> {
    const res = await api.get('/cash-counts/preview', { params: { start_date: startDate, end_date: endDate, payment_method_id: paymentMethodId } })
    return res.data.data
  },

  async list(params: CashCountListFilter = {}) {
    const res = await api.get('/cash-counts', { params })
    return { data: res.data.data as CashCount[], pagination: res.data.pagination }
  },

  async getById(id: string): Promise<CashCount> {
    const res = await api.get(`/cash-counts/${id}`)
    return res.data.data
  },

  async create(dto: CreateCashCountDto): Promise<CashCount> {
    const res = await api.post('/cash-counts', dto)
    return res.data.data
  },

  async updatePhysicalCount(id: string, dto: UpdatePhysicalCountDto): Promise<CashCount> {
    const res = await api.put(`/cash-counts/${id}/count`, dto)
    return res.data.data
  },

  async close(id: string): Promise<CashCount> {
    const res = await api.post(`/cash-counts/${id}/close`)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/cash-counts/${id}`)
  },

  // Deposits
  async createDeposit(dto: CreateDepositDto): Promise<CashDeposit> {
    const res = await api.post('/cash-counts/deposits', dto)
    return res.data.data
  },

  async confirmDeposit(id: string, dto: ConfirmDepositDto): Promise<CashDeposit> {
    const res = await api.post(`/cash-counts/deposits/${id}/confirm`, dto)
    return res.data.data
  },

  async revertDeposit(id: string): Promise<CashDeposit> {
    const res = await api.post(`/cash-counts/deposits/${id}/revert`)
    return res.data.data
  },

  async getDeposit(id: string): Promise<CashDeposit> {
    const res = await api.get(`/cash-counts/deposits/${id}`)
    return res.data.data
  },

  async deleteDeposit(id: string): Promise<void> {
    await api.delete(`/cash-counts/deposits/${id}`)
  },

  async listDeposits(page: number = 1, limit: number = 20) {
    const res = await api.get('/cash-counts/deposits', { params: { page, limit } })
    return { data: res.data.data as CashDeposit[], pagination: res.data.pagination }
  },

  async getCapitalReport(startDate: string, endDate: string) {
    const res = await api.get('/cash-counts/report/capital', { params: { start_date: startDate, end_date: endDate } })
    return res.data.data as {
      period: { start_date: string; end_date: string }
      grand_total: number
      total_deposits: number
      by_branch: { branch_name: string; total: number; count: number; deposits: any[] }[]
    }
  },
}
