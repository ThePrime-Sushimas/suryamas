import { trialBalanceRepository } from './trial-balance.repository'
import { TrialBalanceRow, TrialBalanceParams } from './trial-balance.types'
import { logInfo } from '../../../config/logger'

export class TrialBalanceService {
  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceRow[]> {
    logInfo('Fetching trial balance', {
      company_ids: params.companyIds,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      group_by_branch: params.groupByBranch,
      branch_filter_count: params.branchFilterIds.length,
    })

    const rows = await trialBalanceRepository.getTrialBalance(params)

    logInfo('Trial balance fetched', { row_count: rows.length })
    return rows
  }
}

export const trialBalanceService = new TrialBalanceService()
