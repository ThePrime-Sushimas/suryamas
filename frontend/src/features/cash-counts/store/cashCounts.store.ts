import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { CashCount, CashCountListFilter, CreateCashCountDto, UpdatePhysicalCountDto, DepositDto } from '../types'
import { cashCountsApi } from '../api/cashCounts.api'

interface CashCountsState {
  items: CashCount[]
  selected: CashCount | null
  page: number
  limit: number
  total: number
  totalPages: number
  filter: CashCountListFilter
  isLoading: boolean
  isMutating: boolean
  error: string | null

  fetchList: () => Promise<void>
  fetchById: (id: string) => Promise<CashCount>
  create: (dto: CreateCashCountDto) => Promise<CashCount>
  updatePhysicalCount: (id: string, dto: UpdatePhysicalCountDto) => Promise<CashCount>
  deposit: (id: string, dto: DepositDto) => Promise<CashCount>
  close: (id: string) => Promise<CashCount>
  remove: (id: string) => Promise<void>
  setFilter: (f: Partial<CashCountListFilter>) => void
  clearFilter: () => void
  setPage: (p: number) => void
  setLimit: (l: number) => void
  clearError: () => void
}

const initialFilter: CashCountListFilter = {
  sort_by: 'created_at',
  sort_order: 'desc',
}

export const useCashCountsStore = create<CashCountsState>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        selected: null,
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        filter: initialFilter,
        isLoading: false,
        isMutating: false,
        error: null,

        fetchList: async () => {
          set({ isLoading: true, error: null })
          try {
            const { page, limit, filter } = get()
            const res = await cashCountsApi.list({ ...filter, page, limit })
            set({
              items: res.data,
              page: res.pagination.page,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
              isLoading: false,
            })
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal memuat data', isLoading: false })
          }
        },

        fetchById: async (id) => {
          set({ isLoading: true, error: null })
          try {
            const data = await cashCountsApi.getById(id)
            set({ selected: data, isLoading: false })
            return data
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal memuat detail', isLoading: false })
            throw e
          }
        },

        create: async (dto) => {
          set({ isMutating: true, error: null })
          try {
            const data = await cashCountsApi.create(dto)
            set({ isMutating: false })
            await get().fetchList()
            return data
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal membuat cash count', isMutating: false })
            throw e
          }
        },

        updatePhysicalCount: async (id, dto) => {
          set({ isMutating: true, error: null })
          try {
            const data = await cashCountsApi.updatePhysicalCount(id, dto)
            set((s) => ({
              items: s.items.map((i) => (i.id === id ? data : i)),
              selected: s.selected?.id === id ? data : s.selected,
              isMutating: false,
            }))
            return data
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal update physical count', isMutating: false })
            throw e
          }
        },

        deposit: async (id, dto) => {
          set({ isMutating: true, error: null })
          try {
            const data = await cashCountsApi.deposit(id, dto)
            set((s) => ({
              items: s.items.map((i) => (i.id === id ? data : i)),
              selected: s.selected?.id === id ? data : s.selected,
              isMutating: false,
            }))
            return data
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal catat deposit', isMutating: false })
            throw e
          }
        },

        close: async (id) => {
          set({ isMutating: true, error: null })
          try {
            const data = await cashCountsApi.close(id)
            set((s) => ({
              items: s.items.map((i) => (i.id === id ? data : i)),
              selected: s.selected?.id === id ? data : s.selected,
              isMutating: false,
            }))
            return data
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal close cash count', isMutating: false })
            throw e
          }
        },

        remove: async (id) => {
          set({ isMutating: true, error: null })
          try {
            await cashCountsApi.delete(id)
            set((s) => ({
              items: s.items.filter((i) => i.id !== id),
              total: s.total - 1,
              isMutating: false,
            }))
          } catch (e) {
            set({ error: e instanceof Error ? e.message : 'Gagal hapus cash count', isMutating: false })
            throw e
          }
        },

        setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f }, page: 1 })),
        clearFilter: () => set({ filter: initialFilter, page: 1 }),
        setPage: (p) => { set({ page: p }); get().fetchList() },
        setLimit: (l) => { set({ limit: l, page: 1 }); get().fetchList() },
        clearError: () => set({ error: null }),
      }),
      { name: 'cash-counts-storage', partialize: (s) => ({ filter: s.filter, limit: s.limit }) },
    ),
    { name: 'cash-counts-store' },
  ),
)
