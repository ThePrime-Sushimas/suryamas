import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }

const KEYS = {
  uoms: (productId: string, includeDeleted: boolean) => ['product-uoms', productId, includeDeleted] as const,
}

const sortUoms = (uoms: ProductUom[]) =>
  [...uoms].sort((a, b) => {
    if (a.is_base_unit) return -1
    if (b.is_base_unit) return 1
    return a.conversion_factor - b.conversion_factor
  })

export const useProductUoms = (productId: string, includeDeleted = false) =>
  useQuery({
    queryKey: KEYS.uoms(productId, includeDeleted),
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProductUom[]>>(`/products/${productId}/uoms`, { params: { includeDeleted } })
      return sortUoms(res.data.data)
    },
    enabled: !!productId,
    staleTime: 60_000,
  })

export const useCreateProductUom = (productId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateProductUomDto) => {
      const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms`, data)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-uoms', productId] }),
  })
}

export const useUpdateProductUom = (productId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ uomId, ...data }: UpdateProductUomDto & { uomId: string }) => {
      const res = await api.put<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}`, data)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-uoms', productId] }),
  })
}

export const useDeleteProductUom = (productId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uomId: string) => { await api.delete(`/products/${productId}/uoms/${uomId}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-uoms', productId] }),
  })
}

export const useRestoreProductUom = (productId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uomId: string) => {
      const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}/restore`)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-uoms', productId] }),
  })
}

// Keep legacy API for backward compat (used by ProductDetailPage in other features)
export const productUomsApi = {
  list: async (productId: string, includeDeleted = false) => {
    const res = await api.get<ApiResponse<ProductUom[]>>(`/products/${productId}/uoms`, { params: { includeDeleted } })
    return res.data.data
  },
  create: async (productId: string, data: CreateProductUomDto) => {
    const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms`, data)
    return res.data.data
  },
  update: async (productId: string, uomId: string, data: UpdateProductUomDto) => {
    const res = await api.put<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}`, data)
    return res.data.data
  },
  delete: async (productId: string, uomId: string) => {
    await api.delete(`/products/${productId}/uoms/${uomId}`)
  },
  restore: async (productId: string, uomId: string) => {
    const res = await api.post<ApiResponse<ProductUom>>(`/products/${productId}/uoms/${uomId}/restore`)
    return res.data.data
  }
}
