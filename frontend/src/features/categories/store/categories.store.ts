import { create } from 'zustand'
import { categoriesApi, subCategoriesApi } from '../api/categories.api'
import type { Category, SubCategory, CreateCategoryDto, UpdateCategoryDto, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

interface CategoriesState {
  categories: Category[]
  subCategories: SubCategory[]
  loading: boolean
  error: string | null
  
  fetchCategories: (page?: number, limit?: number, isActive?: string, isDeleted?: string) => Promise<void>
  searchCategories: (q: string, page?: number, limit?: number) => Promise<void>
  createCategory: (data: CreateCategoryDto) => Promise<Category>
  updateCategory: (id: string, data: UpdateCategoryDto) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
  bulkDeleteCategories: (ids: string[]) => Promise<void>
  updateCategoryStatus: (id: string, isActive: boolean) => Promise<void>
  restoreCategory: (id: string) => Promise<void>
  
  fetchSubCategories: (page?: number, limit?: number, categoryId?: string) => Promise<void>
  searchSubCategories: (q: string, page?: number, limit?: number) => Promise<void>
  createSubCategory: (data: CreateSubCategoryDto) => Promise<SubCategory>
  updateSubCategory: (id: string, data: UpdateSubCategoryDto) => Promise<SubCategory>
  deleteSubCategory: (id: string) => Promise<void>
  
  clearError: () => void
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  subCategories: [],
  loading: false,
  error: null,

  fetchCategories: async (page = 1, limit = 10, isActive?: string, isDeleted?: string) => {
    set({ loading: true, error: null })
    try {
      let res
      if (isDeleted === 'true') {
        res = await categoriesApi.trash(page, limit)
      } else {
        res = await categoriesApi.list(page, limit, isActive)
      }
      set({ categories: res.data, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to fetch categories'
      set({ error: message || 'Failed to fetch categories', loading: false })
    }
  },

  searchCategories: async (q, page = 1, limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await categoriesApi.search(q, page, limit)
      set({ categories: res.data, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to search categories'
      set({ error: message || 'Failed to search categories', loading: false })
    }
  },

  createCategory: async (data) => {
    set({ loading: true, error: null })
    try {
      const category = await categoriesApi.create(data)
      set({ loading: false })
      return category
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to create category'
      set({ error: message || 'Failed to create category', loading: false })
      throw error
    }
  },

  updateCategory: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const category = await categoriesApi.update(id, data)
      set(state => ({
        categories: state.categories.map(c => c.id === id ? category : c),
        loading: false
      }))
      return category
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to update category'
      set({ error: message || 'Failed to update category', loading: false })
      throw error
    }
  },

  deleteCategory: async (id) => {
    const prev = get().categories
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }))
    try {
      await categoriesApi.delete(id)
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to delete category'
      set({ categories: prev, error: message || 'Failed to delete category' })
      throw error
    }
  },

  bulkDeleteCategories: async (ids) => {
    const prev = get().categories
    set(state => ({ categories: state.categories.filter(c => !ids.includes(c.id)) }))
    try {
      await categoriesApi.bulkDelete(ids)
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to bulk delete categories'
      set({ categories: prev, error: message || 'Failed to bulk delete categories' })
      throw error
    }
  },

  updateCategoryStatus: async (id, isActive) => {
    const prev = get().categories
    set(state => ({
      categories: state.categories.map(c => c.id === id ? { ...c, is_active: isActive } : c)
    }))
    try {
      await categoriesApi.updateStatus(id, isActive)
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to update status'
      set({ categories: prev, error: message || 'Failed to update status' })
      throw error
    }
  },

  restoreCategory: async (id) => {
    const prev = get().categories
    set(state => ({
      categories: state.categories.filter(c => c.id !== id)
    }))
    try {
      await categoriesApi.restore(id)
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to restore category'
      set({ categories: prev, error: message || 'Failed to restore category' })
      throw error
    }
  },

  fetchSubCategories: async (page = 1, limit = 10, categoryId) => {
    set({ loading: true, error: null })
    try {
      const res = await subCategoriesApi.list(page, limit, categoryId)
      set({ subCategories: res.data, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to fetch sub-categories'
      set({ error: message || 'Failed to fetch sub-categories', loading: false })
    }
  },

  searchSubCategories: async (q, page = 1, limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await subCategoriesApi.search(q, page, limit)
      set({ subCategories: res.data, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to search sub-categories'
      set({ error: message || 'Failed to search sub-categories', loading: false })
    }
  },

  createSubCategory: async (data) => {
    set({ loading: true, error: null })
    try {
      const subCategory = await subCategoriesApi.create(data)
      set({ loading: false })
      return subCategory
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to create sub-category'
      set({ error: message || 'Failed to create sub-category', loading: false })
      throw error
    }
  },

  updateSubCategory: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const subCategory = await subCategoriesApi.update(id, data)
      set(state => ({
        subCategories: state.subCategories.map(sc => sc.id === id ? subCategory : sc),
        loading: false
      }))
      return subCategory
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to update sub-category'
      set({ error: message || 'Failed to update sub-category', loading: false })
      throw error
    }
  },

  deleteSubCategory: async (id) => {
    const prev = get().subCategories
    set(state => ({ subCategories: state.subCategories.filter(sc => sc.id !== id) }))
    try {
      await subCategoriesApi.delete(id)
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to delete sub-category'
      set({ subCategories: prev, error: message || 'Failed to delete sub-category' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
