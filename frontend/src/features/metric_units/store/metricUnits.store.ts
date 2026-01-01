import { create } from 'zustand'
import { metricUnitsApi } from '../api/metricUnits.api'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto, PaginationParams, SortParams, FilterParams, FilterOptions } from '../types'
import { getErrorMessage } from '../utils/errors'

interface MetricUnitsState {
  metricUnits: MetricUnit[]
  currentMetricUnit: MetricUnit | null
  loading: boolean
  error: string | null
  pagination: PaginationParams
  sort: SortParams | null
  filter: FilterParams | null
  filterOptions: FilterOptions | null
  currentRequestId: number
  
  fetchMetricUnits: (page?: number, limit?: number) => Promise<void>
  fetchMetricUnitById: (id: string) => Promise<MetricUnit>
  searchMetricUnits: (q: string) => Promise<void>
  createMetricUnit: (data: CreateMetricUnitDto) => Promise<MetricUnit>
  updateMetricUnit: (id: string, data: UpdateMetricUnitDto) => Promise<MetricUnit>
  deleteMetricUnit: (id: string) => Promise<void>
  restoreMetricUnit: (id: string) => Promise<void>
  bulkUpdateStatus: (ids: string[], isActive: boolean) => Promise<void>
  fetchFilterOptions: () => Promise<void>
  setPage: (page: number) => void
  setSort: (sort: SortParams | null) => void
  setFilter: (filter: FilterParams | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  metricUnits: [],
  currentMetricUnit: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  sort: null,
  filter: null,
  filterOptions: null,
  currentRequestId: 0
}

export const useMetricUnitsStore = create<MetricUnitsState>((set, get) => ({
  ...initialState,

  fetchMetricUnits: async (page, limit) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, loading: true, error: null })
    
    const state = get()
    const currentPage = page ?? state.pagination.page
    const currentLimit = limit ?? state.pagination.limit
    
    try {
      const res = await metricUnitsApi.list(currentPage, currentLimit, state.sort, state.filter)
      
      if (get().currentRequestId === requestId) {
        set({ metricUnits: res.data, pagination: res.pagination, loading: false })
      }
    } catch (error: unknown) {
      if (get().currentRequestId === requestId) {
        set({ error: getErrorMessage(error), loading: false })
      }
    }
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

  searchMetricUnits: async (q) => {
    const currentPagination = get().pagination
    set({ 
      filter: { q }, 
      pagination: { ...currentPagination, page: 1 } 
    })
    await get().fetchMetricUnits()
  },

  createMetricUnit: async (data) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.create(data)
      set(state => ({
        metricUnits: [metricUnit, ...state.metricUnits],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false
      }))
      return metricUnit
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateMetricUnit: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.update(id, data)
      set(state => ({
        metricUnits: state.metricUnits.map(m => m.id === id ? metricUnit : m),
        currentMetricUnit: state.currentMetricUnit?.id === id ? metricUnit : state.currentMetricUnit,
        loading: false
      }))
      return metricUnit
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteMetricUnit: async (id) => {
    set({ loading: true, error: null })
    try {
      await metricUnitsApi.delete(id)
      set(state => ({
        metricUnits: state.metricUnits.filter(m => m.id !== id),
        pagination: { ...state.pagination, total: state.pagination.total - 1 },
        loading: false
      }))
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  restoreMetricUnit: async (id) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.restore(id)
      set(state => ({
        metricUnits: state.metricUnits.map(m => m.id === id ? metricUnit : m),
        loading: false
      }))
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  bulkUpdateStatus: async (ids, isActive) => {
    set({ loading: true, error: null })
    try {
      await metricUnitsApi.bulkUpdateStatus(ids, isActive)
      set(state => ({
        metricUnits: state.metricUnits.map(m => ids.includes(m.id) ? { ...m, is_active: isActive } : m),
        loading: false
      }))
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchFilterOptions: async () => {
    try {
      const options = await metricUnitsApi.getFilterOptions()
      set({ filterOptions: options })
    } catch (error: unknown) {
      console.error('Failed to fetch filter options:', error)
    }
  },

  setPage: (page) => {
    set(state => ({ pagination: { ...state.pagination, page } }))
    get().fetchMetricUnits()
  },

  setSort: (sort) => {
    set({ sort })
    get().fetchMetricUnits()
  },

  setFilter: (filter) => {
    set({ filter, pagination: { ...get().pagination, page: 1 } })
    get().fetchMetricUnits()
  },

  clearError: () => set({ error: null }),
  
  reset: () => set(initialState)
}))
