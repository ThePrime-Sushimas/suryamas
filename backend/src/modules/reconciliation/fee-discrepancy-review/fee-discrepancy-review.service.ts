import { feeDiscrepancyReviewRepository } from './fee-discrepancy-review.repository'
import type { FeeDiscrepancyFilter } from './fee-discrepancy-review.types'
import { logInfo } from '@/config/logger'

export class FeeDiscrepancyReviewService {
  constructor(private readonly repo = feeDiscrepancyReviewRepository) {}

  async getDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter) {
    logInfo('FeeDiscrepancyReview.getDiscrepancies', { companyId, filter })
    return this.repo.getDiscrepancies(companyId, filter)
  }

  async getSummary(companyId: string, filter: FeeDiscrepancyFilter) {
    logInfo('FeeDiscrepancyReview.getSummary', { companyId, filter })
    return this.repo.getSummary(companyId, filter)
  }
}

export const feeDiscrepancyReviewService = new FeeDiscrepancyReviewService()
