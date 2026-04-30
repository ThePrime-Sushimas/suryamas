import { create } from 'zustand'
import { banksApi } from '../api/banks.api'
import type { Bank, BankOption, CreateBankDto, UpdateBankDto, BankListQuery, PaginationMeta } from '../types'

interface BanksState {
  banks: Bank[]
  currentBank: Bank | null
  options: BankOption[]
  pagination: PaginationMeta
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  currentRequestId: number
  
  fetchBanks: (query?: BankListQuery) => Promise<void>
  fetchPage: (page: number, limit?: number, query?: Omit<BankListQuery, 'page' | 'limit'>) => Promise<void>
  fetchBankById: (id: number) => Promise<Bank>
  createBank: (data: CreateBankDto) => Promise<Bank>
  updateBank: (id: number, data: UpdateBankDto) => Promise<Bank>
  deleteBank: (id: number) => Promise<void>
  fetchOptions: () => Promise<void>
  clearError: () => void
}

const initialPagination: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false }

export const useBanksStore = create<BanksState>((set, get) => ({
  banks: [],
  currentBank: null,
  options: [],
  pagination: initialPagination,
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  currentRequestId: 0,

  fetchBanks: async (query = {}) => {
    const requestId = get().currentRequestId + 1
    set({ currentRequestId: requestId, fetchLoading: true, error: null })
    try {
      const res = await banksApi.list(query)
      if (get().currentRequestId !== requestId) return
      set({ banks: res.data, pagination: res.pagination, fetchLoading: false })
    } catch (error: unknown) {
      if (get().currentRequestId !== requestId) return
      const message = error instanceof Error ? error.message : 'Gagal memuat data bank'
      set({ error: message, fetchLoading: false })
    }
  },

  fetchPage: (page, limit?, query?) => {
    const l = limit ?? get().pagination.limit
    set(state => ({ pagination: { ...state.pagination, page, limit: l } }))
    return get().fetchBanks({ ...query, page, limit: l })
  },

  fetchBankById: async (id) => {
    set({ fetchLoading: true, error: null })
    try {
      const bank = await banksApi.getById(id)
      set({ currentBank: bank, fetchLoading: false })
      return bank
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memuat data bank'
      set({ error: message, fetchLoading: false })
      throw error
    }
  },

  createBank: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const bank = await banksApi.create(data)
      set({ mutationLoading: false })
      return bank
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal membuat bank'
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
      const message = error instanceof Error ? error.message : 'Gagal memperbarui bank'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteBank: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await banksApi.delete(id)
      set({ mutationLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus bank'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  fetchOptions: async () => {
    try {
      const options = await banksApi.getOptions()
      set({ options })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memuat opsi bank'
      set({ error: message })
    }
  },

  clearError: () => set({ error: null })
}))
