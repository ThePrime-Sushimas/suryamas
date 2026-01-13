import { create } from 'zustand'
import { chartOfAccountsApi } from '../api/chartOfAccounts.api'
import type { ChartOfAccount, ChartOfAccountTreeNode, CreateChartOfAccountDto, UpdateChartOfAccountDto, ChartOfAccountFilter } from '../types/chart-of-account.types'

interface LoadingState {
  list: boolean
  tree: boolean
  detail: boolean
  submit: boolean
}

interface ErrorState {
  scope: 'list' | 'tree' | 'detail' | 'submit'
  message: string
}

interface ListParams {
  page: number
  limit: number
  sort?: { field: string; order: string }
  filter?: ChartOfAccountFilter
  search?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ChartOfAccountsState {
  accounts: ChartOfAccount[]
  tree: ChartOfAccountTreeNode[]
  selectedAccount: ChartOfAccount | null
  loading: LoadingState
  error: ErrorState | null
  pagination: Pagination
  listParams: ListParams
  viewMode: 'table' | 'tree'
  
  fetchAccounts: (page: number, limit: number, sort?: { field: string; order: string }, filter?: ChartOfAccountFilter) => Promise<void>
  searchAccounts: (q: string, page: number, limit: number, filter?: ChartOfAccountFilter) => Promise<void>
  fetchTree: (maxDepth?: number, filter?: ChartOfAccountFilter) => Promise<void>
  getAccountById: (id: string) => Promise<ChartOfAccount>
  createAccount: (data: CreateChartOfAccountDto) => Promise<ChartOfAccount>
  updateAccount: (id: string, data: UpdateChartOfAccountDto) => Promise<ChartOfAccount>
  deleteAccount: (id: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  bulkUpdateStatus: (ids: string[], is_active: boolean) => Promise<void>
  restoreAccount: (id: string) => Promise<void>
  bulkRestore: (ids: string[]) => Promise<void>
  refreshCurrentState: () => Promise<void>
  setViewMode: (mode: 'table' | 'tree') => void
  setError: (scope: ErrorState['scope'], message: string) => void
  clearError: () => void
  resetList: () => void
  resetTree: () => void
  resetDetail: () => void
}

const initialState = {
  accounts: [],
  tree: [],
  selectedAccount: null,
  loading: { list: false, tree: false, detail: false, submit: false },
  error: null,
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
  listParams: { page: 1, limit: 25 },
  viewMode: 'tree' as const
}

// Helper function to calculate total pages
const calculateTotalPages = (total: number, limit: number) => Math.ceil(total / limit)

export const useChartOfAccountsStore = create<ChartOfAccountsState>((set, get) => ({
  ...initialState,

  fetchAccounts: async (page, limit, sort, filter) => {
    set(state => ({ 
      loading: { ...state.loading, list: true }, 
      error: null,
      listParams: { page, limit, sort, filter }
    }))
    try {
      const res = await chartOfAccountsApi.list(page, limit, sort, filter)
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

  searchAccounts: async (q, page, limit, filter) => {
    set(state => ({ 
      loading: { ...state.loading, list: true }, 
      error: null,
      listParams: { page, limit, filter, search: q }
    }))
    try {
      const res = await chartOfAccountsApi.search(q, page, limit, filter)
      set(state => ({ 
        accounts: res.data, 
        loading: { ...state.loading, list: false },
        pagination: {
          ...res.pagination,
          totalPages: calculateTotalPages(res.pagination.total, res.pagination.limit)
        }
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to search accounts'
      set(state => ({ 
        loading: { ...state.loading, list: false },
        error: { scope: 'list', message }
      }))
    }
  },

  fetchTree: async (maxDepth, filter) => {
    set(state => ({ loading: { ...state.loading, tree: true }, error: null }))
    try {
      const tree = await chartOfAccountsApi.getTree(maxDepth, filter)
      set(state => ({ tree, loading: { ...state.loading, tree: false } }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tree'
      set(state => ({ 
        loading: { ...state.loading, tree: false },
        error: { scope: 'tree', message }
      }))
    }
  },

  getAccountById: async (id) => {
    set(state => ({ loading: { ...state.loading, detail: true }, error: null }))
    try {
      const account = await chartOfAccountsApi.getById(id)
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
      const account = await chartOfAccountsApi.create(data)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh both list and tree after create
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
      
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
      const account = await chartOfAccountsApi.update(id, data)
      set(state => ({
        accounts: state.accounts.map(a => a.id === id ? account : a),
        selectedAccount: state.selectedAccount?.id === id ? account : state.selectedAccount,
        loading: { ...state.loading, submit: false }
      }))
      
      // Refresh tree after update
      get().fetchTree(undefined, get().listParams.filter)
      
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
      await chartOfAccountsApi.delete(id)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh both list and tree after delete
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete account'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  bulkDelete: async (ids) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      await chartOfAccountsApi.bulkDelete(ids)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh both list and tree after bulk delete
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete accounts'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  bulkUpdateStatus: async (ids, is_active) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      await chartOfAccountsApi.bulkUpdateStatus(ids, is_active)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh both list and tree after bulk status update
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update account status'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  restoreAccount: async (id) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      await chartOfAccountsApi.restore(id)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh data after restore
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore account'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  bulkRestore: async (ids) => {
    set(state => ({ loading: { ...state.loading, submit: true }, error: null }))
    try {
      await chartOfAccountsApi.bulkRestore(ids)
      set(state => ({ loading: { ...state.loading, submit: false } }))
      
      // Refresh data after bulk restore
      const { listParams } = get()
      if (listParams.search) {
        get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter)
      } else {
        get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter)
      }
      get().fetchTree(undefined, listParams.filter)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to restore accounts'
      set(state => ({ 
        loading: { ...state.loading, submit: false },
        error: { scope: 'submit', message }
      }))
      throw error
    }
  },

  refreshCurrentState: async () => {
    const { listParams } = get()
    const promises = []
    
    if (listParams.search) {
      promises.push(get().searchAccounts(listParams.search, listParams.page, listParams.limit, listParams.filter))
    } else {
      promises.push(get().fetchAccounts(listParams.page, listParams.limit, listParams.sort, listParams.filter))
    }
    
    promises.push(get().fetchTree(undefined, listParams.filter))
    
    await Promise.all(promises)
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setError: (scope, message) => set({ error: { scope, message } }),

  clearError: () => set({ error: null }),

  resetList: () => set(state => ({
    accounts: [],
    pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    listParams: { page: 1, limit: 25 },
    loading: { ...state.loading, list: false },
    error: state.error?.scope === 'list' ? null : state.error
  })),

  resetTree: () => set(state => ({
    tree: [],
    loading: { ...state.loading, tree: false },
    error: state.error?.scope === 'tree' ? null : state.error
  })),

  resetDetail: () => set(state => ({
    selectedAccount: null,
    loading: { ...state.loading, detail: false },
    error: state.error?.scope === 'detail' ? null : state.error
  }))
}))