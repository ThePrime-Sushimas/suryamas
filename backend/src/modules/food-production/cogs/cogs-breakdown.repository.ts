import { pool } from '../../../config/db'
import { logError } from '../../../config/logger'

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

// ── Repository ───────────────────────────────────────────────────────────────

export class CogsBreakdownRepository {
  private buildBaseConditions(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    branchId?: string | null,
  ): { conditions: string[]; params: unknown[]; nextIdx: number } {
    const conditions = [
      'sh.sales_date >= $1::date',
      'sh.sales_date <= $2::date',
      'sm.status_id != 2',
    ]
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3

    if (branchId) {
      params.push(branchId)
      conditions.push(`sh.branch_id = (SELECT pos_id FROM pos_staging_branches WHERE mapped_id = $${idx})`)
      idx += 1
    }

    return { conditions, params, nextIdx: idx }
  }

  async getDailyBreakdown(
    companyId: string, periodStart: string, periodEnd: string, branchId?: string | null,
  ): Promise<DailyCogsRow[]> {
    const { conditions, params, nextIdx } = this.buildBaseConditions(companyId, periodStart, periodEnd, branchId)
    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        sh.sales_date::text AS sales_date,
        SUM(sm.qty * COALESCE(m.estimated_cost, 0))::numeric AS total_cogs,
        SUM(sm.price * sm.qty)::numeric AS total_revenue,
        CASE WHEN SUM(sm.price * sm.qty) > 0
          THEN ROUND((SUM(sm.qty * COALESCE(m.estimated_cost, 0)) / SUM(sm.price * sm.qty) * 100)::numeric, 2)
          ELSE 0 END AS cogs_percentage,
        SUM(CASE WHEN mc.category_code = 'FOOD' THEN sm.qty * COALESCE(m.estimated_cost, 0) ELSE 0 END)::numeric AS food_cogs,
        SUM(CASE WHEN mc.category_code = 'BEVERAGE' THEN sm.qty * COALESCE(m.estimated_cost, 0) ELSE 0 END)::numeric AS beverage_cogs,
        SUM(CASE WHEN mc.category_code NOT IN ('FOOD', 'BEVERAGE') OR mc.category_code IS NULL THEN sm.qty * COALESCE(m.estimated_cost, 0) ELSE 0 END)::numeric AS other_cogs
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $${nextIdx} AND m.deleted_at IS NULL
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      WHERE ${where}
      GROUP BY sh.sales_date
      ORDER BY sh.sales_date ASC`,
      [...params, companyId],
    )

    return rows.map(r => ({
      sales_date: r.sales_date,
      total_cogs: Number(r.total_cogs) || 0,
      total_revenue: Number(r.total_revenue) || 0,
      cogs_percentage: Number(r.cogs_percentage) || 0,
      food_cogs: Number(r.food_cogs) || 0,
      beverage_cogs: Number(r.beverage_cogs) || 0,
      other_cogs: Number(r.other_cogs) || 0,
    }))
  }

  async getCategoryBreakdown(
    companyId: string, periodStart: string, periodEnd: string, branchId?: string | null,
  ): Promise<CategoryBreakdownRow[]> {
    const { conditions, params, nextIdx } = this.buildBaseConditions(companyId, periodStart, periodEnd, branchId)
    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        mc.category_code, mc.category_name,
        SUM(sm.qty * COALESCE(m.estimated_cost, 0))::numeric AS total_cogs,
        SUM(sm.price * sm.qty)::numeric AS total_revenue,
        CASE WHEN SUM(sm.price * sm.qty) > 0
          THEN ROUND((SUM(sm.qty * COALESCE(m.estimated_cost, 0)) / SUM(sm.price * sm.qty) * 100)::numeric, 2)
          ELSE 0 END AS cogs_percentage,
        SUM(sm.qty)::numeric AS qty_sold,
        COUNT(DISTINCT sm.menu_id)::int AS menu_count
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $${nextIdx} AND m.deleted_at IS NULL
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      WHERE ${where}
      GROUP BY mc.category_code, mc.category_name
      ORDER BY total_cogs DESC NULLS LAST`,
      [...params, companyId],
    )

    return rows.map(r => ({
      category_code: r.category_code,
      category_name: r.category_name,
      total_cogs: Number(r.total_cogs) || 0,
      total_revenue: Number(r.total_revenue) || 0,
      cogs_percentage: Number(r.cogs_percentage) || 0,
      qty_sold: Number(r.qty_sold) || 0,
      menu_count: Number(r.menu_count) || 0,
    }))
  }

  async getGroupBreakdown(
    companyId: string, periodStart: string, periodEnd: string, branchId?: string | null,
  ): Promise<GroupBreakdownRow[]> {
    const { conditions, params, nextIdx } = this.buildBaseConditions(companyId, periodStart, periodEnd, branchId)
    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        mc.category_code, mc.category_name,
        mg.id::text AS group_id, mg.group_name,
        SUM(sm.qty * COALESCE(m.estimated_cost, 0))::numeric AS total_cogs,
        SUM(sm.price * sm.qty)::numeric AS total_revenue,
        CASE WHEN SUM(sm.price * sm.qty) > 0
          THEN ROUND((SUM(sm.qty * COALESCE(m.estimated_cost, 0)) / SUM(sm.price * sm.qty) * 100)::numeric, 2)
          ELSE 0 END AS cogs_percentage,
        SUM(sm.qty)::numeric AS qty_sold,
        COUNT(DISTINCT sm.menu_id)::int AS menu_count
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $${nextIdx} AND m.deleted_at IS NULL
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      LEFT JOIN menu_groups mg ON mg.id = m.group_id
      WHERE ${where}
      GROUP BY mc.category_code, mc.category_name, mg.id, mg.group_name
      ORDER BY mc.category_name NULLS LAST, total_cogs DESC`,
      [...params, companyId],
    )

    return rows.map(r => ({
      category_code: r.category_code,
      category_name: r.category_name,
      group_id: r.group_id,
      group_name: r.group_name,
      total_cogs: Number(r.total_cogs) || 0,
      total_revenue: Number(r.total_revenue) || 0,
      cogs_percentage: Number(r.cogs_percentage) || 0,
      qty_sold: Number(r.qty_sold) || 0,
      menu_count: Number(r.menu_count) || 0,
    }))
  }

  async getMenuBreakdown(
    companyId: string, periodStart: string, periodEnd: string,
    branchId?: string | null, categoryCode?: string | null, groupId?: string | null,
  ): Promise<MenuBreakdownRow[]> {
    const { conditions, params, nextIdx } = this.buildBaseConditions(companyId, periodStart, periodEnd, branchId)
    let idx = nextIdx

    if (categoryCode) { params.push(categoryCode); conditions.push(`mc.category_code = $${idx++}`) }
    if (groupId) { params.push(groupId); conditions.push(`mg.id::text = $${idx++}`) }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        sm.menu_id,
        COALESCE(m.menu_name, psm.menu_name, 'Unknown Menu #' || sm.menu_id) AS menu_name,
        mc.category_code, mc.category_name,
        mg.id::text AS group_id, mg.group_name,
        m.id::text AS internal_menu_id,
        COALESCE(m.estimated_cost, 0)::numeric AS estimated_cost,
        COALESCE(m.has_recipe, false) AS has_recipe,
        SUM(sm.qty)::numeric AS qty_sold,
        SUM(sm.price * sm.qty)::numeric AS revenue,
        SUM(sm.qty * COALESCE(m.estimated_cost, 0))::numeric AS total_cogs,
        CASE WHEN SUM(sm.price * sm.qty) > 0
          THEN ROUND((SUM(sm.qty * COALESCE(m.estimated_cost, 0)) / SUM(sm.price * sm.qty) * 100)::numeric, 2)
          ELSE 0 END AS cogs_percentage
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $${idx} AND m.deleted_at IS NULL
      LEFT JOIN pos_staging_menus psm ON psm.pos_id = sm.menu_id
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      LEFT JOIN menu_groups mg ON mg.id = m.group_id
      WHERE ${where}
      GROUP BY sm.menu_id, m.menu_name, psm.menu_name, mc.category_code, mc.category_name,
               mg.id, mg.group_name, m.id, m.estimated_cost, m.has_recipe
      ORDER BY total_cogs DESC`,
      [...params, companyId],
    )

    return rows.map(r => ({
      menu_id: r.menu_id,
      menu_name: r.menu_name,
      category_code: r.category_code,
      category_name: r.category_name,
      group_id: r.group_id,
      group_name: r.group_name,
      internal_menu_id: r.internal_menu_id,
      estimated_cost: Number(r.estimated_cost) || 0,
      has_recipe: r.has_recipe,
      qty_sold: Number(r.qty_sold) || 0,
      revenue: Number(r.revenue) || 0,
      total_cogs: Number(r.total_cogs) || 0,
      cogs_percentage: Number(r.cogs_percentage) || 0,
    }))
  }

  async getFullBreakdown(companyId: string, periodStart: string, periodEnd: string, branchId?: string | null) {
    const [daily, categories, groups, menus] = await Promise.all([
      this.getDailyBreakdown(companyId, periodStart, periodEnd, branchId),
      this.getCategoryBreakdown(companyId, periodStart, periodEnd, branchId),
      this.getGroupBreakdown(companyId, periodStart, periodEnd, branchId),
      this.getMenuBreakdown(companyId, periodStart, periodEnd, branchId),
    ])
    return { daily, categories, groups, menus }
  }
}

export const cogsBreakdownRepository = new CogsBreakdownRepository()
