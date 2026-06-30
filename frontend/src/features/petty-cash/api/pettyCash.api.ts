import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { parseApiError } from '@/lib/errorParser'
import { useToast } from '@/contexts/ToastContext'
import type { PettyCashRequest, PettyCashExpense, PettyCashListQuery, UpdateExpenseDto } from '../types/pettyCash.types'

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

const KEYS = {
  all: ['petty-cash'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  list: (p: PettyCashListQuery) => [...KEYS.lists(), p] as const,
  details: () => [...KEYS.all, 'detail'] as const,
  detail: (id: string) => [...KEYS.details(), id] as const,
  expenses: (requestId: string) => [...KEYS.all, 'expenses', requestId] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const usePettyCashRequests = (params: PettyCashListQuery = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get('/petty-cash', { params })
      return {
        data: (data.data ?? []) as PettyCashRequest[],
        pagination: data.pagination as PaginationMeta,
      }
    },
  })

export const usePettyCashRequest = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/petty-cash/${id}`)
      return data.data as PettyCashRequest
    },
    enabled: !!id,
  })

export const usePettyCashExpenses = (requestId: string, params: { page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: [...KEYS.expenses(requestId), params],
    queryFn: async () => {
      const { data } = await api.get(`/petty-cash/${requestId}/expenses`, { params })
      return {
        data: (data.data ?? []) as PettyCashExpense[],
        pagination: data.pagination as PaginationMeta,
      }
    },
    enabled: !!requestId,
  })

// ─── Request Mutations ────────────────────────────────────────────────────────

export const useCreatePettyCashRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { branch_id: string; amount_requested: number; petty_cash_coa_id: string; description?: string }) => {
      const { data } = await api.post('/petty-cash', body)
      return data.data as PettyCashRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.lists() }),
  })
}

export const useApprovePettyCashRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; source_bank_account_id: number; amount_disbursed: number; notes?: string }) => {
      const { data } = await api.post(`/petty-cash/${id}/approve`, dto)
      return data.data as PettyCashRequest
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.lists() })
    },
  })
}

export const useRejectPettyCashRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejection_reason }: { id: string; rejection_reason: string }) => {
      const { data } = await api.post(`/petty-cash/${id}/reject`, { rejection_reason })
      return data.data as PettyCashRequest
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.lists() })
    },
  })
}

// ─── Expense Mutations ────────────────────────────────────────────────────────

export const useCreateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, ...dto }: {
      requestId: string
      category_id: string
      sub_category_id?: string
      expense_date?: string
      amount: number
      description?: string
      product_id?: string
      product_uom_id?: string
      warehouse_id?: string
      qty?: number
      unit_price?: number
      expense_coa_id?: string
      asset_category_id?: string
      asset_name?: string
      asset_qty?: number
      useful_life_months?: number
      salvage_value?: number
    }) => {
      const { data } = await api.post(`/petty-cash/${requestId}/expenses`, dto)
      return data.data as PettyCashExpense
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.expenses(vars.requestId) })
    },
  })
}

export const useUpdateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, requestId, ...dto }: { id: string; requestId: string } & UpdateExpenseDto) => {
      const { data } = await api.put(`/petty-cash/expenses/${id}`, dto)
      return data.data as PettyCashExpense
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.expenses(vars.requestId) })
    },
  })
}

export const useDeleteExpense = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, requestId }: { id: string; requestId: string }) => {
      await api.delete(`/petty-cash/expenses/${id}`)
      return { requestId }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.expenses(vars.requestId) })
      toast.success('Expense dihapus')
    },
  })
}

// ─── Settlement Mutations ─────────────────────────────────────────────────────

export const useCreateSettlement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, ...dto }: {
      requestId: string
      settlement_date?: string
      amount_returned: number
      return_bank_account_id?: number
      refill_amount?: number
      refill_bank_account_id?: number
      notes?: string
    }) => {
      const { data } = await api.post(`/petty-cash/${requestId}/settlement`, dto)
      return data.data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.lists() })
    },
  })
}

export const useVoidSettlement = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, requestId, reason }: { id: string; requestId: string; reason: string }) => {
      await api.post(`/petty-cash/settlements/${id}/void`, { reason })
      return { requestId }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.lists() })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal void settlement')),
  })
}

// ─── Receipt Upload ───────────────────────────────────────────────────────────

export const useUploadPettyCashReceipt = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ expenseId, file, requestId }: { expenseId: string; file: File; requestId: string }) => {
      const formData = new FormData()
      formData.append('receipt', file)
      const { data } = await api.post(
        `/petty-cash/expenses/${expenseId}/upload-receipt`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return { ...data.data, requestId }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.requestId) })
      qc.invalidateQueries({ queryKey: KEYS.expenses(vars.requestId) })
    },
  })
}