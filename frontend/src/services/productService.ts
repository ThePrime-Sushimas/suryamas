import axios from '../lib/axios'
import type { Product, ProductUom } from '../types/product'

const API_URL = '/products'

export const productService = {
  // Products
  list: (page = 1, limit = 10, sort?: any, filter?: any, includeDeleted = false) =>
    axios.get(`${API_URL}`, { params: { page, limit, ...sort, ...filter, includeDeleted } }),

  search: (q: string, page = 1, limit = 10, includeDeleted = false) =>
    axios.get(`${API_URL}/search`, { params: { q, page, limit, includeDeleted } }),

  getById: (id: string, includeDeleted = false) =>
    axios.get(`${API_URL}/${id}`, { params: { includeDeleted } }),

  create: (data: Partial<Product>) =>
    axios.post(`${API_URL}`, data),

  update: (id: string, data: Partial<Product>) =>
    axios.put(`${API_URL}/${id}`, data),

  delete: (id: string) =>
    axios.delete(`${API_URL}/${id}`),

  bulkDelete: (ids: string[]) =>
    axios.post(`${API_URL}/bulk/delete`, { ids }),

  restoreProduct: (id: string) =>
    axios.post(`${API_URL}/${id}/restore`),

  bulkUpdateStatus: (ids: string[], status: string) =>
    axios.post(`${API_URL}/bulk/update-status`, { ids, status }),

  getFilterOptions: () =>
    axios.get(`${API_URL}/filter-options`),

  minimalActive: () =>
    axios.get(`${API_URL}/minimal/active`),

  // Product UOMs
  getUoms: (productId: string, includeDeleted = false) =>
    axios.get(`${API_URL}/${productId}/uoms`, { params: { includeDeleted } }),

  createUom: (productId: string, data: Partial<ProductUom>) =>
    axios.post(`${API_URL}/${productId}/uoms`, data),

  updateUom: (productId: string, uomId: string, data: Partial<ProductUom>) =>
    axios.put(`${API_URL}/${productId}/uoms/${uomId}`, data),

  deleteUom: (productId: string, uomId: string) =>
    axios.delete(`${API_URL}/${productId}/uoms/${uomId}`),

  restoreUom: (productId: string, uomId: string) =>
    axios.post(`${API_URL}/${productId}/uoms/${uomId}/restore`),

  export: () =>
    axios.get(`${API_URL}/export`, { responseType: 'blob' }),

  importPreview: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_URL}/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  import: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${API_URL}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  checkProductName: (name: string, excludeId?: string) =>
    axios.get(`${API_URL}/check/name`, { params: { product_name: name, excludeId } }),
}
