import { create } from 'zustand'
import { banksApi } from '../api/banks.api'
import type { Bank, BankOption, CreateBankDto, UpdateBankDto, PaginationMeta } from '../types'

interface BanksState {
  banks: Bank[]
  currentBank: Bank | null
  options: BankOption[]
  pagination: PaginationMeta
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  searchQuery: string
  activeFilter: boolean | undefined
  
  fetchBanks: (page?: number, limit?: number) => Promise<void>
  fetchBankById: (id: number) => Promise<Bank>
  searchBanks: (search: string) => void
  filterByStatus: (isActive: boolean | undefined) => void
  createBank: (data: CreateBankDto) => Promise<Bank>
  updateBank: (id: number, data: UpdateBankDto) => Promise<Bank>
  deleteBank: (id: number) => Promise<void>
  fetchOptions: () => Promise<void>
  clearError: () => void
}

const initialState = {
  banks: [],
  currentBank: null,
  options: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  searchQuery: '',
  activeFilter: undefined
}

export const useBanksStore = create<BanksState>((set, get) => ({
  ...initialState,

  fetchBanks: async (page = 1, limit = 10) => {
    set({ fetchLoading: true, error: null })
    
    try {
      const { searchQuery, activeFilter } = get()
      const res = await banksApi.list({ 
        page, 
        limit, 
        search: searchQuery || undefined,
        is_active: activeFilter 
      })
      
      set({
        banks: res.data,
        pagination: res.pagination,
        fetchLoading: false
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch banks'
      set({ error: message, fetchLoading: false })
    }
  },

  fetchBankById: async (id) => {
    set({ fetchLoading: true, error: null })
    try {
      const bank = await banksApi.getById(id)
      set({ currentBank: bank, fetchLoading: false })
      return bank
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bank'
      set({ error: message, fetchLoading: false })
      throw error
    }
  },

  searchBanks: (search) => {
    set({ searchQuery: search })
    get().fetchBanks(1, get().pagination.limit)
  },

  filterByStatus: (isActive) => {
    set({ activeFilter: isActive })
    get().fetchBanks(1, get().pagination.limit)
  },

  createBank: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const bank = await banksApi.create(data)
      set({ mutationLoading: false })
      get().fetchBanks(get().pagination.page, get().pagination.limit)
      return bank
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create bank'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateBank: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const bank = await banksApi.update(id, data)
      set(state => ({
        banks: state.banks.map(b => b.id === id ? bank : b),
        currentBank: state.currentBank?.id === id ? bank : state.currentBank,
        mutationLoading: false
      }))
      return bank
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update bank'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteBank: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await banksApi.delete(id)
      set({ mutationLoading: false })
      get().fetchBanks(get().pagination.page, get().pagination.limit)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete bank'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  fetchOptions: async () => {
    try {
      const options = await banksApi.getOptions()
      set({ options })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bank options'
      set({ error: message })
    }
  },

  clearError: () => set({ error: null })
}))
