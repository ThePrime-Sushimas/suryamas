import { create } from 'zustand'
import { accountingPurposeAccountsApi } from '../api/accountingPurposeAccounts.api'
import type { 
  AccountingPurposeAccountWithDetails, 
  CreateAccountingPurposeAccountDto, 
  UpdateAccountingPurposeAccountDto,
  BulkCreateAccountingPurposeAccountDto,
  BulkRemoveAccountingPurposeAccountDto,
  AccountingPurposeAccountFilter,
  ChartOfAccount,
  AccountingPurpose
} from '../types/accounting-purpose-account.types'

interface LoadingState {
  list: boolean
  detail: boolean
  submit: boolean
  bulk: boolean
  export: boolean
}

interface ErrorState {
  scope: 'list' | 'detail' | 'submit' | 'bulk' | 'export'
  message: string
}

interface ListParams {
  page: number
  limit: number
  sort?: { field: string; order: string }
  filter?: AccountingPurposeAccountFilter
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AccountingPurposeAccountsState {
  accounts: AccountingPurposeAccountWithDetails[]
  selectedAccount: AccountingPurposeAccountWithDetails | null
  postableAccounts: ChartOfAccount[]
  activePurposes: AccountingPurpose[]
  loading: LoadingState
  error: ErrorState | null
  pagination: Pagination
  listParams: ListParams
  
  fetchAccounts: (page: number, limit: number, sort?: { field: string; order: string }, filter?: AccountingPurposeAccountFilter) => Promise<void>
  getAccountById: (id: string) => Promise<AccountingPurposeAccountWithDetails>
  createAccount: (data: CreateAccountingPurposeAccountDto) => Promise<AccountingPurposeAccountWithDetails>
  updateAccount: (id: string, data: UpdateAccountingPurposeAccountDto) => Promise<AccountingPurposeAccountWithDetails>
  deleteAccount: (id: string) => Promise<void>
  bulkCreate: (data: BulkCreateAccountingPurposeAccountDto) => Promise<AccountingPurposeAccountWithDetails[]>
  bulkRemove: (data: BulkRemoveAccountingPurposeAccountDto) => Promise<void>
  bulkUpdateStatus: (ids: string[], is_active: boolean) => Promise<void>
  exportAccounts: (filter?: AccountingPurposeAccountFilter) => Promise<Blob>
  fetchPostableAccounts: () => Promise<void>
  fetchActivePurposes: () => Promise<void>
  refreshCurrentState: () => Promise<void>
  setError: (scope: ErrorState['scope'], message: string) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  accounts: [],
  selectedAccount: null,
  postableAccounts: [],
  activePurposes: [],
  loading: { list: false, detail: false, submit: false, bulk: false, export: false },
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
  listParams: { page: 1, limit: 25 }
}

const calculateTotalPages = (total: number, limit: number) => {
  if (limit === 0) return 0
  return Math.ceil(total / limit)
}

export const useAccountingPurposeAccountsStore = create<AccountingPurposeAccountsState>((set, get) => ({
  ...initialState,

  fetchAccounts: async (page, limit, sort, filter) => {
    set(state => ({ 
      loading: { ...state.loading, list: true }, 
      error: null,
      listParams: { page, limit, sort, filter }
    }))
    try {
      const res = await accountingPurposeAccountsApi.list(page, limit, sort, filter)
      set(state => ({ 
        accounts: res.data, 
        loading: { ...state.loading, list: false },
        pagination: {
          ...res.pagination,
          totalPages: calculateTotalPages(res.pagination.total, res.pagination.limit)
        }
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch accounts'
      set(state => ({ 
        loading: { ...state.loading, list: false },
        error: { scope: 'list', message }
      }))
    }
  },

  getAccountById: async (id) => {
    set(state => ({ loading: { ...state.loading, detail: true }, error: null }))
    try {
      const account = await accountingPurposeAccountsApi.getById(id)
      set(state => ({ selectedAccount: account, loading: { ...state.loading, detail: false } }))
      return account
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Account not found'
      set(state => ({ 
        loading: { ...state.loading, detail: false },
        error: { scope: 'detail', message }
      }))
      throw error
    }
  },

  createAccount: async (data) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      const account = await accountingPurposeAccountsApi.create(data)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      const { listParams } = get()
      await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      
      return account
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create account'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  updateAccount: async (id, data) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      const account = await accountingPurposeAccountsApi.update(id, data)
      set(state => ({
        accounts: state.accounts.map(a => a.id === id ? account : a),
        selectedAccount: state.selectedAccount?.id === id ? account : state.selectedAccount,
        loading: { ...state.loading, submit: false }
      }))
      return account
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update account'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  deleteAccount: async (id) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      await accountingPurposeAccountsApi.delete(id)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      const { listParams } = get()
      await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete account'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  bulkCreate: async (data) => {
    set(state => ({ loading: { ...state.loading, bulk: true }, error: null }))
    try {
      const accounts = await accountingPurposeAccountsApi.bulkCreate(data)
      set(state => ({ loading: { ...state.loading, bulk: false } }))
      
      const { listParams } = get()
      await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      
      return accounts
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create accounts'
      set(state => ({ 
        loading: { ...state.loading, bulk: false },
        error: { scope: 'bulk', message }
      }))
      throw error
    }
  },

  bulkRemove: async (data) => {
    set(state => ({ loading: { ...state.loading, bulk: true }, error: null }))
    try {
      await accountingPurposeAccountsApi.bulkRemove(data)
      set(state => ({ loading: { ...state.loading, bulk: false } }))
      
      const { listParams } = get()
      await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove accounts'
      set(state => ({ 
        loading: { ...state.loading, bulk: false },
        error: { scope: 'bulk', message }
      }))
      throw error
    }
  },

  bulkUpdateStatus: async (ids, is_active) => {
    set(state => ({ loading: { ...state.loading, bulk: true }, error: null }))
    try {
      await accountingPurposeAccountsApi.bulkUpdateStatus(ids, is_active)
      set(state => ({ loading: { ...state.loading, bulk: false } }))
      
      const { listParams } = get()
      await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      set(state => ({ 
        loading: { ...state.loading, bulk: false },
        error: { scope: 'bulk', message }
      }))
      throw error
    }
  },

  exportAccounts: async (filter) => {
    set(state => ({ loading: { ...state.loading, export: true }, error: null }))
    try {
      const token = await accountingPurposeAccountsApi.exportToken()
      const blob = await accountingPurposeAccountsApi.export(token, filter)
      set(state => ({ loading: { ...state.loading, export: false } }))
      return blob
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export'
      set(state => ({ 
        loading: { ...state.loading, export: false },
        error: { scope: 'export', message }
      }))
      throw error
    }
  },

  fetchPostableAccounts: async () => {
    try {
      const accounts = await accountingPurposeAccountsApi.getPostableAccounts()
      set({ postableAccounts: accounts })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch postable accounts'
      set({ error: { scope: 'list', message } })
    }
  },

  fetchActivePurposes: async () => {
    try {
      const purposes = await accountingPurposeAccountsApi.getActivePurposes()
      set({ activePurposes: purposes })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch active purposes'
      set({ error: { scope: 'list', message } })
    }
  },

  refreshCurrentState: async () => {
    const { listParams } = get()
    await get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
  },

  setError: (scope, message) => set({ error: { scope, message } }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState)
}))