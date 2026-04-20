import { trialBalanceRepository } from './trial-balance.repository'
import { TrialBalanceRow, TrialBalanceParams } from './trial-balance.types'
import { logInfo } from '../../../config/logger'

export class TrialBalanceService {
  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceRow[]> {
    logInfo('Fetching trial balance', {
      company_id: params.companyId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      branch_id: params.branchId,
    })

    const rows = await trialBalanceRepository.getTrialBalance(params)

    logInfo('Trial balance fetched', {
      company_id: params.companyId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      row_count: rows.length,
    })

    return rows
  }
}

export const trialBalanceService = new TrialBalanceService()
