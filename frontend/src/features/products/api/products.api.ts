import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Product, CreateProductDto, UpdateProductDto, Pagination } from '../types'

const KEYS = {
  products: (params: Record<string, unknown>) => ['products', params] as const,
  product: (id: string) => ['products', id] as const,
}

export const useProducts = (params: { page?: number; limit?: number; search?: string; status?: string; product_type?: string; includeDeleted?: boolean }) =>
  useQuery({
    queryKey: KEYS.products(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 20 }
      if (params.search) queryParams.q = params.search
      if (params.status) queryParams.status = params.status
      if (params.product_type) queryParams.product_type = params.product_type
      if (params.includeDeleted) queryParams.includeDeleted = true

      const endpoint = params.search ? '/products/search' : '/products'
      const { data } = await api.get(endpoint, { params: queryParams })
      return { data: data.data as Product[], pagination: data.pagination as Pagination }
    },
    staleTime: 60_000,
  })

export const useProduct = (id: string) =>
  useQuery({
    queryKey: KEYS.product(id),
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`)
      return data.data as Product
    },
    enabled: !!id,
  })

export const useCreateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateProductDto) => {
      const { data } = await api.post('/products', body)
      return data.data as Product
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useUpdateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateProductDto & { id: string }) => {
      const { data } = await api.put(`/products/${id}`, body)
      return data.data as Product
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: KEYS.product(vars.id) })
    },
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/products/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useRestoreProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/products/${id}/restore`, {})
      return data.data as Product
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useBulkDeleteProducts = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.post('/products/bulk/delete', { ids }) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useBulkRestoreProducts = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.post('/products/bulk/restore', { ids }) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}
