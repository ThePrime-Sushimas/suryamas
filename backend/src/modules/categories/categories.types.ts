// =====================================================
// CATEGORY & SUBCATEGORY TYPES
// =====================================================

export interface Category {
  id: string
  category_code: string
  category_name: string
  description: string | null
  sort_order: number
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SubCategory {
  id: string
  category_id: string
  sub_category_code: string
  sub_category_name: string
  description: string | null
  sort_order: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SubCategoryWithCategory extends SubCategory {
  category?: {
    id: string
    category_code: string
    category_name: string
  }
}

// DTOs
export interface CreateCategoryDto {
  category_code: string
  category_name: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface UpdateCategoryDto {
  category_name?: string
  description?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface CreateSubCategoryDto {
  category_id: string
  sub_category_code: string
  sub_category_name: string
  description?: string
  sort_order?: number
}

export interface UpdateSubCategoryDto {
  sub_category_name?: string
  description?: string
  sort_order?: number
}

// Bulk Operations
export interface BulkDeleteDto {
  ids: string[]
}

// API Responses
export interface CategoryResponse {
  success: boolean
  data: Category
  message?: string
}

export interface CategoriesListResponse {
  success: boolean
  data: Category[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  message?: string
}

export interface SubCategoryResponse {
  success: boolean
  data: SubCategoryWithCategory
  message?: string
}

export interface SubCategoriesListResponse {
  success: boolean
  data: SubCategory[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  message?: string
}

export interface SubCategoriesByCategory {
  success: boolean
  data: SubCategory[]
  message?: string
}

export interface ErrorResponse {
  success: false
  error: string
}
