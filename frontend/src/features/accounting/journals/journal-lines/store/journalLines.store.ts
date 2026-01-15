import { create } from 'zustand'
import { journalLinesApi } from '../api/journalLines.api'
import type {
  JournalLineWithDetails,
  JournalLineFilter,
  JournalLinesByAccountResponse,
} from '../types/journal-line.types'

interface JournalLinesState {
  lines: JournalLineWithDetails[]
  accountSummary: JournalLinesByAccountResponse | null
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: JournalLineFilter

  fetchLines: () => Promise<void>
  fetchLinesByJournal: (journalId: string) => Promise<void>
  fetchLinesByAccount: (accountId: string, filters?: JournalLineFilter) => Promise<void>
  setFilters: (filters: Partial<JournalLineFilter>) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  clearError: () => void
  clearLines: () => void
}

export const useJournalLinesStore = create<JournalLinesState>((set, get) => ({
  lines: [],
  accountSummary: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  filters: {},

  fetchLines: async () => {
    set({ loading: true, error: null })
    try {
      const { pagination, filters } = get()
      const response = await journalLinesApi.list({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      })
      set({
        lines: response.data,
        pagination: response.pagination,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch lines' })
    } finally {
      set({ loading: false })
    }
  },

  fetchLinesByJournal: async (journalId: string) => {
    set({ loading: true, error: null })
    try {
      const lines = await journalLinesApi.getByJournal(journalId)
      set({ lines })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch lines' })
    } finally {
      set({ loading: false })
    }
  },

  fetchLinesByAccount: async (accountId: string, filters?: JournalLineFilter) => {
    set({ loading: true, error: null })
    try {
      const response = await journalLinesApi.getByAccount(accountId, filters)
      set({
        lines: response.lines,
        accountSummary: response,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch lines by account' })
    } finally {
      set({ loading: false })
    }
  },

  setFilters: (filters: Partial<JournalLineFilter>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  setPage: (page: number) => {
    set((state) => ({
      pagination: { ...state.pagination, page },
    }))
  },

  setLimit: (limit: number) => {
    set((state) => ({
      pagination: { ...state.pagination, limit, page: 1 },
    }))
  },

  clearError: () => set({ error: null }),

  clearLines: () => set({ lines: [], accountSummary: null }),
}))
