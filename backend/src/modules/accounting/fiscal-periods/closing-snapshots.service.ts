import { closingSnapshotsRepository, type ClosingSnapshotHeader, type ClosingSnapshotSummary } from './closing-snapshots.repository'
import { trialBalanceService } from '../trial-balance/trial-balance.service'
import { incomeStatementService } from '../income-statement/income-statement.service'
import { balanceSheetService } from '../balance-sheet/balance-sheet.service'
import { logInfo } from '../../../config/logger'
import type { PoolClient } from 'pg'

export interface SnapshotReportData {
  trialBalanceRows: Array<Record<string, unknown>>
  incomeStatementRows: Array<Record<string, unknown>>
  balanceSheetRows: Array<Record<string, unknown>>
}

export interface SnapshotDetail {
  header: ClosingSnapshotHeader
  trial_balance: Array<Record<string, unknown>>
  income_statement: Array<Record<string, unknown>>
  balance_sheet: Array<Record<string, unknown>>
}

class ClosingSnapshotsService {
  /**
   * Fetch report data for snapshot. Called BEFORE the closing transaction
   * so that data is ready to be inserted atomically with the closing.
   */
  async fetchReportData(companyId: string, periodStart: string, periodEnd: string): Promise<SnapshotReportData> {
    const allBranchIds = await closingSnapshotsRepository.findCompanyBranchIds(companyId)

    const [trialBalanceRows, incomeStatementResult, balanceSheetResult] = await Promise.all([
      trialBalanceService.getTrialBalance({
        companyIds: [companyId],
        dateFrom: periodStart,
        dateTo: periodEnd,
        branchFilterIds: allBranchIds,
        groupByBranch: false,
      }),
      incomeStatementService.getIncomeStatement({
        companyIds: [companyId],
        dateFrom: periodStart,
        dateTo: periodEnd,
        branchFilterIds: allBranchIds,
        groupByBranch: false,
      }),
      balanceSheetService.getBalanceSheet({
        companyIds: [companyId],
        asOfDate: periodEnd,
        branchFilterIds: allBranchIds,
        groupByBranch: false,
      }),
    ])

    return {
      trialBalanceRows: trialBalanceRows as unknown as Array<Record<string, unknown>>,
      incomeStatementRows: incomeStatementResult.rows as unknown as Array<Record<string, unknown>>,
      balanceSheetRows: balanceSheetResult.rows as unknown as Array<Record<string, unknown>>,
    }
  }

  /**
   * Insert snapshot INSIDE an existing transaction (atomic with closing).
   * Caller provides the PoolClient from the closing transaction.
   */
  async insertSnapshot(
    client: PoolClient,
    params: {
      fiscalPeriodId: string
      companyId: string
      closingJournalId: string | null
      netIncome: number
      totalRevenue: number
      totalExpense: number
      closedBy: string
    },
    reportData: SnapshotReportData,
  ): Promise<ClosingSnapshotHeader> {
    const { fiscalPeriodId, companyId, closingJournalId, netIncome, totalRevenue, totalExpense, closedBy } = params

    const version = await closingSnapshotsRepository.getNextVersion(fiscalPeriodId, client)
    await closingSnapshotsRepository.markPreviousVersionsNotLatest(fiscalPeriodId, client)

    const header = await closingSnapshotsRepository.insertHeader(client, {
      fiscal_period_id: fiscalPeriodId,
      company_id: companyId,
      version,
      closing_journal_id: closingJournalId,
      net_income: netIncome,
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      closed_by: closedBy,
    })

    await closingSnapshotsRepository.insertTrialBalanceLines(client, header.id, reportData.trialBalanceRows)
    await closingSnapshotsRepository.insertIncomeStatementLines(client, header.id, reportData.incomeStatementRows)
    await closingSnapshotsRepository.insertBalanceSheetLines(client, header.id, reportData.balanceSheetRows)

    logInfo('Closing snapshot inserted', {
      fiscal_period_id: fiscalPeriodId,
      snapshot_id: header.id,
      version,
      tb_lines: reportData.trialBalanceRows.length,
      is_lines: reportData.incomeStatementRows.length,
      bs_lines: reportData.balanceSheetRows.length,
    })

    return header
  }

  /**
   * Standalone snapshot generation (for retrySnapshot — NOT inside closing tx).
   * Fetches data + inserts in its own transaction.
   */
  async generateSnapshot(params: {
    fiscalPeriodId: string
    companyId: string
    periodStart: string
    periodEnd: string
    closingJournalId: string | null
    netIncome: number
    totalRevenue: number
    totalExpense: number
    closedBy: string
  }): Promise<ClosingSnapshotHeader> {
    const reportData = await this.fetchReportData(params.companyId, params.periodStart, params.periodEnd)

    return closingSnapshotsRepository.withTransaction(async (client) => {
      return this.insertSnapshot(client, {
        fiscalPeriodId: params.fiscalPeriodId,
        companyId: params.companyId,
        closingJournalId: params.closingJournalId,
        netIncome: params.netIncome,
        totalRevenue: params.totalRevenue,
        totalExpense: params.totalExpense,
        closedBy: params.closedBy,
      }, reportData)
    })
  }

  /**
   * List all versions for a fiscal period.
   */
  async listVersions(fiscalPeriodId: string, companyId: string): Promise<ClosingSnapshotSummary[]> {
    return closingSnapshotsRepository.listByPeriod(fiscalPeriodId, companyId)
  }

  /**
   * Get a specific version's full detail.
   */
  async getByVersion(fiscalPeriodId: string, version: number, companyId: string): Promise<SnapshotDetail | null> {
    const header = await closingSnapshotsRepository.findByVersion(fiscalPeriodId, version, companyId)
    if (!header) return null

    const [trial_balance, income_statement, balance_sheet] = await Promise.all([
      closingSnapshotsRepository.getTrialBalanceLines(header.id),
      closingSnapshotsRepository.getIncomeStatementLines(header.id),
      closingSnapshotsRepository.getBalanceSheetLines(header.id),
    ])

    return { header, trial_balance, income_statement, balance_sheet }
  }

  /**
   * Get the latest version's full detail.
   */
  async getLatest(fiscalPeriodId: string, companyId: string): Promise<SnapshotDetail | null> {
    const header = await closingSnapshotsRepository.findLatest(fiscalPeriodId, companyId)
    if (!header) return null

    const [trial_balance, income_statement, balance_sheet] = await Promise.all([
      closingSnapshotsRepository.getTrialBalanceLines(header.id),
      closingSnapshotsRepository.getIncomeStatementLines(header.id),
      closingSnapshotsRepository.getBalanceSheetLines(header.id),
    ])

    return { header, trial_balance, income_statement, balance_sheet }
  }
}

export const closingSnapshotsService = new ClosingSnapshotsService()
