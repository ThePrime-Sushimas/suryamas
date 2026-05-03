import { parseApiError } from '@/lib/errorParser'
import { create } from 'zustand'
import { fiscalPeriodsApi } from '../api/fiscalPeriods.api'
import type {
  FiscalPeriodWithDetails,
  CreateFiscalPeriodDto,
  UpdateFiscalPeriodDto,
  ClosePeriodDto,
  ClosePeriodWithEntriesDto,
  PeriodClosingSummary,
  ClosePeriodWithEntriesResult,
  FiscalPeriodFilter,
} from '../types/fiscal-period.types'

interface FiscalPeriodsState {
  periods: FiscalPeriodWithDetails[]
  selectedPeriod: FiscalPeriodWithDetails | null
  loading: boolean
  mutating: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: FiscalPeriodFilter

  fetchPeriods: () => Promise<void>
  fetchPeriodById: (id: string) => Promise<void>
  createPeriod: (dto: CreateFiscalPeriodDto) => Promise<void>
  updatePeriod: (id: string, dto: UpdateFiscalPeriodDto) => Promise<void>
  /** @deprecated Use closePeriodWithEntries instead */
  closePeriod: (id: string, dto: ClosePeriodDto) => Promise<void>
  getClosingPreview: (id: string) => Promise<PeriodClosingSummary>
  closePeriodWithEntries: (id: string, dto: ClosePeriodWithEntriesDto) => Promise<ClosePeriodWithEntriesResult>
  deletePeriod: (id: string) => Promise<void>
  bulkDeletePeriods: (ids: string[]) => Promise<void>
  restorePeriod: (id: string) => Promise<void>
  bulkRestorePeriods: (ids: string[]) => Promise<void>
  exportPeriods: () => Promise<void>
  setFilters: (filters: Partial<FiscalPeriodFilter>) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  clearError: () => void
  resetSelectedPeriod: () => void
  refresh: () => Promise<void>
}

export const useFiscalPeriodsStore = create<FiscalPeriodsState>((set, get) => ({
  periods: [],
  selectedPeriod: null,
  loading: false,
  mutating: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  filters: {},

  fetchPeriods: async () => {
    set({ loading: true, error: null })
    try {
      const { pagination, filters } = get()
      const response = await fiscalPeriodsApi.list({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      })
      set({
        periods: response.data || [],
        pagination: { ...get().pagination, ...response.pagination },
      })
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
    } finally {
      set({ loading: false })
    }
  },

  fetchPeriodById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const response = await fiscalPeriodsApi.getById(id)
      set({ selectedPeriod: response.data })
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
    } finally {
      set({ loading: false })
    }
  },

  createPeriod: async (dto) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.create(dto)
      await get().fetchPeriods()
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  updatePeriod: async (id, dto) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.update(id, dto)
      await get().fetchPeriods()
      if (get().selectedPeriod?.id === id) {
        const response = await fiscalPeriodsApi.getById(id)
        set({ selectedPeriod: response.data })
      }
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  /** @deprecated */
  closePeriod: async (id, dto) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.close(id, dto)
      await get().fetchPeriods()
      if (get().selectedPeriod?.id === id) {
        const response = await fiscalPeriodsApi.getById(id)
        set({ selectedPeriod: response.data })
      }
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  getClosingPreview: async (id) => {
    return fiscalPeriodsApi.getClosingPreview(id)
  },

  closePeriodWithEntries: async (id, dto) => {
    set({ mutating: true, error: null })
    try {
      const result = await fiscalPeriodsApi.closePeriodWithEntries(id, dto)
      await get().fetchPeriods()
      return result
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  deletePeriod: async (id) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.delete(id)
      await get().fetchPeriods()
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  bulkDeletePeriods: async (ids) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.bulkDelete(ids)
      await get().fetchPeriods()
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  restorePeriod: async (id) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.restore(id)
      await get().fetchPeriods()
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  bulkRestorePeriods: async (ids) => {
    set({ mutating: true, error: null })
    try {
      await fiscalPeriodsApi.bulkRestore(ids)
      await get().fetchPeriods()
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  exportPeriods: async () => {
    try {
      const token = await fiscalPeriodsApi.getExportToken()
      await fiscalPeriodsApi.export(token, get().filters)
    } catch (error) {
      set({ error: parseApiError(error, 'An error occurred') })
      throw error
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  setPage: (page) => set((state) => ({ pagination: { ...state.pagination, page } })),
  setLimit: (limit) => set((state) => ({ pagination: { ...state.pagination, limit, page: 1 } })),
  clearError: () => set({ error: null }),
  resetSelectedPeriod: () => set({ selectedPeriod: null }),
  refresh: async () => { await get().fetchPeriods() },
}))
