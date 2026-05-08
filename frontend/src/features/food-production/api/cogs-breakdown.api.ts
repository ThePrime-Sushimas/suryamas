import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailyCogsRow {
  sales_date: string
  total_cogs: number
  total_revenue: number
  cogs_percentage: number
  food_cogs: number
  beverage_cogs: number
  other_cogs: number
}

export interface CategoryBreakdownRow {
  category_code: string | null
  category_name: string | null
  total_cogs: number
  total_revenue: number
  cogs_percentage: number
  qty_sold: number
  menu_count: number
}

export interface GroupBreakdownRow {
  category_code: string | null
  category_name: string | null
  group_id: string | null
  group_name: string | null
  total_cogs: number
  total_revenue: number
  cogs_percentage: number
  qty_sold: number
  menu_count: number
}

export interface MenuBreakdownRow {
  menu_id: number
  menu_name: string
  category_code: string | null
  category_name: string | null
  group_id: string | null
  group_name: string | null
  internal_menu_id: string | null
  estimated_cost: number
  has_recipe: boolean
  qty_sold: number
  revenue: number
  total_cogs: number
  cogs_percentage: number
}

export interface CogsBreakdownResult {
  daily: DailyCogsRow[]
  categories: CategoryBreakdownRow[]
  groups: GroupBreakdownRow[]
  menus: MenuBreakdownRow[]
  summary: {
    total_cogs: number
    total_revenue: number
    cogs_percentage: number
    days_count: number
    avg_daily_cogs: number
    peak_day: DailyCogsRow | null
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const cogsBreakdownApi = {
  async getBreakdown(params: { periodStart: string; periodEnd: string; branchId?: string }): Promise<CogsBreakdownResult> {
    const res = await api.get('/cogs-breakdown', {
      params: { period_start: params.periodStart, period_end: params.periodEnd, branch_id: params.branchId },
    })
    return res.data.data
  },

  async getMenus(params: { periodStart: string; periodEnd: string; branchId?: string; categoryCode?: string; groupId?: string }): Promise<MenuBreakdownRow[]> {
    const res = await api.get('/cogs-breakdown/menus', {
      params: { period_start: params.periodStart, period_end: params.periodEnd, branch_id: params.branchId, category_code: params.categoryCode, group_id: params.groupId },
    })
    return res.data.data
  },
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCogsBreakdown(params: { periodStart: string; periodEnd: string; branchId?: string }) {
  return useQuery({
    queryKey: ['cogs-breakdown', params],
    queryFn: () => cogsBreakdownApi.getBreakdown(params),
    enabled: !!params.periodStart && !!params.periodEnd,
    staleTime: 5 * 60 * 1000,
  })
}
