import { pool } from '../../../config/db'
import { BusinessRuleError } from '../../../utils/errors.base'
import type { TheoreticalConsumptionItem, CoverageItem, VarianceItem, BranchIds, MenuProfitabilityRaw, CostTrendItem, WasteSummaryItem } from './theoretical-consumption.types'

export class TheoreticalConsumptionRepository {
  async resolveBranchIds(branchUuid: string): Promise<BranchIds> {
    const { rows } = await pool.query(
      `SELECT DISTINCT branch_pos_id FROM pos_sync_aggregates WHERE branch_id = $1 LIMIT 1`,
      [branchUuid]
    )
    if (rows.length > 0) {
      return { branchUuid, branchPosId: rows[0].branch_pos_id }
    }

    const { rows: fallback } = await pool.query(
      `SELECT psb.pos_id
       FROM pos_staging_branches psb
       JOIN branches b ON LOWER(b.branch_name) LIKE '%' || LOWER(SPLIT_PART(psb.branch_name, ' ', 2)) || '%'
       WHERE b.id = $1
       LIMIT 1`,
      [branchUuid]
    )
    if (fallback.length > 0) {
      return { branchUuid, branchPosId: fallback[0].pos_id }
    }

    throw new BusinessRuleError(`Tidak dapat menemukan POS branch_id untuk cabang ini. Pastikan cabang sudah pernah sync POS.`)
  }

  async getTheoreticalConsumption(periodStart: string, periodEnd: string, branchPosId?: number, station?: string): Promise<TheoreticalConsumptionItem[]> {
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3
    const branchFilter = branchPosId != null ? `AND sh.branch_id = $${idx}` : ''
    if (branchPosId != null) { params.push(branchPosId); idx++ }
    const stationFilter = station ? `AND p.station = $${idx}` : ''
    if (station) { params.push(station); idx++ }

    const { rows } = await pool.query(
      `WITH
      direct_consumption AS (
        SELECT
          rl.product_id,
          p.product_name,
          p.product_code,
          rl.uom,
          SUM(rl.qty * sm.qty) AS theoretical_qty,
          SUM(rl.qty * sm.qty * rl.cost_per_unit) AS theoretical_cost
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.product_id IS NOT NULL
        JOIN products p ON p.id = rl.product_id
        WHERE sm.status_id = 13
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchFilter}
          ${stationFilter}
        GROUP BY rl.product_id, p.product_name, p.product_code, rl.uom
      ),
      wip_consumption AS (
        SELECT
          wi.product_id,
          p.product_name,
          p.product_code,
          wi.uom,
          SUM((rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty) AS theoretical_qty,
          SUM((rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty * wi.cost_per_unit) AS theoretical_cost
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
        JOIN wip_items wip ON wip.id = rl.wip_id
        JOIN wip_ingredients wi ON wi.wip_id = wip.id
        JOIN products p ON p.id = wi.product_id
        WHERE sm.status_id = 13
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchFilter}
          ${stationFilter}
        GROUP BY wi.product_id, p.product_name, p.product_code, wi.uom
      ),
      all_consumption AS (
        SELECT * FROM direct_consumption
        UNION ALL
        SELECT * FROM wip_consumption
      )
      SELECT
        product_id,
        product_name,
        product_code,
        uom,
        SUM(theoretical_qty)::numeric AS theoretical_qty,
        SUM(theoretical_cost)::numeric AS theoretical_cost
      FROM all_consumption
      GROUP BY product_id, product_name, product_code, uom
      ORDER BY theoretical_cost DESC`,
      params
    )

    return rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      uom: r.uom,
      theoretical_qty: Number(r.theoretical_qty) || 0,
      theoretical_cost: Number(r.theoretical_cost) || 0,
    }))
  }

  async getVariance(periodStart: string, periodEnd: string, branchPosId?: number, branchUuid?: string, station?: string): Promise<VarianceItem[]> {
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3
    const branchFilterPos = branchPosId != null ? `AND sh.branch_id = $${idx}` : ''
    if (branchPosId != null) { params.push(branchPosId); idx++ }
    const branchFilterUuid = branchUuid ? `AND po.branch_id = $${idx}` : ''
    if (branchUuid) { params.push(branchUuid); idx++ }
    let stationParamIdx = 0
    const stationFilter = station ? `AND p.station = $${idx}` : ''
    if (station) { stationParamIdx = idx; params.push(station); idx++ }
    const stationFilterActual = station ? `AND pm.product_id IN (SELECT id FROM products WHERE station = $${stationParamIdx})` : ''

    const { rows } = await pool.query(
      `WITH
      direct_consumption AS (
        SELECT
          rl.product_id, p.product_name, p.product_code, rl.uom,
          SUM(rl.qty * sm.qty) AS theoretical_qty
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.product_id IS NOT NULL
        JOIN products p ON p.id = rl.product_id
        WHERE sm.status_id = 13
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchFilterPos}
          ${stationFilter}
        GROUP BY rl.product_id, p.product_name, p.product_code, rl.uom
      ),
      wip_consumption AS (
        SELECT
          wi.product_id, p.product_name, p.product_code, wi.uom,
          SUM((rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty) AS theoretical_qty
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
        JOIN wip_items wip ON wip.id = rl.wip_id
        JOIN wip_ingredients wi ON wi.wip_id = wip.id
        JOIN products p ON p.id = wi.product_id
        WHERE sm.status_id = 13
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchFilterPos}
          ${stationFilter}
        GROUP BY wi.product_id, p.product_name, p.product_code, wi.uom
      ),
      theoretical AS (
        SELECT product_id, product_name, product_code, uom,
          SUM(theoretical_qty) AS theoretical_qty
        FROM (SELECT * FROM direct_consumption UNION ALL SELECT * FROM wip_consumption) combined
        GROUP BY product_id, product_name, product_code, uom
      ),
      actual AS (
        SELECT
          pm.product_id, pm.product_name, pm.product_code, pm.uom,
          SUM(pm.actual_qty)::numeric AS actual_qty,
          SUM(pm.waste_qty)::numeric AS waste_qty
        FROM production_order_materials pm
        JOIN production_orders po ON po.id = pm.production_order_id
        WHERE po.production_date BETWEEN $1 AND $2
          ${branchFilterUuid}
          AND po.status IN ('COMPLETED', 'JOURNALED')
          AND po.deleted_at IS NULL
          ${stationFilterActual}
        GROUP BY pm.product_id, pm.product_name, pm.product_code, pm.uom
      )
      SELECT
        COALESCE(t.product_id, a.product_id) AS product_id,
        COALESCE(t.product_name, a.product_name) AS product_name,
        COALESCE(t.product_code, a.product_code) AS product_code,
        COALESCE(t.uom, a.uom) AS uom,
        COALESCE(t.theoretical_qty, 0)::numeric AS theoretical_qty,
        COALESCE(a.actual_qty, 0)::numeric AS actual_qty,
        COALESCE(a.waste_qty, 0)::numeric AS waste_qty,
        (COALESCE(a.actual_qty, 0) - COALESCE(t.theoretical_qty, 0))::numeric AS variance_qty,
        CASE
          WHEN COALESCE(t.theoretical_qty, 0) > 0
          THEN ROUND((COALESCE(a.actual_qty, 0) - t.theoretical_qty) / t.theoretical_qty * 100, 2)
          ELSE NULL
        END AS variance_pct
      FROM theoretical t
      FULL OUTER JOIN actual a USING (product_id)
      ORDER BY ABS(COALESCE(a.actual_qty, 0) - COALESCE(t.theoretical_qty, 0)) DESC`,
      params
    )

    return rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      uom: r.uom,
      theoretical_qty: Number(r.theoretical_qty) || 0,
      actual_qty: Number(r.actual_qty) || 0,
      waste_qty: Number(r.waste_qty) || 0,
      variance_qty: Number(r.variance_qty) || 0,
      variance_pct: r.variance_pct != null ? Number(r.variance_pct) : null,
      severity: 'normal' as const, // will be set by service
    }))
  }

  async getCoverage(periodStart: string, periodEnd: string, branchPosId?: number): Promise<{ items: CoverageItem[]; totalMenusSold: number; menusWithRecipe: number }> {
    const branchFilter = branchPosId != null ? 'AND sh.branch_id = $3' : ''
    const params: unknown[] = [periodStart, periodEnd]
    if (branchPosId != null) params.push(branchPosId)

    // Get menus without recipe that were sold
    const { rows: items } = await pool.query(
      `SELECT
        sm.menu_id AS pos_menu_id,
        COALESCE(m.menu_name, sm.custom_menu_name, 'Unknown #' || sm.menu_id::text) AS menu_name,
        COALESCE(m.menu_code, '') AS menu_code,
        SUM(sm.qty)::int AS total_qty_sold,
        COUNT(DISTINCT sh.sales_date)::int AS days_sold,
        CASE
          WHEN SUM(sm.qty) > 100 THEN 'high'
          WHEN SUM(sm.qty) > 20 THEN 'medium'
          ELSE 'low'
        END AS priority
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
      WHERE sm.status_id = 13
        AND sh.sales_date BETWEEN $1 AND $2
        ${branchFilter}
        AND (m.has_recipe = false OR m.id IS NULL)
      GROUP BY sm.menu_id, m.menu_name, sm.custom_menu_name, m.menu_code
      ORDER BY total_qty_sold DESC`,
      params
    )

    // Get summary counts
    const { rows: [summary] } = await pool.query(
      `SELECT
        COUNT(DISTINCT sm.menu_id)::int AS total_menus_sold,
        COUNT(DISTINCT CASE WHEN m.has_recipe = true THEN sm.menu_id END)::int AS menus_with_recipe
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
      WHERE sm.status_id = 13
        AND sh.sales_date BETWEEN $1 AND $2
        ${branchFilter}`,
      params
    )

    return {
      items: items as CoverageItem[],
      totalMenusSold: summary.total_menus_sold,
      menusWithRecipe: summary.menus_with_recipe,
    }
  }

  /**
   * Menu Profitability: HPP % per menu, ranked by margin.
   * Uses actual sales qty × estimated_cost for COGS, actual revenue from tr_salesmenu.
   */
  async getMenuProfitability(periodStart: string, periodEnd: string, branchPosId?: number, station?: string): Promise<MenuProfitabilityRaw[]> {
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3
    const branchFilter = branchPosId != null ? `AND sh.branch_id = $${idx}` : ''
    if (branchPosId != null) { params.push(branchPosId); idx++ }
    let stationFilter = ''
    if (station) {
      params.push(station)
      stationFilter = `AND m.id IN (
        SELECT rl.menu_id FROM recipe_lines rl JOIN products p ON p.id = rl.product_id WHERE p.station = $${idx}
        UNION
        SELECT rl.menu_id FROM recipe_lines rl JOIN wip_ingredients wi ON wi.wip_id = rl.wip_id JOIN products p ON p.id = wi.product_id WHERE p.station = $${idx}
      )`
      idx++
    }

    const { rows } = await pool.query(
      `SELECT
        m.id AS menu_id,
        m.menu_name,
        mc.category_name,
        m.selling_price::numeric,
        m.estimated_cost::numeric,
        CASE WHEN m.selling_price > 0
          THEN ROUND(m.estimated_cost / m.selling_price * 100, 1)
          ELSE 0
        END AS cost_pct,
        SUM(sm.qty)::numeric AS qty_sold,
        SUM(sm.price * sm.qty)::numeric AS total_revenue,
        SUM(sm.qty * m.estimated_cost)::numeric AS total_cogs,
        SUM(sm.price * sm.qty - sm.qty * m.estimated_cost)::numeric AS margin
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL AND m.has_recipe = true
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      WHERE sm.status_id = 13
        AND sh.sales_date BETWEEN $1 AND $2
        ${branchFilter}
        ${stationFilter}
      GROUP BY m.id, m.menu_name, mc.category_name, m.selling_price, m.estimated_cost
      ORDER BY margin DESC`,
      params
    )

    return rows.map(r => ({
      menu_id: r.menu_id,
      menu_name: r.menu_name,
      category_name: r.category_name,
      selling_price: Number(r.selling_price) || 0,
      estimated_cost: Number(r.estimated_cost) || 0,
      cost_pct: Number(r.cost_pct) || 0,
      qty_sold: Number(r.qty_sold) || 0,
      total_revenue: Number(r.total_revenue) || 0,
      total_cogs: Number(r.total_cogs) || 0,
      margin: Number(r.margin) || 0,
    }))
  }

  /**
   * Cost Trend: monthly COGS % over time.
   * Uses period_start/period_end from query params.
   */
  async getCostTrend(companyId: string, periodStart: string, periodEnd: string, branchPosId?: number): Promise<CostTrendItem[]> {
    const branchFilter = branchPosId != null ? 'AND sh.branch_id = $4' : ''
    const params: unknown[] = [companyId, periodStart, periodEnd]
    if (branchPosId != null) params.push(branchPosId)

    const { rows } = await pool.query(
      `SELECT
        TO_CHAR(sh.sales_date, 'YYYY-MM') AS period,
        SUM(sm.price * sm.qty)::numeric AS total_revenue,
        SUM(sm.qty * COALESCE(m.estimated_cost, 0))::numeric AS total_cogs,
        CASE WHEN SUM(sm.price * sm.qty) > 0
          THEN ROUND(SUM(sm.qty * COALESCE(m.estimated_cost, 0)) / SUM(sm.price * sm.qty) * 100, 1)
          ELSE 0
        END AS cost_pct,
        COUNT(DISTINCT sm.menu_id)::int AS menu_count
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id
        AND m.company_id = $1 AND m.deleted_at IS NULL
      WHERE sm.status_id = 13
        AND sh.sales_date BETWEEN $2 AND $3
        ${branchFilter}
      GROUP BY TO_CHAR(sh.sales_date, 'YYYY-MM')
      ORDER BY period`,
      params
    )

    return rows.map(r => ({
      period: r.period,
      total_revenue: Number(r.total_revenue) || 0,
      total_cogs: Number(r.total_cogs) || 0,
      cost_pct: Number(r.cost_pct) || 0,
      menu_count: r.menu_count,
    }))
  }

  /**
   * Waste Summary: from production_order_materials, ranked by waste cost.
   */
  async getWasteSummary(periodStart: string, periodEnd: string, branchUuid?: string, station?: string): Promise<WasteSummaryItem[]> {
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3
    const branchFilter = branchUuid ? `AND po.branch_id = $${idx}` : ''
    if (branchUuid) { params.push(branchUuid); idx++ }
    const stationFilter = station ? `AND pm.product_id IN (SELECT id FROM products WHERE station = $${idx})` : ''
    if (station) { params.push(station); idx++ }

    const { rows } = await pool.query(
      `SELECT
        pm.product_id,
        pm.product_name,
        pm.product_code,
        pm.uom,
        SUM(pm.actual_qty)::numeric AS total_used,
        SUM(pm.waste_qty)::numeric AS total_waste,
        CASE WHEN SUM(pm.actual_qty) > 0
          THEN ROUND(SUM(pm.waste_qty) / SUM(pm.actual_qty) * 100, 1)
          ELSE 0
        END AS waste_pct,
        SUM(pm.waste_qty * pm.cost_per_unit)::numeric AS waste_cost,
        SUM(pm.actual_qty * pm.cost_per_unit)::numeric AS total_used_cost
      FROM production_order_materials pm
      JOIN production_orders po ON po.id = pm.production_order_id
      WHERE po.production_date BETWEEN $1 AND $2
        ${branchFilter}
        AND po.status IN ('COMPLETED', 'JOURNALED')
        AND po.deleted_at IS NULL
        AND pm.waste_qty > 0
        ${stationFilter}
      GROUP BY pm.product_id, pm.product_name, pm.product_code, pm.uom
      ORDER BY waste_cost DESC`,
      params
    )

    return rows.map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      uom: r.uom,
      total_used: Number(r.total_used) || 0,
      total_waste: Number(r.total_waste) || 0,
      waste_pct: Number(r.waste_pct) || 0,
      waste_cost: Number(r.waste_cost) || 0,
      total_used_cost: Number(r.total_used_cost) || 0,
    }))
  }
}

export const theoreticalConsumptionRepository = new TheoreticalConsumptionRepository()
