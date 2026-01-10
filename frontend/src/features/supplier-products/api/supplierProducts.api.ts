// Supplier Products API - Axios API calls for supplier products module

import api from '@/lib/axios'
import type {
  SupplierProduct,
  SupplierProductWithRelations,
  CreateSupplierProductDto,
  UpdateSupplierProductDto,
  SupplierProductListQuery,
  SupplierProductOption,
  PaginationParams
} from '../types/supplier-product.types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationParams
  message?: string
}

const buildQueryParams = (query: SupplierProductListQuery): Record<string, string | number | boolean> => {
  const params: Record<string, string | number | boolean> = {
    page: query.page || 1,
    limit: query.limit || 10,
  }

  if (query.search) params.search = query.search
  if (query.supplier_id) params.supplier_id = query.supplier_id
  if (query.product_id) params.product_id = query.product_id
  if (query.is_preferred !== undefined) params.is_preferred = query.is_preferred
  if (query.is_active !== undefined) params.is_active = query.is_active
  if (query.include_deleted) params.include_deleted = true
  if (query.sort_by) params.sort_by = query.sort_by
  if (query.sort_order) params.sort_order = query.sort_order

  return params
}

export const supplierProductsApi = {
  /**
   * List supplier products with pagination and filtering
   * @param query - Query parameters for filtering and pagination
   * @param signal - AbortSignal for request cancellation
   * @param includeRelations - Whether to include supplier and product relations
   */
  list: async (query: SupplierProductListQuery = {}, signal?: AbortSignal, includeRelations = true) => {
    const params = {
      ...buildQueryParams(query),
      include_relations: includeRelations
    }
    const res = await api.get<PaginatedResponse<SupplierProductWithRelations>>('/supplier-products', {
      params,
      signal,
      timeout: 30000
    })
    return res.data
  },

  /**
   * Get supplier product by ID with optional relations
   * @param id - Supplier product ID
   * @param includeRelations - Whether to include supplier and product relations
   * @param includeDeleted - Whether to include soft-deleted records
   * @param signal - AbortSignal for request cancellation
   */
  getById: async (id: string, includeRelations = true, includeDeleted = false, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations>>(`/supplier-products/${id}`, {
      params: { 
        include_relations: includeRelations,
        include_deleted: includeDeleted
      },
      signal
    })
    return res.data.data
  },

  /**
   * Get all supplier products for a specific supplier
   */
  getBySupplier: async (supplierId: string, includeRelations = true, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(
      `/supplier-products/supplier/${supplierId}`,
      {
        params: { include_relations: includeRelations },
        signal
      }
    )
    return res.data.data
  },

  /**
   * Get all supplier products for a specific product
   */
  getByProduct: async (productId: string, includeRelations = true, signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(
      `/supplier-products/product/${productId}`,
      {
        params: { include_relations: includeRelations },
        signal
      }
    )
    return res.data.data
  },

  /**
   * Get active supplier products for dropdown/options
   */
  getActiveOptions: async (signal?: AbortSignal) => {
    const res = await api.get<ApiResponse<SupplierProductOption[]>>(
      '/supplier-products/options/active',
      { signal }
    )
    return res.data.data
  },

  /**
   * Create new supplier product
   */
  create: async (data: CreateSupplierProductDto) => {
    const res = await api.post<ApiResponse<SupplierProduct>>('/supplier-products', data)
    return res.data.data
  },

  /**
   * Update supplier product
   */
  update: async (id: string, data: UpdateSupplierProductDto) => {
    const res = await api.put<ApiResponse<SupplierProduct>>(`/supplier-products/${id}`, data)
    return res.data.data
  },

  /**
   * Delete supplier product (soft delete)
   */
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<void>>(`/supplier-products/${id}`)
    return res.data
  },

  /**
   * Bulk delete supplier products
   */
  bulkDelete: async (ids: string[]) => {
    const res = await api.post<ApiResponse<void>>('/supplier-products/bulk/delete', { ids })
    return res.data
  },

  /**
   * Restore deleted supplier product
   */
  restore: async (id: string) => {
    const res = await api.post<ApiResponse<SupplierProduct>>(`/supplier-products/${id}/restore`)
    return res.data.data
  },

  /**
   * Bulk restore supplier products
   */
  bulkRestore: async (ids: string[]) => {
    const res = await api.post<ApiResponse<void>>('/supplier-products/bulk/restore', { ids })
    return res.data
  },

  /**
   * Export supplier products to CSV
   */
  exportCSV: async (query: SupplierProductListQuery = {}) => {
    const params = buildQueryParams(query)
    const res = await api.get('/supplier-products/export', {
      params,
      responseType: 'blob'
    })
    return res.data
  }
}

