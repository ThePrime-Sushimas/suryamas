import { incomeStatementRepository } from './income-statement.repository'
import { IncomeStatementParams, IncomeStatementRow, IncomeStatementSummary } from './income-statement.types'
import { logInfo } from '../../../config/logger'

function revenueAmount(r: IncomeStatementRow): number {
  return Number(r.credit_amount) - Number(r.debit_amount)
}

function expenseAmount(r: IncomeStatementRow): number {
  return Number(r.debit_amount) - Number(r.credit_amount)
}

function compareRevenueAmount(r: IncomeStatementRow): number {
  return Number(r.compare_credit_amount) - Number(r.compare_debit_amount)
}

function compareExpenseAmount(r: IncomeStatementRow): number {
  return Number(r.compare_debit_amount) - Number(r.compare_credit_amount)
}

export class IncomeStatementService {
  async getIncomeStatement(params: IncomeStatementParams): Promise<{
    rows: IncomeStatementRow[]
    summary: IncomeStatementSummary
  }> {
    logInfo('Fetching income statement', {
      company_id: params.companyId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      has_compare: !!(params.compareDateFrom && params.compareDateTo),
    })

    const { current, compare } = await incomeStatementRepository.getIncomeStatement(params)

    const compareMap = new Map<string, IncomeStatementRow>()
    for (const r of compare) {
      compareMap.set(`${r.account_id}|${r.branch_id ?? ''}`, r)
    }

    const rows: IncomeStatementRow[] = current.map(r => {
      const c = compareMap.get(`${r.account_id}|${r.branch_id ?? ''}`)
      return {
        ...r,
        compare_debit_amount: c?.debit_amount ?? 0,
        compare_credit_amount: c?.credit_amount ?? 0,
      }
    })

    const totalRevenue = rows.filter(r => r.account_type === 'REVENUE').reduce((s, r) => s + revenueAmount(r), 0)
    const totalExpense = rows.filter(r => r.account_type === 'EXPENSE').reduce((s, r) => s + expenseAmount(r), 0)
    const compareTotalRevenue = rows.filter(r => r.account_type === 'REVENUE').reduce((s, r) => s + compareRevenueAmount(r), 0)
    const compareTotalExpense = rows.filter(r => r.account_type === 'EXPENSE').reduce((s, r) => s + compareExpenseAmount(r), 0)

    const summary: IncomeStatementSummary = {
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_income: totalRevenue - totalExpense,
      compare_total_revenue: compareTotalRevenue,
      compare_total_expense: compareTotalExpense,
      compare_net_income: compareTotalRevenue - compareTotalExpense,
    }

    logInfo('Income statement fetched', { row_count: rows.length })
    return { rows, summary }
  }
}

export const incomeStatementService = new IncomeStatementService()
