import { create } from 'zustand'
import { metricUnitsApi } from '../api/metricUnits.api'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto, PaginationParams, SortParams, FilterParams, FilterOptions } from '../types'
import { getErrorMessage } from '../utils/errors'

interface MetricUnitsState {
  metricUnits: MetricUnit[]
  currentMetricUnit: MetricUnit | null
  loading: boolean
  mutationLoading: boolean
  error: string | null
  pagination: PaginationParams
  sort: SortParams | null
  filterOptions: FilterOptions | null
  currentRequestId: number
  
  fetchMetricUnits: (page?: number, limit?: number, sort?: SortParams | null, filter?: FilterParams | null) => Promise<void>
  fetchPage: (page: number, limit?: number, sort?: SortParams | null, filter?: FilterParams | null) => Promise<void>
  fetchMetricUnitById: (id: string) => Promise<MetricUnit>
  createMetricUnit: (data: CreateMetricUnitDto) => Promise<MetricUnit>
  updateMetricUnit: (id: string, data: UpdateMetricUnitDto) => Promise<MetricUnit>
  deleteMetricUnit: (id: string) => Promise<void>
  restoreMetricUnit: (id: string) => Promise<void>
  bulkUpdateStatus: (ids: string[], isActive: boolean) => Promise<void>
  fetchFilterOptions: () => Promise<void>
  clearError: () => void
}

const initialPagination: PaginationParams = { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false }

export const useMetricUnitsStore = create<MetricUnitsState>((set, get) => ({
  metricUnits: [],
  currentMetricUnit: null,
  loading: false,
  mutationLoading: false,
  error: null,
  pagination: initialPagination,
  sort: null,
  filterOptions: null,
  currentRequestId: 0,

  fetchMetricUnits: async (page, limit, sort, filter) => {
    const requestId = get().currentRequestId + 1
    const p = page ?? get().pagination.page
    const l = limit ?? get().pagination.limit
    const s = sort !== undefined ? sort : get().sort

    set({ currentRequestId: requestId, loading: true, error: null })
    try {
      const res = await metricUnitsApi.list(p, l, s, filter)
      if (get().currentRequestId !== requestId) return
      set({ metricUnits: res.data, pagination: res.pagination, loading: false })
    } catch (error: unknown) {
      if (get().currentRequestId !== requestId) return
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchPage: (page, limit?, sort?, filter?) => {
    const l = limit ?? get().pagination.limit
    set(state => ({ pagination: { ...state.pagination, page, limit: l } }))
    return get().fetchMetricUnits(page, l, sort, filter)
  },

  fetchMetricUnitById: async (id) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.getById(id)
      set({ currentMetricUnit: metricUnit, loading: false })
      return metricUnit
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  createMetricUnit: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.create(data)
      set({ mutationLoading: false })
      return metricUnit
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), mutationLoading: false })
      throw error
    }
  },

  updateMetricUnit: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.update(id, data)
      set(state => ({
        metricUnits: state.metricUnits.map(m => m.id === id ? metricUnit : m),
        currentMetricUnit: state.currentMetricUnit?.id === id ? metricUnit : state.currentMetricUnit,
        mutationLoading: false
      }))
      return metricUnit
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), mutationLoading: false })
      throw error
    }
  },

  deleteMetricUnit: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await metricUnitsApi.delete(id)
      set({ mutationLoading: false })
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), mutationLoading: false })
      throw error
    }
  },

  restoreMetricUnit: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.restore(id)
      set(state => ({
        metricUnits: state.metricUnits.map(m => m.id === id ? metricUnit : m),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), mutationLoading: false })
      throw error
    }
  },

  bulkUpdateStatus: async (ids, isActive) => {
    set({ mutationLoading: true, error: null })
    try {
      await metricUnitsApi.bulkUpdateStatus(ids, isActive)
      set(state => ({
        metricUnits: state.metricUnits.map(m => ids.includes(m.id) ? { ...m, is_active: isActive } : m),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), mutationLoading: false })
      throw error
    }
  },

  fetchFilterOptions: async () => {
    try {
      const options = await metricUnitsApi.getFilterOptions()
      set({ filterOptions: options })
    } catch (_) { /* silent */ }
  },

  clearError: () => set({ error: null })
}))
