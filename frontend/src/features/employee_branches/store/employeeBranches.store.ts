import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import type {
  EmployeeBranch,
  EmployeeBranchListQuery,
  CreateEmployeeBranchDTO,
  UpdateEmployeeBranchDTO,
  DomainError,
} from '../api/types'

type State = {
  items: EmployeeBranch[]
  total: number
  page: number
  limit: number
  selected: EmployeeBranch | null
  loading: {
    list: boolean
    detail: boolean
    create: boolean
    update: boolean
    remove: boolean
    setPrimary: boolean
  }
  error: {
    list: DomainError | null
    detail: DomainError | null
    create: DomainError | null
    update: DomainError | null
    remove: DomainError | null
  }
}

type Actions = {
  list: (query: EmployeeBranchListQuery) => Promise<void>
  getById: (id: string) => Promise<void>
  create: (payload: CreateEmployeeBranchDTO) => Promise<EmployeeBranch | null>
  update: (id: string, payload: UpdateEmployeeBranchDTO) => Promise<EmployeeBranch | null>
  remove: (id: string) => Promise<boolean>
  setPrimary: (employeeId: string, branchId: string) => Promise<boolean>
  reset: () => void
}

export const useEmployeeBranchesStore = create<State & Actions>()(
  devtools((set, get) => ({
    items: [],
    total: 0,
    page: 1,
    limit: 200,
    selected: null,
    loading: { list: false, detail: false, create: false, update: false, remove: false, setPrimary: false },
    error: { list: null, detail: null, create: null, update: null, remove: null },

    async list(query) {
      set(s => ({ loading: { ...s.loading, list: true }, error: { ...s.error, list: null } }))
      try {
        const res = await employeeBranchesApi.list(query)
        set(s => ({
          items: res.data,
          total: res.pagination.total,
          page: res.pagination.page,
          limit: res.pagination.limit,
          loading: { ...s.loading, list: false },
        }))
      } catch {
        set(s => ({ loading: { ...s.loading, list: false }, error: { ...s.error, list: err as DomainError } }))
      }
    },

    async getById(id) {
      set(s => ({ loading: { ...s.loading, detail: true }, error: { ...s.error, detail: null } }))
      try {
        const data = await employeeBranchesApi.getById(id)
        set(s => ({ selected: data, loading: { ...s.loading, detail: false } }))
      } catch {
        set(s => ({ loading: { ...s.loading, detail: false }, error: { ...s.error, detail: err as DomainError } }))
      }
    },

    async create(payload) {
      set(s => ({ loading: { ...s.loading, create: true }, error: { ...s.error, create: null } }))
      
      // Optimistic update
      const tempId = `temp-${Date.now()}`
      const optimisticItem = { ...payload, id: tempId, created_at: new Date().toISOString() } as any
      set(s => ({ items: [optimisticItem, ...s.items], total: s.total + 1 }))
      
      try {
        const created = await employeeBranchesApi.create(payload)
        set(s => ({
          items: s.items.map(i => i.id === tempId ? created : i),
          loading: { ...s.loading, create: false },
        }))
        return created
      } catch {
        // Rollback on error
        set(s => ({
          items: s.items.filter(i => i.id !== tempId),
          total: Math.max(0, s.total - 1),
          loading: { ...s.loading, create: false },
          error: { ...s.error, create: err as DomainError },
        }))
        return null
      }
    },

    async update(id, payload) {
      set(s => ({ loading: { ...s.loading, update: true }, error: { ...s.error, update: null } }))
      
      // Optimistic update
      const snapshot = get().items
      const optimisticItems = snapshot.map(i => i.id === id ? { ...i, ...payload } : i)
      set({ items: optimisticItems })
      
      try {
        const updated = await employeeBranchesApi.update(id, payload)
        set(s => ({
          items: s.items.map(i => (i.id === id ? updated : i)),
          loading: { ...s.loading, update: false },
        }))
        return updated
      } catch {
        // Rollback on error
        set(s => ({
          items: snapshot,
          loading: { ...s.loading, update: false },
          error: { ...s.error, update: err as DomainError },
        }))
        return null
      }
    },

    async remove(id) {
      set(s => ({ loading: { ...s.loading, remove: true }, error: { ...s.error, remove: null } }))
      const snapshot = get().items
      set({ items: snapshot.filter(i => i.id !== id), total: Math.max(0, get().total - 1) })
      try {
        await employeeBranchesApi.remove(id)
        set(s => ({ loading: { ...s.loading, remove: false } }))
        return true
      } catch {
        set(s => ({ items: snapshot, total: snapshot.length, loading: { ...s.loading, remove: false }, error: { ...s.error, remove: err as DomainError } }))
        return false
      }
    },

    async setPrimary(employeeId, branchId) {
      set(s => ({ loading: { ...s.loading, setPrimary: true } }))
      const snapshot = get().items
      
      // Optimistic update: unset all primary for this employee, then set new one
      const optimisticItems = snapshot.map(item => ({
        ...item,
        is_primary: item.employee_id === employeeId && item.branch_id === branchId
      }))
      set({ items: optimisticItems })
      
      try {
        await employeeBranchesApi.setPrimary(employeeId, branchId)
        await get().list({ page: get().page, limit: get().limit })
        return true
      } catch {
        set({ items: snapshot })
        return false
      } finally {
        set(s => ({ loading: { ...s.loading, setPrimary: false } }))
      }
    },

    reset() {
      set({ selected: null, error: { list: null, detail: null, create: null, update: null, remove: null } })
    },
  }))
)
