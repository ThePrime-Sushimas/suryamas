import { create } from 'zustand'
import { bankAccountsApi } from '../api/bankAccounts.api'
import type { BankAccount, CreateBankAccountDto, UpdateBankAccountDto } from '../types'

interface BankAccountsState {
  accounts: BankAccount[]
  currentAccount: BankAccount | null
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  
  fetchByOwner: (ownerType: 'company' | 'supplier', ownerId: string) => Promise<void>
  fetchById: (id: number) => Promise<BankAccount>
  create: (data: CreateBankAccountDto) => Promise<BankAccount>
  update: (id: number, data: UpdateBankAccountDto) => Promise<BankAccount>
  delete: (id: number) => Promise<void>
  clearError: () => void
}

const initialState = {
  accounts: [],
  currentAccount: null,
  fetchLoading: false,
  mutationLoading: false,
  error: null
}

export const useBankAccountsStore = create<BankAccountsState>((set) => ({
  ...initialState,

  fetchByOwner: async (ownerType, ownerId) => {
    set({ fetchLoading: true, error: null })
    try {
      const accounts = await bankAccountsApi.getByOwner(ownerType, ownerId)
      set({ accounts, fetchLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bank accounts'
      set({ error: message, fetchLoading: false })
    }
  },

  fetchById: async (id) => {
    set({ fetchLoading: true, error: null })
    try {
      const account = await bankAccountsApi.getById(id)
      set({ currentAccount: account, fetchLoading: false })
      return account
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bank account'
      set({ error: message, fetchLoading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to create bank account'
      set({ error: message, mutationLoading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to update bank account'
      set({ error: message, mutationLoading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to delete bank account'
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
