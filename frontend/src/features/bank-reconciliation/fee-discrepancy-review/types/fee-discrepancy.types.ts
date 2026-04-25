export type FeeDiscrepancySource = 'SINGLE_MATCH' | 'MULTI_MATCH' | 'SETTLEMENT_GROUP'
export type FeeDiscrepancyStatus = 'PENDING' | 'CONFIRMED' | 'CORRECTED' | 'DISMISSED'

export interface FeeDiscrepancyItem {
  id: string
  source: FeeDiscrepancySource
  sourceId: string
  transactionDate: string
  bankStatementId: string | number
  bankDescription: string | null
  bankAmount: number
  posNettAmount: number
  discrepancyAmount: number
  paymentMethodName: string | null
  branchName: string | null
  status: FeeDiscrepancyStatus
  correctionJournalId: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
}

export interface FeeDiscrepancySummary {
  totalPending: number
  totalConfirmed: number
  totalCorrected: number
  totalDismissed: number
  sumPendingPositive: number
  sumPendingNegative: number
  sumConfirmedPositive: number
  sumConfirmedNegative: number
  count: number
}
