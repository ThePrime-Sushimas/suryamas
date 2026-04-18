import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  AccountPeriodBalance,
  OpeningBalanceSuggestion,
  GroupsResponse,
  PaymentMethodGroup,
  CreateGroupPayload,
  UpdateGroupPayload,
  CashFlowDailyResult,
  Branch,
  CreatePeriodFormData,
  UpdatePeriodFormData,
  GetRunningBalanceQuery,
} from '../types/cash-flow.types'

// ============================================================
// Query Keys
// ============================================================

export const cashFlowKeys = {
  all: ['cash-flow'] as const,
  periods: (bankId: number) => [...cashFlowKeys.all, 'periods', bankId] as const,
  suggestion: (bankId: number, periodStart: string) =>
    [...cashFlowKeys.all, 'suggestion', bankId, periodStart] as const,
  groups: (companyId?: string) => [...cashFlowKeys.all, 'groups', companyId] as const,
  daily: (params: GetRunningBalanceQuery) =>
    [...cashFlowKeys.all, 'daily', params] as const,
  branches: () => [...cashFlowKeys.all, 'branches'] as const,
}

// ============================================================
// Period Balance
// ============================================================

export const useListPeriods = (bankAccountId: number) =>
  useQuery({
    queryKey: cashFlowKeys.periods(bankAccountId),
    queryFn: async () => {
      const { data } = await api.get('/cash-flow/periods', {
        params: { bank_account_id: bankAccountId },
      })
      return data.data as AccountPeriodBalance[]
    },
    enabled: !!bankAccountId,
  })

export const useSuggestOpeningBalance = (bankId: number, periodStart: string) =>
  useQuery({
    queryKey: cashFlowKeys.suggestion(bankId, periodStart),
    queryFn: async () => {
      const { data } = await api.get('/cash-flow/suggestion', {
        params: { bank_account_id: bankId, period_start: periodStart },
      })
      return data.data as OpeningBalanceSuggestion
    },
    enabled: !!bankId && !!periodStart,
  })

export const useCreatePeriod = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePeriodFormData) => {
      const { data } = await api.post('/cash-flow/periods', payload)
      return data.data as AccountPeriodBalance
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: cashFlowKeys.periods(v.bank_account_id) })
      qc.invalidateQueries({ queryKey: cashFlowKeys.all })
    },
  })
}

export const useUpdatePeriod = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdatePeriodFormData & { bank_account_id: number }) => {
      const { bank_account_id, ...body } = payload
      const { data } = await api.put(`/cash-flow/periods/${id}`, body)
      return { data: data.data as AccountPeriodBalance, bank_account_id }
    },
    onSuccess: ({ bank_account_id }) => {
      qc.invalidateQueries({ queryKey: cashFlowKeys.periods(bank_account_id) })
      qc.invalidateQueries({ queryKey: cashFlowKeys.all })
    },
  })
}

export const useDeletePeriod = (id: string, bankAccountId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { await api.delete(`/cash-flow/periods/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cashFlowKeys.periods(bankAccountId) })
      qc.invalidateQueries({ queryKey: cashFlowKeys.all })
    },
  })
}

// ============================================================
// Payment Method Groups
// ============================================================

export const useGroups = () =>
  useQuery({
    queryKey: cashFlowKeys.groups(),
    queryFn: async () => {
      const { data } = await api.get('/cash-flow/groups')
      return data.data as GroupsResponse
    },
  })

export const useCreateGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateGroupPayload) => {
      const { data } = await api.post('/cash-flow/groups', payload)
      return data.data as PaymentMethodGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cashFlowKeys.groups() }),
  })
}

export const useUpdateGroup = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateGroupPayload) => {
      const { data } = await api.put(`/cash-flow/groups/${id}`, payload)
      return data.data as PaymentMethodGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cashFlowKeys.groups() }),
  })
}

export const useDeleteGroup = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { await api.delete(`/cash-flow/groups/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: cashFlowKeys.groups() }),
  })
}

export const useReorderGroups = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await api.put('/cash-flow/groups/reorder', { ordered_ids: orderedIds })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cashFlowKeys.groups() }),
  })
}

// ============================================================
// Cash Flow Daily
// ============================================================

export const useCashFlowDaily = (params: GetRunningBalanceQuery) =>
  useQuery({
    queryKey: cashFlowKeys.daily(params),
    queryFn: async () => {
      const { data } = await api.get('/cash-flow/daily', { params })
      return data.data as CashFlowDailyResult
    },
    enabled: !!params.bank_account_id && !!params.date_from && !!params.date_to,
  })

export const useBranches = () =>
  useQuery({
    queryKey: cashFlowKeys.branches(),
    queryFn: async () => {
      const { data } = await api.get('/cash-flow/branches')
      return data.data as Branch[]
    },
  })
