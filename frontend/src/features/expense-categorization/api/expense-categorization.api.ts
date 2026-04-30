import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ExpenseAutoRule, UncategorizedStatement, CategorizeResult, AccountingPurposeOption } from '../types/expense-categorization.types'

const KEYS = {
  rules: ['expense-categorization', 'rules'] as const,
  uncategorized: (params: Record<string, unknown>) => ['expense-categorization', 'uncategorized', params] as const,
  purposes: ['expense-categorization', 'purposes'] as const,
}

export const useExpenseRules = () =>
  useQuery({
    queryKey: KEYS.rules,
    queryFn: async () => {
      const { data } = await api.get('/expense-categorization/rules')
      return data.data as ExpenseAutoRule[]
    },
    staleTime: 3 * 60_000,
  })

export const useUncategorized = (params: { bank_account_id?: number; purpose_id?: string; categorized?: string; search?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: KEYS.uncategorized(params),
    queryFn: async () => {
      const { data } = await api.get('/expense-categorization/uncategorized', { params })
      return { data: data.data as UncategorizedStatement[], pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useExpensePurposes = () =>
  useQuery({
    queryKey: KEYS.purposes,
    queryFn: async () => {
      const [expenseRes, bankRes] = await Promise.all([
        api.get('/accounting-purposes', { params: { applied_to: 'EXPENSE', limit: 100 } }),
        api.get('/accounting-purposes', { params: { applied_to: 'BANK', limit: 100 } }),
      ])
      return [...(expenseRes.data.data || []), ...(bankRes.data.data || [])] as AccountingPurposeOption[]
    },
    staleTime: 5 * 60_000,
  })

export const useCreateRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { purpose_id: string; pattern: string; match_type?: string; priority?: number }) => {
      const { data } = await api.post('/expense-categorization/rules', body)
      return data.data as ExpenseAutoRule
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.rules }),
  })
}

export const useUpdateRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; purpose_id?: string; pattern?: string; match_type?: string; priority?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/expense-categorization/rules/${id}`, body)
      return data.data as ExpenseAutoRule
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.rules }),
  })
}

export const useDeleteRule = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/expense-categorization/rules/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.rules }),
  })
}

export const useAutoCategorize = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { bank_account_id?: number; date_from?: string; date_to?: string; dry_run?: boolean }) => {
      const { data } = await api.post('/expense-categorization/auto', body)
      return data.data as CategorizeResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categorization', 'uncategorized'] })
      qc.invalidateQueries({ queryKey: ['cash-flow'] })
    },
  })
}

export const useManualCategorize = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { statement_ids: number[]; purpose_id: string }) => {
      const { data } = await api.post('/expense-categorization/manual', body)
      return data.data as { count: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categorization', 'uncategorized'] })
      qc.invalidateQueries({ queryKey: ['cash-flow'] })
    },
  })
}

export const useUncategorize = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { statement_ids: number[] }) => {
      const { data } = await api.post('/expense-categorization/uncategorize', body)
      return data.data as { count: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categorization', 'uncategorized'] })
      qc.invalidateQueries({ queryKey: ['cash-flow'] })
    },
  })
}
