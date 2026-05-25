import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type DpoStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface DailyPrepOrderLine {
  id: string
  dpo_id: string
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  avg_sales_7d: number
  avg_sales_30d: number
  avg_sales_dow: number
  holiday_factor: number
  coverage_days: number
  predicted_need: number
  current_ready_stock: number
  current_main_stock: number
  live_ready_stock: number
  live_main_stock: number
  suggested_qty: number
  confirmed_qty: number | null
  uom: string
  out_movement_id: string | null
  in_movement_id: string | null
  notes: string | null
  sort_order: number
}

export interface DailyPrepOrder {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  branch_code: string
  dpo_number: string
  prep_date: string
  status: DpoStatus
  source_warehouse_id: string
  source_warehouse_name: string
  target_warehouse_id: string
  target_warehouse_name: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor_applied: number
  has_upcoming_holiday: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  confirmed_by_name: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  lock_token: string | null
  locked_at: string | null
  locked_by: string | null
  notes: string | null
  line_count: number
  created_at: string
  lines?: DailyPrepOrderLine[]
}

export interface DpoForecastConfig {
  id: string
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short: number
  lookback_days_long: number
  is_active: boolean
}

export interface PublicHoliday {
  id: string
  holiday_date: string
  holiday_name: string
}

// ─── KEYS ────────────────────────────────────────────────────────────────────

const KEYS = {
  list: (p: Record<string, unknown>) => ['daily-prep-orders', p] as const,
  detail: (id: string) => ['daily-prep-orders', id] as const,
  config: (branchId: string) => ['daily-prep-orders', 'config', branchId] as const,
  holidays: (year: number) => ['daily-prep-orders', 'holidays', year] as const,
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export const useDailyPrepOrders = (params: {
  page?: number; limit?: number; branch_id?: string
  status?: DpoStatus; date_from?: string; date_to?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get('/daily-prep-orders', { params: { page: 1, limit: 25, ...params } })
      return { data: data.data as DailyPrepOrder[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

// ─── DETAIL ──────────────────────────────────────────────────────────────────

export const useDailyPrepOrder = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/daily-prep-orders/${id}`)
      return data.data as DailyPrepOrder
    },
    enabled: !!id,
  })

// ─── GENERATE ────────────────────────────────────────────────────────────────

export const useGenerateDpo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      branch_id: string; prep_date: string
      source_warehouse_id: string; target_warehouse_id: string
      notes?: string | null
    }) => {
      const { data } = await api.post('/daily-prep-orders/generate', body)
      return data.data as DailyPrepOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders'] }),
  })
}

// ─── UPDATE LINES ────────────────────────────────────────────────────────────

export const useUpdateDpoLines = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lines }: {
      id: string
      lines: { id: string; confirmed_qty: number | null; notes?: string | null }[]
    }) => {
      const { data } = await api.put(`/daily-prep-orders/${id}/lines`, { lines })
      return data.data as DailyPrepOrder
    },
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: KEYS.detail(id) }),
  })
}

export const useDeleteDpoLine = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lineId }: { id: string; lineId: string }) => {
      await api.delete(`/daily-prep-orders/${id}/lines/${lineId}`)
    },
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: KEYS.detail(id) }),
  })
}

// ─── LOCK / CONFIRM / CANCEL ─────────────────────────────────────────────────

export const useAcquireDpoLock = () =>
  useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/daily-prep-orders/${id}/acquire-lock`)
      return data.data as { lock_token: string }
    },
  })

export const useConfirmDpo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lock_token }: { id: string; lock_token: string }) => {
      const { data } = await api.post(`/daily-prep-orders/${id}/confirm`, { lock_token })
      return data.data as DailyPrepOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders'] }),
  })
}

export const useCancelDpo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/daily-prep-orders/${id}/cancel`, { reason })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders'] }),
  })
}

export const useDeleteDpo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/daily-prep-orders/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders'] }),
  })
}

// ─── FORECAST CONFIG ─────────────────────────────────────────────────────────

export const useDpoForecastConfig = (branchId: string) =>
  useQuery({
    queryKey: KEYS.config(branchId),
    queryFn: async () => {
      const { data } = await api.get(`/daily-prep-orders/config/${branchId}`)
      return data.data as DpoForecastConfig | null
    },
    enabled: !!branchId,
  })

export const useUpsertDpoForecastConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      branch_id: string; weight_7d: number; weight_30d: number
      weight_dow: number; coverage_days: number; holiday_factor: number
      lookback_days_short?: number; lookback_days_long?: number
    }) => {
      const { data } = await api.put('/daily-prep-orders/config', body)
      return data.data as DpoForecastConfig
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: KEYS.config(vars.branch_id) }),
  })
}

// ─── HOLIDAYS ────────────────────────────────────────────────────────────────

export const usePublicHolidays = (year: number) =>
  useQuery({
    queryKey: KEYS.holidays(year),
    queryFn: async () => {
      const { data } = await api.get('/daily-prep-orders/holidays', {
        params: { from: `${year}-01-01`, to: `${year}-12-31` }
      })
      return data.data as PublicHoliday[]
    },
  })

export const useUpsertHoliday = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { holiday_date: string; holiday_name: string }) => {
      const { data } = await api.put('/daily-prep-orders/holidays', body)
      return data.data as PublicHoliday
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders', 'holidays'] }),
  })
}

export const useDeleteHoliday = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (holidayId: string) => {
      await api.delete(`/daily-prep-orders/holidays/${holidayId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders', 'holidays'] }),
  })
}