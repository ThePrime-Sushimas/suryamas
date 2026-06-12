import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  MonthlyStockOpname,
  MonthlyStockOpnameDetail,
  MonthlyStockOpnameLine,
  CreateMonthlyOpnameDto,
  UpdateLineDto,
  BulkUpdateLinesDto,
  MonthlyOpnameThermalData,
  MonthlyOpnameReopenRequestWithRelations,
  MonthlyOpnameStatus,
} from '../types'

// ─── KEYS ────────────────────────────────────────────────────────────────────

const KEYS = {
  list: (p: Record<string, unknown>) => ['monthly-stock-opname', p] as const,
  detail: (id: string) => ['monthly-stock-opname', id] as const,
  reopenRequests: (id: string) => ['monthly-stock-opname', id, 'reopen-requests'] as const,
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export const useMonthlyOpnameList = (params: {
  page?: number
  limit?: number
  branch_id?: string
  warehouse_id?: string
  status?: MonthlyOpnameStatus | ''
  date_from?: string
  date_to?: string
  search?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get('/monthly-stock-opname', {
        params: { page: 1, limit: 25, ...params },
      })
      return { data: data.data as MonthlyStockOpname[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

// ─── DETAIL ──────────────────────────────────────────────────────────────────

export const useMonthlyOpnameDetail = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/monthly-stock-opname/${id}`)
      return data.data as MonthlyStockOpnameDetail
    },
    enabled: !!id,
    staleTime: 15_000,
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const useCreateMonthlyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateMonthlyOpnameDto) => {
      const { data } = await api.post('/monthly-stock-opname', body)
      return data.data as MonthlyStockOpnameDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly-stock-opname'] }),
  })
}

// ─── UPDATE LINE ─────────────────────────────────────────────────────────────

export const useUpdateMonthlyOpnameLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, lineId, body }: {
      sessionId: string
      lineId: string
      body: UpdateLineDto
    }) => {
      const { data } = await api.patch(
        `/monthly-stock-opname/${sessionId}/lines/${lineId}`,
        body,
      )
      return data.data as MonthlyStockOpnameLine
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

// ─── BULK UPDATE LINES ───────────────────────────────────────────────────────

export const useBulkUpdateMonthlyOpnameLines = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: {
      sessionId: string
      body: BulkUpdateLinesDto
    }) => {
      const { data } = await api.post(
        `/monthly-stock-opname/${sessionId}/lines/bulk`,
        body,
      )
      return data.data as MonthlyStockOpnameLine[]
    },
    onSuccess: (_, { sessionId }) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) }),
  })
}

// ─── RECALCULATE ─────────────────────────────────────────────────────────────

export const useRecalculateMonthlyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/monthly-stock-opname/${id}/recalculate`)
      return data.data as MonthlyStockOpnameDetail
    },
    onSuccess: (_, id) =>
      qc.invalidateQueries({ queryKey: KEYS.detail(id) }),
  })
}

// ─── CONFIRM ─────────────────────────────────────────────────────────────────

export const useConfirmMonthlyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/monthly-stock-opname/${id}/confirm`)
      return data.data as MonthlyStockOpnameDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly-stock-opname'] }),
  })
}

// ─── CANCEL ──────────────────────────────────────────────────────────────────

export const useCancelMonthlyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/monthly-stock-opname/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly-stock-opname'] }),
  })
}

// ─── THERMAL PRINT ───────────────────────────────────────────────────────────

export const useMonthlyOpnameThermalData = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['monthly-stock-opname', id, 'thermal'],
    queryFn: async () => {
      const { data } = await api.get(`/monthly-stock-opname/${id}/thermal`)
      return data.data as MonthlyOpnameThermalData
    },
    enabled: !!id && enabled,
  })

// ─── REOPEN REQUESTS ─────────────────────────────────────────────────────────

export const useMonthlyOpnameReopenRequests = (id: string) =>
  useQuery({
    queryKey: KEYS.reopenRequests(id),
    queryFn: async () => {
      const { data } = await api.get(`/monthly-stock-opname/${id}/reopen-requests`)
      return data.data as MonthlyOpnameReopenRequestWithRelations[]
    },
    enabled: !!id,
  })

export const useCreateMonthlyOpnameReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: {
      sessionId: string
      body: { reason: string }
    }) => {
      const { data } = await api.post(
        `/monthly-stock-opname/${sessionId}/reopen-requests`,
        body,
      )
      return data.data as MonthlyOpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}

export const useApproveMonthlyOpnameReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variables: {
      requestId: string
      sessionId: string
      body: { response_note?: string }
    }) => {
      const { data } = await api.post(
        `/monthly-stock-opname/reopen-requests/${variables.requestId}/approve`,
        variables.body,
      )
      return data.data as MonthlyOpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}

export const useRejectMonthlyOpnameReopenRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (variables: {
      requestId: string
      sessionId: string
      body: { response_note?: string }
    }) => {
      const { data } = await api.post(
        `/monthly-stock-opname/reopen-requests/${variables.requestId}/reject`,
        variables.body,
      )
      return data.data as MonthlyOpnameReopenRequestWithRelations
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: KEYS.reopenRequests(sessionId) })
    },
  })
}
