import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { BalanceSheetFilter, BalanceSheetRow, BalanceSheetSummary } from '../types/balance-sheet.types'

export const balanceSheetKeys = {
  all: ['balance-sheet'] as const,
  data: (filter: BalanceSheetFilter) => [...balanceSheetKeys.all, 'data', filter] as const,
}

export const useBalanceSheet = (filter: BalanceSheetFilter, enabled: boolean, fetchKey?: number) =>
  useQuery({
    queryKey: [...balanceSheetKeys.data(filter), fetchKey],
    queryFn: async () => {
      const params: Record<string, string> = { as_of_date: filter.as_of_date }
      if (filter.branch_ids.length > 0) params.branch_ids = filter.branch_ids.join(',')
      if (filter.compare_as_of_date) params.compare_as_of_date = filter.compare_as_of_date

      const { data } = await api.get('/accounting/balance-sheet', { params })
      const result = data.data as { rows: BalanceSheetRow[]; summary: BalanceSheetSummary }

      return {
        rows: result.rows.map(r => ({
          ...r,
          debit_amount: Number(r.debit_amount),
          credit_amount: Number(r.credit_amount),
          compare_debit_amount: Number(r.compare_debit_amount ?? 0),
          compare_credit_amount: Number(r.compare_credit_amount ?? 0),
        })),
        summary: result.summary,
      }
    },
    enabled: enabled && !!filter.as_of_date,
    staleTime: 60_000,
  })
