export type FeeDiscrepancySource = 'SINGLE_MATCH' | 'MULTI_MATCH' | 'SETTLEMENT_GROUP'
export type FeeDiscrepancyStatus = 'PENDING' | 'CONFIRMED' | 'CORRECTED'

export interface FeeDiscrepancyItem {
  id: string
  source: FeeDiscrepancySource
  sourceId: string // aggregate_id, group_id, or settlement_group_id
  transactionDate: string
  bankStatementId: string | number
  bankDescription: string | null
  bankAmount: number
  posNettAmount: number
  discrepancyAmount: number // positive = bank kurang, negative = bank lebih
  paymentMethodName: string | null
  branchName: string | null
  status: FeeDiscrepancyStatus
  correctionJournalId: string | null
  notes: string | null
}

export interface FeeDiscrepancyFilter {
  dateFrom?: string
  dateTo?: string
  status?: FeeDiscrepancyStatus
  paymentMethodId?: number
  minAmount?: number
  page?: number
  limit?: number
}

export interface FeeDiscrepancySummary {
  totalPending: number
  totalConfirmed: number
  totalCorrected: number
  sumPendingPositive: number  // bank bayar kurang
  sumPendingNegative: number  // bank bayar lebih
  count: number
}
