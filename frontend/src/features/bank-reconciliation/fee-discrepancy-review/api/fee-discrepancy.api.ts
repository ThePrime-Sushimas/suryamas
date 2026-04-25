import api from '@/lib/axios'
import type { FeeDiscrepancyItem, FeeDiscrepancySource, FeeDiscrepancyStatus, FeeDiscrepancySummary } from '../types/fee-discrepancy.types'

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

  async updateStatus(
    source: FeeDiscrepancySource,
    sourceId: string,
    body: { status: Exclude<FeeDiscrepancyStatus, 'PENDING'>; notes?: string; correctionJournalId?: string }
  ): Promise<void> {
    await api.patch(`/fee-discrepancy-review/${source}/${sourceId}/status`, body)
  },

  async createCorrection(
    source: FeeDiscrepancySource,
    sourceId: string,
    notes?: string
  ): Promise<{ journalId: string; journalNumber: string }> {
    const res = await api.post(`/fee-discrepancy-review/${source}/${sourceId}/correct`, { notes })
    return res.data.data
  },
}
