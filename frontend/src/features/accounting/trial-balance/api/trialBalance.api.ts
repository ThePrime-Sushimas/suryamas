import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { TrialBalanceFilter, TrialBalanceRow } from '../types/trial-balance.types'

// ============================================================
// Query Keys
// ============================================================

export const trialBalanceKeys = {
  all: ['trial-balance'] as const,
  data: (filter: TrialBalanceFilter) => [...trialBalanceKeys.all, 'data', filter] as const,
}

// ============================================================
// API Hooks
// ============================================================

export const useTrialBalance = (filter: TrialBalanceFilter) =>
  useQuery({
    queryKey: trialBalanceKeys.data(filter),
    queryFn: async () => {
      const { data } = await api.get('/accounting/trial-balance', {
        params: {
          company_id: filter.company_id,
          date_from:  filter.date_from,
          date_to:    filter.date_to,
          branch_id:  filter.branch_id,
        },
      })
      return (data.data as any[]).map((row) => ({
        ...row,
        account_level:   Number(row.account_level),
        opening_debit:   Number(row.opening_debit),
        opening_credit:  Number(row.opening_credit),
        opening_balance: Number(row.opening_balance),
        period_debit:    Number(row.period_debit),
        period_credit:   Number(row.period_credit),
        period_net:      Number(row.period_net),
        closing_debit:   Number(row.closing_debit),
        closing_credit:  Number(row.closing_credit),
        closing_balance: Number(row.closing_balance),
      })) as TrialBalanceRow[]
    },
    enabled:
      !!filter.company_id &&
      !!filter.date_from &&
      !!filter.date_to,
    staleTime: 60_000, // 1 minute
  })
