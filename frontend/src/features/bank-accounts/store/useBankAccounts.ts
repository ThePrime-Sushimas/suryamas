import { create } from 'zustand'
import { bankAccountsApi } from '../api/bankAccounts.api'
import { parseApiError } from '@/lib/errorParser'
import type { BankAccount, CreateBankAccountDto, UpdateBankAccountDto, CoaOption } from '../types'

interface BankAccountsState {
  accounts: BankAccount[]
  currentAccount: BankAccount | null
  coaOptions: CoaOption[]
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  
  fetchByOwner: (ownerType: 'company' | 'supplier', ownerId: string) => Promise<void>
  fetchById: (id: number) => Promise<BankAccount>
  create: (data: CreateBankAccountDto) => Promise<BankAccount>
  update: (id: number, data: UpdateBankAccountDto) => Promise<BankAccount>
  delete: (id: number) => Promise<void>
  fetchCoaOptions: (companyId: string) => Promise<void>
  clearError: () => void
}

export const useBankAccountsStore = create<BankAccountsState>((set) => ({
  accounts: [],
  currentAccount: null,
  coaOptions: [],
  fetchLoading: false,
  mutationLoading: false,
  error: null,

  fetchByOwner: async (ownerType, ownerId) => {
    set({ fetchLoading: true, error: null })
    try {
      const accounts = await bankAccountsApi.getByOwner(ownerType, ownerId)
      set({ accounts, fetchLoading: false })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat rekening bank'), fetchLoading: false })
    }
  },

  fetchById: async (id) => {
    set({ fetchLoading: true, error: null })
    try {
      const account = await bankAccountsApi.getById(id)
      set({ currentAccount: account, fetchLoading: false })
      return account
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat rekening bank'), fetchLoading: false })
      throw error
    }
  },

  create: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const account = await bankAccountsApi.create(data)
      set(state => ({
        accounts: [...state.accounts, account],
        mutationLoading: false
      }))
      return account
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat rekening bank'), mutationLoading: false })
      throw error
    }
  },

  update: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const account = await bankAccountsApi.update(id, data)
      set(state => ({
        accounts: state.accounts.map(a => a.id === id ? account : a),
        currentAccount: state.currentAccount?.id === id ? account : state.currentAccount,
        mutationLoading: false
      }))
      return account
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memperbarui rekening bank'), mutationLoading: false })
      throw error
    }
  },

  delete: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await bankAccountsApi.delete(id)
      set(state => ({
        accounts: state.accounts.filter(a => a.id !== id),
        mutationLoading: false
      }))
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal menghapus rekening bank'), mutationLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  fetchCoaOptions: async (companyId: string) => {
    try {
      const options = await bankAccountsApi.getCoaOptions(companyId)
      set({ coaOptions: options })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat opsi COA') })
    }
  }
}))
