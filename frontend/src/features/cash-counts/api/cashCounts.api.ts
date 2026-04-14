import api from '@/lib/axios'
import type { CashCount, CreateCashCountDto, UpdatePhysicalCountDto, DepositDto, CashCountListFilter } from '../types'

export interface CashCountPreviewRow {
  branch_name: string
  transaction_date: string
  system_balance: number
  transaction_count: number
  cash_count_id: string | null
  physical_count: number | null
  difference: number | null
  status: string | null
  responsible_employee_id: string | null
  deposit_amount: number | null
  deposit_date: string | null
  notes: string | null
}

export interface CashCountListResponse {
  data: CashCount[]
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

export const cashCountsApi = {
  async preview(startDate: string, endDate: string, paymentMethodId: number): Promise<CashCountPreviewRow[]> {
    const res = await api.get('/cash-counts/preview', { params: { start_date: startDate, end_date: endDate, payment_method_id: paymentMethodId } })
    return res.data.data
  },

  async list(params: CashCountListFilter = {}): Promise<CashCountListResponse> {
    const res = await api.get('/cash-counts', { params })
    return { data: res.data.data, pagination: res.data.pagination }
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

  async deposit(id: string, dto: DepositDto): Promise<CashCount> {
    const res = await api.put(`/cash-counts/${id}/deposit`, dto)
    return res.data.data
  },

  async close(id: string): Promise<CashCount> {
    const res = await api.post(`/cash-counts/${id}/close`)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/cash-counts/${id}`)
  },
}
