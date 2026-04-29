import { balanceSheetRepository } from './balance-sheet.repository'
import { BalanceSheetParams, BalanceSheetRow, BalanceSheetSummary } from './balance-sheet.types'
import { logInfo } from '../../../config/logger'

function assetBalance(r: BalanceSheetRow): number {
  return Number(r.debit_amount) - Number(r.credit_amount)
}

function liabilityEquityBalance(r: BalanceSheetRow): number {
  return Number(r.credit_amount) - Number(r.debit_amount)
}

function balanceOf(r: BalanceSheetRow): number {
  return r.account_type === 'ASSET' ? assetBalance(r) : liabilityEquityBalance(r)
}

function compareBalanceOf(r: BalanceSheetRow): number {
  return r.account_type === 'ASSET'
    ? Number(r.compare_debit_amount) - Number(r.compare_credit_amount)
    : Number(r.compare_credit_amount) - Number(r.compare_debit_amount)
}

export class BalanceSheetService {
  async getBalanceSheet(params: BalanceSheetParams): Promise<{
    rows: BalanceSheetRow[]
    summary: BalanceSheetSummary
  }> {
    logInfo('Fetching balance sheet', {
      company_id: params.companyId,
      as_of_date: params.asOfDate,
      has_compare: !!params.compareAsOfDate,
    })

    const [{ current, compare }, retainedEarnings, compareRetainedEarnings] = await Promise.all([
      balanceSheetRepository.getBalanceSheet(params),
      balanceSheetRepository.getRetainedEarnings(params.companyId, params.asOfDate),
      params.compareAsOfDate
        ? balanceSheetRepository.getRetainedEarnings(params.companyId, params.compareAsOfDate)
        : Promise.resolve(0),
    ])

    const compareMap = new Map<string, BalanceSheetRow>()
    for (const r of compare) {
      compareMap.set(`${r.account_id}|${r.branch_id ?? ''}`, r)
    }

    const rows: BalanceSheetRow[] = current.map(r => {
      const c = compareMap.get(`${r.account_id}|${r.branch_id ?? ''}`)
      return {
        ...r,
        compare_debit_amount: c?.debit_amount ?? 0,
        compare_credit_amount: c?.credit_amount ?? 0,
      }
    })

    const sumType = (type: string, fn: (r: BalanceSheetRow) => number) =>
      rows.filter(r => r.account_type === type).reduce((s, r) => s + fn(r), 0)

    const totalAsset = sumType('ASSET', balanceOf)
    const totalLiability = sumType('LIABILITY', balanceOf)
    const totalEquity = sumType('EQUITY', balanceOf)

    const compareTotalAsset = sumType('ASSET', compareBalanceOf)
    const compareTotalLiability = sumType('LIABILITY', compareBalanceOf)
    const compareTotalEquity = sumType('EQUITY', compareBalanceOf)

    const summary: BalanceSheetSummary = {
      total_asset: totalAsset,
      total_liability: totalLiability,
      total_equity: totalEquity,
      retained_earnings: retainedEarnings,
      total_liability_equity: totalLiability + totalEquity + retainedEarnings,
      is_balanced: Math.abs(totalAsset - (totalLiability + totalEquity + retainedEarnings)) < 0.01,
      compare_total_asset: compareTotalAsset,
      compare_total_liability: compareTotalLiability,
      compare_total_equity: compareTotalEquity,
      compare_retained_earnings: compareRetainedEarnings,
      compare_total_liability_equity: compareTotalLiability + compareTotalEquity + compareRetainedEarnings,
    }

    logInfo('Balance sheet fetched', { row_count: rows.length, is_balanced: summary.is_balanced })
    return { rows, summary }
  }
}

export const balanceSheetService = new BalanceSheetService()
