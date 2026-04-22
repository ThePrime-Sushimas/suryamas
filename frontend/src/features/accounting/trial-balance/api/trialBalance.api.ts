import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { TrialBalanceFilter, TrialBalanceRow } from '../types/trial-balance.types'

export const trialBalanceKeys = {
  all: ['trial-balance'] as const,
  data: (filter: TrialBalanceFilter) => [...trialBalanceKeys.all, 'data', filter] as const,
}

export const useTrialBalance = (filter: TrialBalanceFilter, enabled: boolean) =>
  useQuery({
    queryKey: trialBalanceKeys.data(filter),
    queryFn: async () => {
      const params: Record<string, string> = {
        date_from: filter.date_from,
        date_to: filter.date_to,
      }
      if (filter.branch_ids.length > 0) {
        params.branch_ids = filter.branch_ids.join(',')
      }
      const { data } = await api.get('/accounting/trial-balance', { params })
      return (data.data as any[]).map((row) => ({
        ...row,
        opening_debit: Number(row.opening_debit),
        opening_credit: Number(row.opening_credit),
        period_debit: Number(row.period_debit),
        period_credit: Number(row.period_credit),
        closing_debit: Number(row.closing_debit),
        closing_credit: Number(row.closing_credit),
      })) as TrialBalanceRow[]
    },
    enabled: enabled && !!filter.company_id && !!filter.date_from && !!filter.date_to,
    staleTime: 60_000,
  })
