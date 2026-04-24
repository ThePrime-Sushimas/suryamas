import api from '@/lib/axios'
import type { FeeDiscrepancyItem, FeeDiscrepancySummary } from '../types/fee-discrepancy.types'

interface ListParams {
  dateFrom?: string
  dateTo?: string
  status?: string
  paymentMethodId?: number
  minAmount?: number
  page?: number
  limit?: number
}

export const feeDiscrepancyApi = {
  async list(params: ListParams): Promise<{ data: FeeDiscrepancyItem[]; pagination: { total: number } }> {
    const res = await api.get('/fee-discrepancy-review', { params })
    return res.data
  },

  async summary(params: { dateFrom?: string; dateTo?: string }): Promise<FeeDiscrepancySummary> {
    const res = await api.get('/fee-discrepancy-review/summary', { params })
    return res.data.data
  },
}
