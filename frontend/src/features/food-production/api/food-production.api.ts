import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  Menu, MenuCategory, MenuGroup, WipItem, WipItemWithIngredients,
  MenuRecipe, CogsPreviewResult, CogsCalculation, SyncResult, Pagination,
} from '../types/food-production.types'

const KEYS = {
  menus: (params: Record<string, unknown>) => ['food-production', 'menus', params] as const,
  menu: (id: string) => ['food-production', 'menu', id] as const,
  recipe: (menuId: string) => ['food-production', 'recipe', menuId] as const,
  categories: ['food-production', 'categories'] as const,
  groups: (params: Record<string, unknown>) => ['food-production', 'groups', params] as const,
  wipItems: (params: Record<string, unknown>) => ['food-production', 'wip-items', params] as const,
  wipItem: (id: string) => ['food-production', 'wip-item', id] as const,
  cogsHistory: (params: Record<string, unknown>) => ['food-production', 'cogs', 'history', params] as const,
  cogsDetail: (id: string) => ['food-production', 'cogs', id] as const,
  products: (q: string) => ['food-production', 'products', q] as const,
}

// ── Products (for recipe/WIP ingredient picker) ──

export interface ProductOption {
  id: string
  product_code: string
  product_name: string
  average_cost: number
  default_purchase_unit: string | null
}

export const useProductSearch = (q: string) =>
  useQuery({
    queryKey: KEYS.products(q),
    queryFn: async () => {
      const { data } = await api.get('/products/search', { params: { q, limit: 50 } })
      return (data.data || []) as ProductOption[]
    },
    enabled: q.length >= 1,
    staleTime: 30_000,
  })

export const useProductList = () =>
  useQuery({
    queryKey: ['food-production', 'products-all'],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { limit: 500, status: 'ACTIVE' } })
      return (data.data || []) as ProductOption[]
    },
    staleTime: 5 * 60_000,
  })

// ── COA Options (for category mapping) ──

export interface CoaOption {
  id: string
  account_code: string
  account_name: string
}

export const useCoaOptions = () =>
  useQuery({
    queryKey: ['food-production', 'coa-options'],
    queryFn: async () => {
      const { data } = await api.get('/chart-of-accounts', { params: { limit: 500, is_active: true } })
      return (data.data || []) as CoaOption[]
    },
    staleTime: 5 * 60_000,
  })

export interface ProductUomOption {
  id: string
  product_id: string
  conversion_factor: number
  is_base_unit: boolean
  base_price: number
  metric_units: { id: string; unit_name: string; metric_type: string } | null
}

// ── Menu Categories ──

export const useMenuCategories = () =>
  useQuery({
    queryKey: KEYS.categories,
    queryFn: async () => {
      const { data } = await api.get('/menu-categories', { params: { limit: 100 } })
      return data.data as MenuCategory[]
    },
    staleTime: 5 * 60_000,
  })

export const useCreateMenuCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { category_code: string; category_name: string; sales_coa_id?: string | null; cogs_coa_id?: string | null; sort_order?: number }) => {
      const { data } = await api.post('/menu-categories', body)
      return data.data as MenuCategory
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.categories }),
  })
}

export const useUpdateMenuCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; category_name?: string; sales_coa_id?: string | null; cogs_coa_id?: string | null; sort_order?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/menu-categories/${id}`, body)
      return data.data as MenuCategory
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.categories }),
  })
}

export const useDeleteMenuCategory = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/menu-categories/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.categories }),
  })
}

// ── Menu Groups ──

export const useMenuGroups = (params: { category_id?: string; is_active?: boolean } = {}) =>
  useQuery({
    queryKey: KEYS.groups(params),
    queryFn: async () => {
      const { data } = await api.get('/menu-groups', { params: { ...params, limit: 200 } })
      return data.data as MenuGroup[]
    },
    staleTime: 5 * 60_000,
  })

export const useCreateMenuGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { category_id: string; group_code: string; group_name: string; sort_order?: number }) => {
      const { data } = await api.post('/menu-groups', body)
      return data.data as MenuGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'groups'] }),
  })
}

export const useUpdateMenuGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; category_id?: string; group_name?: string; sort_order?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/menu-groups/${id}`, body)
      return data.data as MenuGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'groups'] }),
  })
}

export const useDeleteMenuGroup = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/menu-groups/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'groups'] }),
  })
}

// ── Menus ──

export const useMenus = (params: { page?: number; limit?: number; category_id?: string; group_id?: string; has_recipe?: boolean; sync_enabled?: boolean; is_active?: boolean; search?: string }) =>
  useQuery({
    queryKey: KEYS.menus(params),
    queryFn: async () => {
      const { data } = await api.get('/menus', { params })
      return { data: data.data as Menu[], pagination: data.pagination as Pagination }
    },
    staleTime: 60_000,
  })

export const useMenu = (id: string) =>
  useQuery({
    queryKey: KEYS.menu(id),
    queryFn: async () => {
      const { data } = await api.get(`/menus/${id}`)
      return data.data as Menu
    },
    enabled: !!id,
  })

export const useCreateMenu = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { menu_code: string; menu_name: string; category_id: string; group_id?: string | null; selling_price?: number }) => {
      const { data } = await api.post('/menus', body)
      return data.data as Menu
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'menus'] }),
  })
}

export const useUpdateMenu = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; category_id?: string; group_id?: string | null; menu_name?: string; selling_price?: number; is_active?: boolean; sync_enabled?: boolean }) => {
      const { data } = await api.put(`/menus/${id}`, body)
      return data.data as Menu
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['food-production', 'menus'] })
      qc.invalidateQueries({ queryKey: KEYS.menu(vars.id) })
    },
  })
}

export const useDeleteMenu = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/menus/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'menus'] }),
  })
}

export const useSyncMenus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data } = await api.post('/menus/sync', { force })
      return data.data as SyncResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'menus'] }),
  })
}

// ── Recipes ──

export const useRecipe = (menuId: string) =>
  useQuery({
    queryKey: KEYS.recipe(menuId),
    queryFn: async () => {
      const { data } = await api.get(`/recipes/${menuId}`)
      return data.data as MenuRecipe
    },
    enabled: !!menuId,
  })

export const useSaveRecipe = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ menuId, lines }: { menuId: string; lines: Array<{ product_id?: string | null; wip_id?: string | null; qty: number; uom?: string }> }) => {
      const { data } = await api.put(`/recipes/${menuId}`, { lines })
      return data.data as MenuRecipe
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: KEYS.recipe(result.menu_id) })
      qc.invalidateQueries({ queryKey: KEYS.menu(result.menu_id) })
      qc.invalidateQueries({ queryKey: ['food-production', 'menus'] })
    },
  })
}

// ── WIP Items ──

export const useWipItems = (
  params: { page?: number; limit?: number; is_active?: boolean; search?: string; filter_by_position?: boolean; company_id?: string; branch_id?: string; with_positions?: boolean; position_filter?: string } = {},
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: KEYS.wipItems(params),
    queryFn: async () => {
      if (params.search) {
        const { data } = await api.get('/wip-items/search', { params: { q: params.search, page: params.page, limit: params.limit } })
        return { data: data.data as WipItem[], pagination: data.pagination as Pagination }
      }
      const { data } = await api.get('/wip-items', { params })
      return { data: data.data as WipItem[], pagination: data.pagination as Pagination }
    },
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  })

export const useWipItem = (id: string) =>
  useQuery({
    queryKey: KEYS.wipItem(id),
    queryFn: async () => {
      const { data } = await api.get(`/wip-items/${id}`)
      return data.data as WipItemWithIngredients
    },
    enabled: !!id,
  })

export const useCreateWipItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { wip_code: string; wip_name: string; uom?: string; yield_qty?: number; notes?: string; output_warehouse?: 'READY' | 'FINISHED_GOODS'; output_product_id?: string | null; ingredients?: Array<{ product_id: string; qty: number; uom?: string }> }) => {
      const { data } = await api.post('/wip-items', body)
      return data.data as WipItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'wip-items'] }),
  })
}

export const useUpdateWipItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; wip_name?: string; uom?: string; yield_qty?: number; notes?: string; output_warehouse?: 'READY' | 'FINISHED_GOODS'; output_product_id?: string | null; is_active?: boolean; ingredients?: Array<{ product_id: string; qty: number; uom?: string }> }) => {
      const { data } = await api.put(`/wip-items/${id}`, body)
      return data.data as WipItem
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['food-production', 'wip-items'] })
      qc.invalidateQueries({ queryKey: KEYS.wipItem(vars.id) })
    },
  })
}

export const useDeleteWipItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/wip-items/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'wip-items'] }),
  })
}

// ── Menu Branch Prices ──

export interface MenuBranchPrice {
  id: string
  menu_id: string
  branch_id: string
  branch_name: string
  selling_price: number
  price_type: 'DINE_IN' | 'DELIVERY' | 'TAKEAWAY'
  source: 'MANUAL' | 'POS_SYNC' | 'IMPORT'
  synced_at: string | null
}

export const useMenuBranchPrices = (menuId: string) =>
  useQuery({
    queryKey: ['food-production', 'menu-branch-prices', menuId],
    queryFn: async () => {
      const { data } = await api.get('/menu-branch-prices', { params: { menu_id: menuId } })
      return data.data as MenuBranchPrice[]
    },
    enabled: !!menuId,
  })

export const useUpsertMenuBranchPrice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { menu_id: string; branch_id: string; selling_price: number; price_type?: string }) => {
      const { data } = await api.post('/menu-branch-prices', body)
      return data.data as MenuBranchPrice
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['food-production', 'menu-branch-prices', vars.menu_id] }),
  })
}

export const useUpdateMenuBranchPrice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, selling_price }: { id: string; menuId: string; selling_price: number }) => {
      const { data } = await api.put(`/menu-branch-prices/${id}`, { selling_price })
      return data.data as MenuBranchPrice
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['food-production', 'menu-branch-prices', vars.menuId] }),
  })
}

export const useDeleteMenuBranchPrice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; menuId: string }) => {
      await api.delete(`/menu-branch-prices/${id}`)
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['food-production', 'menu-branch-prices', vars.menuId] }),
  })
}

export const useSyncMenuBranchPrices = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (menuId?: string) => {
      const { data } = await api.post('/menu-branch-prices/sync-from-pos', { menu_id: menuId })
      return data.data as { inserted: number; synced: number; skipped_manual: number; skipped_threshold: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-production', 'menu-branch-prices'] }),
  })
}

// ── Active Branches (for merge with branch prices) ──

export interface BranchOption {
  id: string
  branch_name: string
}

export const useActiveBranches = () =>
  useQuery({
    queryKey: ['branches', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/branches', { params: { limit: 100, status: 'active' } })
      return (data.data || []) as BranchOption[]
    },
    staleTime: 5 * 60_000,
  })

export const useCogsPreview = () =>
  useMutation({
    mutationFn: async (body: { period_start: string; period_end: string; branch_id?: string | null }) => {
      const { data } = await api.post('/cogs/preview', body)
      return data.data as CogsPreviewResult
    },
  })

export const useCogsFinalize = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { period_start: string; period_end: string; branch_id?: string | null; journal_date?: string; notes?: string }) => {
      const { data } = await api.post('/cogs/finalize', body)
      return data.data as { calculation: CogsCalculation; journal_id: string; journal_number: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-production', 'cogs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCogsHistory = (params: { page?: number; limit?: number; status?: string; period_start?: string; period_end?: string; branch_id?: string } = {}) =>
  useQuery({
    queryKey: KEYS.cogsHistory(params),
    queryFn: async () => {
      const { data } = await api.get('/cogs', { params })
      return { data: data.data as CogsCalculation[], pagination: data.pagination as Pagination }
    },
    staleTime: 60_000,
  })

export const useCogsDetail = (id: string) =>
  useQuery({
    queryKey: KEYS.cogsDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/cogs/${id}`)
      return data.data as { calculation: CogsCalculation; lines: Array<{ menu_name: string; category_name: string; qty_sold: number; cost_per_unit: number; total_cogs: number; revenue: number; cogs_percentage: number; has_recipe: boolean }> }
    },
    enabled: !!id,
  })


// ─── Production Orders ───

export interface ProductionOrderListItem {
  id: string
  order_number: string
  branch_id: string
  branch_name: string
  production_date: string
  status: 'DRAFT' | 'COMPLETED' | 'JOURNALED' | 'VOID'
  total_material_cost: number
  total_waste_cost: number
  total_estimated_cost?: number
  notes: string | null
  created_at: string
  created_by_name: string | null
}

export interface ProductionOrderLine {
  id: string
  wip_id: string
  wip_name: string
  wip_code: string
  planned_batch_qty: number
  actual_batch_qty: number | null
  yield_per_batch: number
  uom: string
  total_yield: number | null
  cost_per_batch: number
  total_cost: number | null
  output_warehouse: 'READY' | 'FINISHED_GOODS'
  output_product_id: string | null
  materials: ProductionOrderMaterial[]
}

export interface ProductionOrderMaterial {
  id: string
  production_line_id: string
  product_id: string
  product_name: string
  product_code: string
  planned_qty: number
  actual_qty: number | null
  uom: string
  cost_per_unit: number
  cost_source: string
  total_cost: number | null
  waste_qty: number
  waste_reason: string | null
}

export interface ProductionOrderDetail extends ProductionOrderListItem {
  lines: ProductionOrderLine[]
  journal_id: string | null
  completed_by: string | null
  completed_at: string | null
}

export interface DailySummaryItem {
  production_date: string
  branch_id: string
  branch_name: string
  order_count: number
  total_batches: number
  total_cost: number
  total_waste_cost: number
}

export interface MaterialUsageItem {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  total_used: number
  total_waste: number
  total_cost: number
  total_waste_cost: number
}

export const useProductionOrders = (params: {
  page?: number; limit?: number; branch_id?: string; status?: string; date_from?: string; date_to?: string
}) =>
  useQuery({
    queryKey: ['production-orders', params],
    queryFn: async () => {
      const { data } = await api.get('/production-orders', { params })
      return data as { data: ProductionOrderListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
    },
  })

export const useProductionOrder = (id: string) =>
  useQuery({
    queryKey: ['production-order', id],
    queryFn: async () => {
      const { data } = await api.get(`/production-orders/${id}`)
      return data.data as ProductionOrderDetail
    },
    enabled: !!id,
  })

export const useProductionOrderSummary = (params: { date_from: string; date_to: string; branch_id?: string }) =>
  useQuery({
    queryKey: ['production-orders', 'summary', params],
    queryFn: async () => {
      const { data } = await api.get('/production-orders/summary', { params })
      return (data.data || []) as DailySummaryItem[]
    },
    enabled: !!params.date_from && !!params.date_to,
  })

export const useProductionOrderMaterials = (params: { date_from: string; date_to: string; branch_id?: string }) =>
  useQuery({
    queryKey: ['production-orders', 'materials', params],
    queryFn: async () => {
      const { data } = await api.get('/production-orders/materials-report', { params })
      return (data.data || []) as MaterialUsageItem[]
    },
    enabled: !!params.date_from && !!params.date_to,
  })

export const useCreateProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { branch_id: string; production_date: string; notes?: string; lines: { wip_id: string; planned_batch_qty: number }[] }) => {
      const { data } = await api.post('/production-orders', body)
      return data.data as ProductionOrderDetail
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }) },
  })
}

export const useCompleteProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lines }: { id: string; lines: { id: string; actual_batch_qty: number; materials: { id: string; actual_qty: number; waste_qty?: number; waste_reason?: string }[] }[] }) => {
      await api.post(`/production-orders/${id}/complete`, { lines })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); qc.invalidateQueries({ queryKey: ['production-order'] }) },
  })
}

export const useGenerateProductionJournal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/production-orders/${id}/generate-journal`)
      return data.data as { journal_id: string }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); qc.invalidateQueries({ queryKey: ['production-order'] }) },
  })
}

export const useVoidProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/production-orders/${id}/void`, { reason })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }); qc.invalidateQueries({ queryKey: ['production-order'] }) },
  })
}

export const useDeleteProductionOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/production-orders/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['production-orders'] }) },
  })
}
