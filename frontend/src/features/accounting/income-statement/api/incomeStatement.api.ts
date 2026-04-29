import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { IncomeStatementFilter, IncomeStatementRow, IncomeStatementSummary } from '../types/income-statement.types'

export const incomeStatementKeys = {
  all: ['income-statement'] as const,
  data: (filter: IncomeStatementFilter, companyId: string) => [...incomeStatementKeys.all, 'data', companyId, filter] as const,
}

export const useIncomeStatement = (filter: IncomeStatementFilter, companyId: string, enabled: boolean) =>
  useQuery({
    queryKey: incomeStatementKeys.data(filter, companyId),
    queryFn: async () => {
      const params: Record<string, string> = {
        date_from: filter.date_from,
        date_to: filter.date_to,
      }
      if (filter.branch_ids.length > 0) params.branch_ids = filter.branch_ids.join(',')
      if (filter.compare_date_from) params.compare_date_from = filter.compare_date_from
      if (filter.compare_date_to) params.compare_date_to = filter.compare_date_to

      const { data } = await api.get('/accounting/income-statement', { params })
      const result = data.data as { rows: IncomeStatementRow[]; summary: IncomeStatementSummary }

      return {
        rows: result.rows.map(r => ({
          ...r,
          debit_amount: Number(r.debit_amount),
          credit_amount: Number(r.credit_amount),
          compare_debit_amount: Number(r.compare_debit_amount ?? 0),
          compare_credit_amount: Number(r.compare_credit_amount ?? 0),
        })),
        summary: result.summary, // summary fields are JS-native numbers from service layer arithmetic
      }
    },
    enabled: enabled && !!companyId && !!filter.date_from && !!filter.date_to,
    staleTime: 60_000,
  })
