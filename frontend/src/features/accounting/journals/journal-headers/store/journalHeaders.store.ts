import { create } from 'zustand'
import { journalHeadersApi } from '../api/journalHeaders.api'
import type {
  JournalHeaderWithLines,
  CreateJournalDto,
  UpdateJournalDto,
  RejectJournalDto,
  ReverseJournalDto,
  JournalHeaderFilter,
} from '../types/journal-header.types'

interface JournalHeadersState {
  journals: JournalHeaderWithLines[]
  selectedJournal: JournalHeaderWithLines | null
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
  filters: JournalHeaderFilter
  hasAppliedFilters: boolean
  
  fetchJournals: (filters?: Partial<JournalHeaderFilter>) => Promise<void>
  fetchJournalsWithLines: (filters?: Partial<JournalHeaderFilter>) => Promise<void>
  fetchJournalById: (id: string) => Promise<void>
  createJournal: (dto: CreateJournalDto) => Promise<JournalHeaderWithLines>
  updateJournal: (id: string, dto: UpdateJournalDto) => Promise<void>
  deleteJournal: (id: string) => Promise<void>
  restoreJournal: (id: string) => Promise<void>
  submitJournal: (id: string) => Promise<void>
  approveJournal: (id: string) => Promise<void>
  rejectJournal: (id: string, dto: RejectJournalDto) => Promise<void>
  postJournal: (id: string) => Promise<void>
  reverseJournal: (id: string, dto: ReverseJournalDto) => Promise<JournalHeaderWithLines>
  setFilters: (filters: Partial<JournalHeaderFilter>) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  clearError: () => void
  clearSelectedJournal: () => void
  setHasAppliedFilters: (value: boolean) => void
  refresh: () => Promise<void>
}

export const useJournalHeadersStore = create<JournalHeadersState>((set, get) => ({
  journals: [],
  selectedJournal: null,
  loading: false,
  mutating: false,
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
  hasAppliedFilters: false,

  fetchJournals: async (filters?: Partial<JournalHeaderFilter>) => {
    set({ loading: true, error: null })
    try {
      const { pagination } = get()
      const currentFilters = filters || get().filters
      const response = await journalHeadersApi.list({
        ...currentFilters,
        page: pagination.page,
        limit: pagination.limit,
      })
      set({
        journals: response.data as JournalHeaderWithLines[],
        pagination: response.pagination,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch journals' })
    } finally {
      set({ loading: false })
    }
  },

  fetchJournalsWithLines: async (filters?: Partial<JournalHeaderFilter>) => {
    set({ loading: true, error: null })
    try {
      const { pagination } = get()
      const currentFilters = filters || get().filters
      const response = await journalHeadersApi.listWithLines({
        ...currentFilters,
        page: pagination.page,
        limit: pagination.limit,
      })
      set({
        journals: response.data,
        pagination: response.pagination,
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch journals with lines' })
    } finally {
      set({ loading: false })
    }
  },

  fetchJournalById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const journal = await journalHeadersApi.getById(id)
      set({ selectedJournal: journal })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch journal' })
    } finally {
      set({ loading: false })
    }
  },

  createJournal: async (dto: CreateJournalDto) => {
    set({ mutating: true, error: null })
    try {
      const journal = await journalHeadersApi.create(dto)
      await get().fetchJournals()
      return journal
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  updateJournal: async (id: string, dto: UpdateJournalDto) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.update(id, dto)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  deleteJournal: async (id: string) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.delete(id)
      await get().fetchJournals()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  restoreJournal: async (id: string) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.restore(id)
      await get().fetchJournals()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to restore journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  submitJournal: async (id: string) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.submit(id)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to submit journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  approveJournal: async (id: string) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.approve(id)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to approve journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  rejectJournal: async (id: string, dto: RejectJournalDto) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.reject(id, dto)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reject journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  postJournal: async (id: string) => {
    set({ mutating: true, error: null })
    try {
      await journalHeadersApi.post(id)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to post journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  reverseJournal: async (id: string, dto: ReverseJournalDto) => {
    set({ mutating: true, error: null })
    try {
      const reversal = await journalHeadersApi.reverse(id, dto)
      await get().fetchJournals()

      if (get().selectedJournal?.id === id) {
        const updated = await journalHeadersApi.getById(id)
        set({ selectedJournal: updated })
      }

      return reversal
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reverse journal' })
      throw error
    } finally {
      set({ mutating: false })
    }
  },

  setFilters: (filters: Partial<JournalHeaderFilter>) => {
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

  clearSelectedJournal: () => set({ selectedJournal: null }),

  setHasAppliedFilters: (value: boolean) => set({ hasAppliedFilters: value }),

  refresh: async () => {
    await get().fetchJournals()
  },
}))
