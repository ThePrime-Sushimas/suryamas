import { create } from 'zustand'
import { categoriesApi, subCategoriesApi } from '../api/categories.api'
import { parseApiError } from '@/lib/errorParser'
import type { Category, SubCategory, CreateCategoryDto, UpdateCategoryDto, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

interface CategoriesState {
  categories: Category[]
  subCategories: SubCategory[]
  loading: boolean
  mutationLoading: boolean
  error: string | null

  // Categories Pagination
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean

  // SubCategories Pagination
  subPage: number
  subLimit: number
  subTotal: number
  subTotalPages: number
  subHasNext: boolean
  subHasPrev: boolean

  // Combined actions
  fetchPage: (page: number, limit?: number, isActive?: string, isDeleted?: string) => Promise<void>
  searchPage: (q: string, page: number, limit?: number) => Promise<void>
  fetchSubPage: (page: number, limit?: number, categoryId?: string, isDeleted?: string) => Promise<void>
  searchSubPage: (q: string, page: number, limit?: number) => Promise<void>

  // Mutations
  createCategory: (data: CreateCategoryDto) => Promise<Category>
  updateCategory: (id: string, data: UpdateCategoryDto) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
  bulkDeleteCategories: (ids: string[]) => Promise<void>
  updateCategoryStatus: (id: string, isActive: boolean) => Promise<void>
  restoreCategory: (id: string) => Promise<void>

  createSubCategory: (data: CreateSubCategoryDto) => Promise<SubCategory>
  updateSubCategory: (id: string, data: UpdateSubCategoryDto) => Promise<SubCategory>
  deleteSubCategory: (id: string) => Promise<void>
  bulkDeleteSubCategories: (ids: string[]) => Promise<void>
  restoreSubCategory: (id: string) => Promise<void>

  // Utility to fetch all categories (for dropdowns)
  fetchAllCategories: () => Promise<void>

  clearError: () => void
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  subCategories: [],
  loading: false,
  mutationLoading: false,
  error: null,

  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,

  subPage: 1,
  subLimit: 10,
  subTotal: 0,
  subTotalPages: 0,
  subHasNext: false,
  subHasPrev: false,

  fetchPage: async (page, limit?, isActive?, isDeleted?) => {
    const l = limit ?? get().limit
    set({ loading: true, error: null, page, limit: l })
    try {
      const res = isDeleted === 'true'
        ? await categoriesApi.trash(page, l)
        : await categoriesApi.list(page, l, isActive)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        categories: res.data,
        loading: false,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat kategori'), loading: false })
    }
  },

  searchPage: async (q, page, limit?) => {
    const l = limit ?? get().limit
    set({ loading: true, error: null, page, limit: l })
    try {
      const res = await categoriesApi.search(q, page, l)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        categories: res.data,
        loading: false,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mencari kategori'), loading: false })
    }
  },

  fetchSubPage: async (page, limit?, categoryId?, isDeleted?) => {
    const l = limit ?? get().subLimit
    set({ loading: true, error: null, subPage: page, subLimit: l })
    try {
      const res = isDeleted === 'true'
        ? await subCategoriesApi.trash(page, l)
        : await subCategoriesApi.list(page, l, categoryId)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        subCategories: res.data,
        loading: false,
        subTotal: total,
        subTotalPages: totalPages,
        subHasNext: page < totalPages,
        subHasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal memuat sub-kategori'), loading: false })
    }
  },

  searchSubPage: async (q, page, limit?) => {
    const l = limit ?? get().subLimit
    set({ loading: true, error: null, subPage: page, subLimit: l })
    try {
      const res = await subCategoriesApi.search(q, page, l)
      const total = res.pagination?.total || 0
      const totalPages = Math.ceil(total / l)
      set({
        subCategories: res.data,
        loading: false,
        subTotal: total,
        subTotalPages: totalPages,
        subHasNext: page < totalPages,
        subHasPrev: page > 1,
      })
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mencari sub-kategori'), loading: false })
    }
  },

  createCategory: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const category = await categoriesApi.create(data)
      set({ mutationLoading: false })
      return category
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat kategori'), mutationLoading: false })
      throw error
    }
  },

  updateCategory: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const category = await categoriesApi.update(id, data)
      set(state => ({
        categories: state.categories.map(c => c.id === id ? category : c),
        mutationLoading: false,
      }))
      return category
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mengupdate kategori'), mutationLoading: false })
      throw error
    }
  },

  deleteCategory: async (id) => {
    const prev = get().categories
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }))
    try {
      await categoriesApi.delete(id)
    } catch (error: unknown) {
      set({ categories: prev, error: parseApiError(error, 'Gagal menghapus kategori') })
      throw error
    }
  },

  bulkDeleteCategories: async (ids) => {
    const prev = get().categories
    set(state => ({ categories: state.categories.filter(c => !ids.includes(c.id)) }))
    try {
      await categoriesApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ categories: prev, error: parseApiError(error, 'Gagal menghapus kategori') })
      throw error
    }
  },

  updateCategoryStatus: async (id, isActive) => {
    const prev = get().categories
    set(state => ({
      categories: state.categories.map(c => c.id === id ? { ...c, is_active: isActive } : c),
    }))
    try {
      await categoriesApi.updateStatus(id, isActive)
    } catch (error: unknown) {
      set({ categories: prev, error: parseApiError(error, 'Gagal mengupdate status') })
      throw error
    }
  },

  restoreCategory: async (id) => {
    const prev = get().categories
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }))
    try {
      await categoriesApi.restore(id)
    } catch (error: unknown) {
      set({ categories: prev, error: parseApiError(error, 'Gagal merestore kategori') })
      throw error
    }
  },

  createSubCategory: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const subCategory = await subCategoriesApi.create(data)
      set({ mutationLoading: false })
      return subCategory
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal membuat sub-kategori'), mutationLoading: false })
      throw error
    }
  },

  updateSubCategory: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const subCategory = await subCategoriesApi.update(id, data)
      set(state => ({
        subCategories: state.subCategories.map(sc => sc.id === id ? subCategory : sc),
        mutationLoading: false,
      }))
      return subCategory
    } catch (error: unknown) {
      set({ error: parseApiError(error, 'Gagal mengupdate sub-kategori'), mutationLoading: false })
      throw error
    }
  },

  deleteSubCategory: async (id) => {
    const prev = get().subCategories
    set(state => ({ subCategories: state.subCategories.filter(sc => sc.id !== id) }))
    try {
      await subCategoriesApi.delete(id)
    } catch (error: unknown) {
      set({ subCategories: prev, error: parseApiError(error, 'Gagal menghapus sub-kategori') })
      throw error
    }
  },

  bulkDeleteSubCategories: async (ids) => {
    const prev = get().subCategories
    set(state => ({ subCategories: state.subCategories.filter(sc => !ids.includes(sc.id)) }))
    try {
      await subCategoriesApi.bulkDelete(ids)
    } catch (error: unknown) {
      set({ subCategories: prev, error: parseApiError(error, 'Gagal menghapus sub-kategori') })
      throw error
    }
  },

  restoreSubCategory: async (id) => {
    const prev = get().subCategories
    set(state => ({ subCategories: state.subCategories.filter(sc => sc.id !== id) }))
    try {
      await subCategoriesApi.restore(id)
    } catch (error: unknown) {
      set({ subCategories: prev, error: parseApiError(error, 'Gagal merestore sub-kategori') })
      throw error
    }
  },

  fetchAllCategories: async () => {
    try {
      const res = await categoriesApi.list(1, 1000, 'true')
      set({ categories: res.data })
    } catch {
      // silent — used for dropdowns
    }
  },

  clearError: () => set({ error: null }),
}))
