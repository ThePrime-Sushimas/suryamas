import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'
import type { CogsCalculation, CogsCalculationLine } from './cogs.types'

export interface SalesAggregateRow {
  menu_id: number
  menu_name: string
  category_code: string | null
  category_name: string | null
  internal_menu_id: string | null
  estimated_cost: number
  has_recipe: boolean
  qty_sold: number
  revenue: number
}

export class CogsRepository {
  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async isFiscalPeriodOpen(companyId: string, periodStart: string, periodEnd: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT id FROM fiscal_periods
       WHERE company_id = $1 AND is_open = true
         AND period_start <= $2::date AND period_end >= $3::date
       LIMIT 1`,
      [companyId, periodStart, periodEnd],
    )
    return rows.length > 0
  }

  async findMenuCategoryCogsMappings(
    companyId: string,
  ): Promise<Array<{ category_code: string; cogs_coa_id: string | null }>> {
    const { rows } = await pool.query(
      `SELECT category_code, cogs_coa_id FROM menu_categories WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId],
    )
    return rows
  }

  async findInventoryCoaId(companyId: string, accountCode = '110501'): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 AND deleted_at IS NULL`,
      [companyId, accountCode],
    )
    return rows[0]?.id ?? null
  }

  /**
   * Get aggregated sales data per menu for a period.
   * Joins tr_salesmenu → tr_saleshead (for date/branch filter) → menus (for cost).
   * Menus not in `menus` table are included with cost = 0.
   */
  async getSalesAggregate(companyId: string, periodStart: string, periodEnd: string, branchId?: string | null): Promise<SalesAggregateRow[]> {
    const conditions = [
      'sh.sales_date >= $1::date',
      'sh.sales_date <= $2::date',
      'sm.status_id != 12', // exclude voided
    ]
    const params: unknown[] = [periodStart, periodEnd]
    let idx = 3

    if (branchId) {
      // tr_saleshead.branch_id is integer (POS branch ID), map via pos_staging_branches.mapped_id
      params.push(branchId)
      conditions.push(`sh.branch_id = (SELECT pos_id FROM pos_staging_branches WHERE mapped_id = $${idx})`)
      idx++
    }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        sm.menu_id,
        COALESCE(m.menu_name, psm.menu_name, 'Unknown Menu #' || sm.menu_id) AS menu_name,
        mc.category_code,
        mc.category_name,
        m.id AS internal_menu_id,
        COALESCE(m.estimated_cost, 0)::numeric AS estimated_cost,
        COALESCE(m.has_recipe, false) AS has_recipe,
        SUM(sm.qty)::numeric AS qty_sold,
        SUM(sm.price * sm.qty)::numeric AS revenue
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      LEFT JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $${idx} AND m.deleted_at IS NULL
      LEFT JOIN pos_staging_menus psm ON psm.pos_id = sm.menu_id
      LEFT JOIN menu_categories mc ON mc.id = m.category_id
      WHERE ${where}
      GROUP BY sm.menu_id, m.menu_name, psm.menu_name, mc.category_code, mc.category_name, m.id, m.estimated_cost, m.has_recipe
      ORDER BY revenue DESC`,
      [...params, companyId]
    )

    return rows.map(r => ({
      ...r,
      estimated_cost: Number(r.estimated_cost) || 0,
      qty_sold: Number(r.qty_sold) || 0,
      revenue: Number(r.revenue) || 0,
    }))
  }

  async insertCalculation(
    client: PoolClient,
    companyId: string,
    data: {
      branch_id: string | null
      period_start: string
      period_end: string
      total_food_cogs: number
      total_beverage_cogs: number
      total_other_cogs: number
      total_cogs: number
      total_revenue: number
      cogs_percentage: number
      unmapped_menu_count: number
      notes: string | null
      created_by: string
    },
  ): Promise<CogsCalculation> {
    const { rows } = await client.query(
      `INSERT INTO cogs_calculations
       (company_id, branch_id, period_start, period_end, total_food_cogs, total_beverage_cogs, total_other_cogs, total_cogs, total_revenue, cogs_percentage, unmapped_menu_count, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        companyId,
        data.branch_id,
        data.period_start,
        data.period_end,
        data.total_food_cogs,
        data.total_beverage_cogs,
        data.total_other_cogs,
        data.total_cogs,
        data.total_revenue,
        data.cogs_percentage,
        data.unmapped_menu_count,
        data.notes,
        data.created_by,
      ],
    )
    return rows[0]
  }

  async insertCalculationLines(
    client: PoolClient,
    calculationId: string,
    lines: Array<{
      menu_id: string | null
      menu_name: string
      category_name: string | null
      qty_sold: number
      cost_per_unit: number
      total_cogs: number
      revenue: number
      cogs_percentage: number
      has_recipe: boolean
    }>,
  ): Promise<void> {
    const CHUNK_SIZE = 500
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE)
      if (chunk.length === 0) continue

      const valueRows: string[] = []
      const params: unknown[] = []
      let idx = 1

      for (const l of chunk) {
        valueRows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`)
        params.push(
          calculationId,
          l.menu_id,
          l.menu_name,
          l.category_name,
          l.qty_sold,
          l.cost_per_unit,
          l.total_cogs,
          l.revenue,
          l.cogs_percentage,
          l.has_recipe,
        )
        idx += 10
      }

      await client.query(
        `INSERT INTO cogs_calculation_lines (calculation_id, menu_id, menu_name, category_name, qty_sold, cost_per_unit, total_cogs, revenue, cogs_percentage, has_recipe)
         VALUES ${valueRows.join(', ')}`,
        params,
      )
    }
  }

  async voidAndSupersede(client: PoolClient, oldId: string, newId: string): Promise<void> {
    await client.query(
      'UPDATE cogs_calculations SET superseded_by = $1, status = $2 WHERE id = $3',
      [newId, 'VOID', oldId],
    )
  }

  async markJournaled(client: PoolClient, calculationId: string, journalId: string): Promise<void> {
    await client.query(
      'UPDATE cogs_calculations SET status = $1, journal_id = $2 WHERE id = $3',
      ['JOURNALED', journalId, calculationId],
    )
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<CogsCalculation | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      'SELECT * FROM cogs_calculations WHERE id = $1 AND company_id = ANY($2::uuid[])',
      [id, companyIds]
    )
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<CogsCalculation | null> {
    const { rows } = await pool.query(
      'SELECT * FROM cogs_calculations WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async getLines(calculationId: string): Promise<CogsCalculationLine[]> {
    const { rows } = await pool.query(
      'SELECT * FROM cogs_calculation_lines WHERE calculation_id = $1 ORDER BY total_cogs DESC',
      [calculationId]
    )
    return rows
  }

  async findAll(companyIds: string[], pagination: { limit: number; offset: number }, filter?: { period_start?: string; period_end?: string; branch_id?: string; status?: string }): Promise<{ data: CogsCalculation[]; total: number }> {
    const conditions = ['c.company_id = ANY($1::uuid[])', 'c.superseded_by IS NULL']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (filter?.period_start) { params.push(filter.period_start); conditions.push(`c.period_start >= $${idx++}::date`) }
    if (filter?.period_end) { params.push(filter.period_end); conditions.push(`c.period_end <= $${idx++}::date`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`c.branch_id = $${idx++}`) }
    if (filter?.status) { params.push(filter.status); conditions.push(`c.status = $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT c.*, b.branch_name FROM cogs_calculations c LEFT JOIN branches b ON b.id = c.branch_id ${where} ORDER BY c.period_start DESC, c.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM cogs_calculations c ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findExistingForPeriod(companyId: string, periodStart: string, periodEnd: string, branchId: string | null): Promise<CogsCalculation | null> {
    const conditions = ['company_id = $1', 'period_start = $2::date', 'period_end = $3::date', 'superseded_by IS NULL', "status != 'VOID'"]
    const params: unknown[] = [companyId, periodStart, periodEnd]
    let idx = 4

    if (branchId) {
      params.push(branchId)
      conditions.push(`branch_id = $${idx++}`)
    } else {
      conditions.push('branch_id IS NULL')
    }

    const { rows } = await pool.query(
      `SELECT * FROM cogs_calculations WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params
    )
    return rows[0] ?? null
  }
}

export const cogsRepository = new CogsRepository()
