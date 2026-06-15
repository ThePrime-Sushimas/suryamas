import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  MonthlyStockOpname,
  MonthlyStockOpnameWithRelations,
  MonthlyStockOpnameDetail,
  MonthlyStockOpnameLine,
  MonthlyOpnameSummary,
  MonthlyOpnameListFilter,
} from './monthly-stock-opname.types'

// ─── HELPER TYPES ─────────────────────────────────────────────────────────────

export interface InsertLineData {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  snapshot_qty: number
  cost_per_unit: number
  sort_order: number
}

export interface ProductStockInfo {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  qty: number
  avg_cost: number
}

// ─── SQL FRAGMENTS ────────────────────────────────────────────────────────────

const HEADER_SELECT = `
  mso.*,
  b.branch_name, b.branch_code,
  w.warehouse_name,
  pic.full_name AS pic_name,
  pos.position_name AS position_name,
  pos.position_code AS position_code,
  confirmer.full_name AS confirmed_by_name,
  reopener.full_name AS reopened_by_name
`

const HEADER_FROM = `
  FROM monthly_stock_opname mso
  JOIN branches b ON b.id = mso.branch_id
  JOIN warehouses w ON w.id = mso.warehouse_id
  LEFT JOIN employees pic ON pic.user_id = mso.pic_user_id
  LEFT JOIN positions pos ON pos.id = mso.position_id
  LEFT JOIN employees confirmer ON confirmer.user_id = mso.confirmed_by
  LEFT JOIN employees reopener ON reopener.user_id = mso.reopened_by
`

// ─── REPOSITORY CLASS ─────────────────────────────────────────────────────────

export class MonthlyStockOpnameRepository {

  // ─── TRANSACTION WRAPPER ──────────────────────────────────────────────────────

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

  // ─── HEADER QUERIES ─────────────────────────────────────────────────────────

  async findAll(
    branchIds: string[],
    pagination: { limit: number; offset: number },
    filter?: MonthlyOpnameListFilter,
    search?: string,
  ): Promise<{ data: MonthlyStockOpnameWithRelations[]; total: number }> {
    const scopedBranches = filter?.branch_id
      ? branchIds.filter((id) => id === filter.branch_id)
      : branchIds

    const conditions = ['mso.branch_id = ANY($1::uuid[])', 'mso.is_deleted = false']
    const params: unknown[] = [scopedBranches]
    let idx = 2

    if (filter?.warehouse_id) {
      params.push(filter.warehouse_id)
      conditions.push(`mso.warehouse_id = $${idx++}`)
    }
    if (filter?.status) {
      params.push(filter.status)
      conditions.push(`mso.status = $${idx++}`)
    }
    if (filter?.date_from) {
      params.push(filter.date_from)
      conditions.push(`mso.opname_date >= $${idx++}::date`)
    }
    if (filter?.date_to) {
      params.push(filter.date_to)
      conditions.push(`mso.opname_date <= $${idx++}::date`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(pic.full_name ILIKE $${idx} OR mso.opname_number ILIKE $${idx})`)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where}
         ORDER BY mso.opname_date DESC, mso.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total ${HEADER_FROM} ${where}`,
        params,
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findByIdAccessible(
    id: string,
    branchIds: string[],
  ): Promise<MonthlyStockOpnameDetail | null> {
    const { rows: headerRows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE mso.id = $1 AND mso.branch_id = ANY($2::uuid[]) AND mso.is_deleted = false`,
      [id, branchIds],
    )
    if (headerRows.length === 0) return null

    const header = headerRows[0] as MonthlyStockOpnameWithRelations

    // Fetch lines
    const { rows: lines } = await pool.query(
      `SELECT * FROM monthly_stock_opname_lines
       WHERE opname_id = $1
       ORDER BY sort_order, product_name`,
      [id],
    )

    const typedLines = lines as MonthlyStockOpnameLine[]
    const summary = this.calculateSummary(typedLines)

    return { ...header, lines: typedLines, summary }
  }

  async findHeaderById(id: string): Promise<MonthlyStockOpname | null> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_stock_opname WHERE id = $1 AND is_deleted = false`,
      [id],
    )
    return rows[0] ?? null
  }

  async findDuplicate(
    branchId: string,
    warehouseId: string,
    opnameDate: string,
    positionId: string | null,
  ): Promise<MonthlyStockOpname | null> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_stock_opname
       WHERE branch_id = $1
         AND warehouse_id = $2
         AND opname_date = $3::date
         AND COALESCE(position_id::text, '') = COALESCE($4::text, '')
         AND is_deleted = false
         AND deleted_at IS NULL`,
      [branchId, warehouseId, opnameDate, positionId ?? null],
    )
    return rows[0] ?? null
  }

  // ─── OPNAME NUMBER GENERATION ───────────────────────────────────────────────

  async generateOpnameNumber(client: PoolClient, companyId: string, branchCode: string, opnameDate: string): Promise<string> {
    const dateStr = opnameDate.replace(/-/g, '')
    const prefix = `MSO-${branchCode}-${dateStr}`

    // Advisory lock to prevent race condition
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [prefix])

    const { rows } = await client.query(
      `SELECT opname_number FROM monthly_stock_opname
       WHERE company_id = $1 AND opname_number LIKE $2
       ORDER BY opname_number DESC LIMIT 1 FOR UPDATE`,
      [companyId, `${prefix}-%`],
    )
    const lastSeq = rows.length > 0 ? parseInt(rows[0].opname_number?.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  // ─── INSERT ─────────────────────────────────────────────────────────────────

  async insertHeader(
    client: PoolClient,
    data: {
      company_id: string
      branch_id: string
      warehouse_id: string
      opname_number: string
      opname_date: string
      scope: string
      position_id: string | null
      pic_user_id: string
      snapshot_taken_at: string
      notes: string | null
      total_lines: number
      created_by: string
    },
  ): Promise<MonthlyStockOpname> {
    const { rows } = await client.query(
      `INSERT INTO monthly_stock_opname
         (company_id, branch_id, warehouse_id, opname_number, opname_date, scope,
          position_id, pic_user_id, snapshot_taken_at, notes, total_lines, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING *`,
      [
        data.company_id, data.branch_id, data.warehouse_id, data.opname_number,
        data.opname_date, data.scope, data.position_id, data.pic_user_id,
        data.snapshot_taken_at, data.notes, data.total_lines, data.created_by,
      ],
    )
    return rows[0]
  }

  async insertLines(client: PoolClient, opnameId: string, lines: InsertLineData[]): Promise<void> {
    if (lines.length === 0) return

    const values: string[] = []
    const params: unknown[] = [opnameId]
    let idx = 2

    for (const line of lines) {
      values.push(
        `($1, $${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`,
      )
      params.push(
        line.product_id, line.product_code, line.product_name,
        line.uom, line.snapshot_qty, line.cost_per_unit, line.sort_order,
      )
      idx += 7
    }

    await client.query(
      `INSERT INTO monthly_stock_opname_lines
         (opname_id, product_id, product_code, product_name, uom, snapshot_qty, cost_per_unit, sort_order)
       VALUES ${values.join(', ')}`,
      params,
    )
  }

  // ─── UPDATES ────────────────────────────────────────────────────────────────

  async updateLine(
    lineId: string,
    data: {
      actual_qty?: number
      investigasi_note?: string | null
      selisih_qty?: number
      selisih_value?: number
      expected_qty?: number
    },
  ): Promise<MonthlyStockOpnameLine | null> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.actual_qty !== undefined) {
      params.push(data.actual_qty)
      sets.push(`actual_qty = $${idx++}`)
    }
    if (data.investigasi_note !== undefined) {
      params.push(data.investigasi_note)
      sets.push(`investigasi_note = $${idx++}`)
    }
    if (data.selisih_qty !== undefined) {
      params.push(data.selisih_qty)
      sets.push(`selisih_qty = $${idx++}`)
    }
    if (data.selisih_value !== undefined) {
      params.push(data.selisih_value)
      sets.push(`selisih_value = $${idx++}`)
    }
    if (data.expected_qty !== undefined) {
      params.push(data.expected_qty)
      sets.push(`expected_qty = $${idx++}`)
    }

    params.push(lineId)
    const { rows } = await pool.query(
      `UPDATE monthly_stock_opname_lines SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    )
    return rows[0] ?? null
  }

  async updateLineMovements(
    client: PoolClient,
    lineId: string,
    data: { out_movement_id: string | null; in_movement_id: string | null },
  ): Promise<void> {
    await client.query(
      `UPDATE monthly_stock_opname_lines
       SET out_movement_id = $1, in_movement_id = $2, updated_at = now()
       WHERE id = $3`,
      [data.out_movement_id, data.in_movement_id, lineId],
    )
  }

  async updateHeaderStatus(
    client: PoolClient,
    id: string,
    data: {
      status?: string
      confirmed_by?: string
      confirmed_at?: string
      reopened_by?: string
      reopened_at?: string
      total_selisih_value?: number
      completed_lines?: number
      updated_by?: string
    },
  ): Promise<void> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.status !== undefined) { params.push(data.status); sets.push(`status = $${idx++}`) }
    if (data.confirmed_by !== undefined) { params.push(data.confirmed_by); sets.push(`confirmed_by = $${idx++}`) }
    if (data.confirmed_at !== undefined) { params.push(data.confirmed_at); sets.push(`confirmed_at = $${idx++}`) }
    if (data.reopened_by !== undefined) { params.push(data.reopened_by); sets.push(`reopened_by = $${idx++}`) }
    if (data.reopened_at !== undefined) { params.push(data.reopened_at); sets.push(`reopened_at = $${idx++}`) }
    if (data.total_selisih_value !== undefined) { params.push(data.total_selisih_value); sets.push(`total_selisih_value = $${idx++}`) }
    if (data.completed_lines !== undefined) { params.push(data.completed_lines); sets.push(`completed_lines = $${idx++}`) }
    if (data.updated_by !== undefined) { params.push(data.updated_by); sets.push(`updated_by = $${idx++}`) }

    params.push(id)
    await client.query(
      `UPDATE monthly_stock_opname SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    )
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE monthly_stock_opname SET is_deleted = true, deleted_at = now(), updated_by = $1, updated_at = now() WHERE id = $2`,
      [userId, id],
    )
  }

  /**
   * Direct header update without requiring a transaction client.
   * For single-field updates where transaction is unnecessary.
   */
  async updateHeaderDirect(
    id: string,
    data: { completed_lines?: number; total_selisih_value?: number; updated_by?: string },
  ): Promise<void> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.completed_lines !== undefined) { params.push(data.completed_lines); sets.push(`completed_lines = $${idx++}`) }
    if (data.total_selisih_value !== undefined) { params.push(data.total_selisih_value); sets.push(`total_selisih_value = $${idx++}`) }
    if (data.updated_by !== undefined) { params.push(data.updated_by); sets.push(`updated_by = $${idx++}`) }

    params.push(id)
    await pool.query(
      `UPDATE monthly_stock_opname SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    )
  }

  // ─── STOCK QUERIES ──────────────────────────────────────────────────────────

  async getProductsWithStock(warehouseId: string): Promise<ProductStockInfo[]> {
    // SO bulanan include qty >= 0 (termasuk 0) untuk reconciliasi penuh
    const { rows } = await pool.query(
      `SELECT
        p.id AS product_id,
        p.product_code,
        p.product_name,
        COALESCE(mu.unit_name, '') AS uom,
        sb.qty,
        sb.avg_cost
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE sb.warehouse_id = $1
         AND sb.qty >= 0
         AND p.is_deleted = false
       ORDER BY p.product_name`,
      [warehouseId],
    )
    return rows.map((row) => ({
      product_id: row.product_id,
      product_code: row.product_code,
      product_name: row.product_name,
      uom: row.uom,
      qty: Number(row.qty),
      avg_cost: Number(row.avg_cost),
    }))
  }

  async getProductsByPosition(positionId: string, companyId: string): Promise<Set<string>> {
    const { rows } = await pool.query(
      `SELECT DISTINCT product_id FROM (
        SELECT wi.product_id
        FROM wip_position_access wpa
        JOIN wip_items w ON w.id = wpa.wip_id AND w.is_deleted = false AND w.is_active = true AND w.company_id = $2
        JOIN wip_ingredients wi ON wi.wip_id = w.id
        WHERE wpa.position_id = $1
        UNION
        SELECT w.output_product_id AS product_id
        FROM wip_position_access wpa
        JOIN wip_items w ON w.id = wpa.wip_id AND w.is_deleted = false AND w.is_active = true AND w.company_id = $2
        WHERE wpa.position_id = $1 AND w.output_product_id IS NOT NULL
      ) sub`,
      [positionId, companyId],
    )
    return new Set(rows.map(r => r.product_id))
  }

  /**
   * Calculate net movement for products in a warehouse since a given timestamp.
   * This is used to compute movement_during_so.
   */
  async getNetMovementsSince(
    warehouseId: string,
    sinceTimestamp: string,
    productIds?: string[],
  ): Promise<Map<string, number>> {
    let query = `
      SELECT
        sm.product_id,
        SUM(CASE
          WHEN sm.movement_type LIKE 'IN_%' THEN sm.qty
          WHEN sm.movement_type LIKE 'OUT_%' THEN -ABS(sm.qty)
          ELSE 0
        END) AS net_movement
      FROM stock_movements sm
      WHERE sm.warehouse_id = $1
        AND sm.created_at >= $2
        AND sm.created_at <= NOW()
    `
    const params: unknown[] = [warehouseId, sinceTimestamp]

    if (productIds && productIds.length > 0) {
      query += ` AND sm.product_id = ANY($3::uuid[])`
      params.push(productIds)
    }

    query += ` GROUP BY sm.product_id`

    const { rows } = await pool.query(query, params)
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.product_id, Number(row.net_movement))
    }
    return map
  }

  /**
   * Bulk update lines for movement_during_so and expected_qty recalculation.
   * Uses unnest for batch update (single round trip to DB).
   */
  async bulkUpdateExpected(
    opnameId: string,
    updates: { lineId: string; movement_during_so: number; expected_qty: number; selisih_qty: number | null; selisih_value: number | null }[],
  ): Promise<void> {
    if (updates.length === 0) return

    const ids: string[] = []
    const movementDuringValues: number[] = []
    const expectedValues: number[] = []
    const selisihQtyValues: (number | null)[] = []
    const selisihValueValues: (number | null)[] = []

    for (const update of updates) {
      ids.push(update.lineId)
      movementDuringValues.push(update.movement_during_so)
      expectedValues.push(update.expected_qty)
      selisihQtyValues.push(update.selisih_qty)
      selisihValueValues.push(update.selisih_value)
    }

    await pool.query(
      `UPDATE monthly_stock_opname_lines AS t
       SET movement_during_so = v.movement_during_so,
           expected_qty = v.expected_qty,
           selisih_qty = v.selisih_qty,
           selisih_value = v.selisih_value,
           updated_at = now()
       FROM unnest($1::uuid[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[])
         AS v(id, movement_during_so, expected_qty, selisih_qty, selisih_value)
       WHERE t.id = v.id AND t.opname_id = $6`,
      [ids, movementDuringValues, expectedValues, selisihQtyValues, selisihValueValues, opnameId],
    )
  }

  /**
   * Bulk update actual_qty + investigasi_note using unnest (single round trip).
   */
  async bulkUpdateActual(
    opnameId: string,
    updates: {
      lineId: string
      actual_qty: number
      investigasi_note: string | null
      selisih_qty: number
      selisih_value: number
    }[],
  ): Promise<void> {
    if (updates.length === 0) return

    const ids = updates.map(u => u.lineId)
    const actualQtys = updates.map(u => u.actual_qty)
    const investigasiNotes = updates.map(u => u.investigasi_note)
    const selisihQtys = updates.map(u => u.selisih_qty)
    const selisihValues = updates.map(u => u.selisih_value)

    await pool.query(
      `UPDATE monthly_stock_opname_lines AS t
       SET actual_qty = v.actual_qty,
           investigasi_note = COALESCE(v.investigasi_note, t.investigasi_note),
           selisih_qty = v.selisih_qty,
           selisih_value = v.selisih_value,
           updated_at = now()
       FROM unnest($1::uuid[], $2::numeric[], $3::text[], $4::numeric[], $5::numeric[])
         AS v(id, actual_qty, investigasi_note, selisih_qty, selisih_value)
       WHERE t.id = v.id AND t.opname_id = $6`,
      [ids, actualQtys, investigasiNotes, selisihQtys, selisihValues, opnameId],
    )
  }

  async getLinesByOpnameId(opnameId: string): Promise<MonthlyStockOpnameLine[]> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_stock_opname_lines WHERE opname_id = $1 ORDER BY sort_order, product_name`,
      [opnameId],
    )
    return rows
  }

  async getLineById(opnameId: string, lineId: string): Promise<MonthlyStockOpnameLine | null> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_stock_opname_lines WHERE id = $1 AND opname_id = $2`,
      [lineId, opnameId],
    )
    return rows[0] ?? null
  }

  // ─── WAREHOUSE QUERIES ──────────────────────────────────────────────────────

  async findWarehouseById(warehouseId: string, branchId: string): Promise<{ id: string; warehouse_name: string } | null> {
    const { rows } = await pool.query(
      `SELECT id, warehouse_name FROM warehouses WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL`,
      [warehouseId, branchId],
    )
    return rows[0] ?? null
  }

  async getBranchCode(branchId: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT branch_code FROM branches WHERE id = $1`,
      [branchId],
    )
    return rows[0]?.branch_code ?? null
  }

  async getBranchName(branchId: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT branch_name FROM branches WHERE id = $1`,
      [branchId],
    )
    return rows[0]?.branch_name ?? null
  }

  // ─── MOVEMENT QUERIES (for reopen) ─────────────────────────────────────────

  async getMovementsByOpnameId(
    client: PoolClient,
    opnameId: string,
  ): Promise<{ product_id: string; movement_type: string; qty: number; cost_per_unit: number }[]> {
    const { rows } = await client.query(
      `SELECT product_id, movement_type, qty, cost_per_unit
       FROM stock_movements
       WHERE reference_type = 'monthly_stock_opname'
         AND reference_id = $1
         AND movement_type IN ('OUT_WASTE', 'OUT_ADJUSTMENT', 'IN_ADJUSTMENT')`,
      [opnameId],
    )
    return rows
  }

  async getPositionDepartmentId(client: PoolClient, positionId: string | null): Promise<string | null> {
    if (!positionId) return null
    const { rows } = await client.query(
      `SELECT department_id FROM positions WHERE id = $1`,
      [positionId],
    )
    return rows[0]?.department_id ?? null
  }

  async insertMonthlyShortageEntry(
    client: PoolClient,
    data: {
      monthly_opname_id: string
      monthly_opname_line_id: string
      qty: number
      shortage_note: string | null
      classified_by: string
      company_id: string
      branch_id: string
      department_id: string | null
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO variance_classification_lines (
         source_type, monthly_opname_id, monthly_opname_line_id,
         variance_category, qty, shortage_note, classified_by,
         company_id, branch_id, department_id, resolve_status
       ) VALUES (
         'MONTHLY_OPNAME', $1, $2, 'SHORTAGE', $3, $4, $5, $6, $7, $8, 'UNRESOLVED'
       )`,
      [
        data.monthly_opname_id,
        data.monthly_opname_line_id,
        data.qty,
        data.shortage_note,
        data.classified_by,
        data.company_id,
        data.branch_id,
        data.department_id,
      ],
    )
  }

  async deleteUnresolvedShortageByOpnameId(client: PoolClient, opnameId: string): Promise<void> {
    await client.query(
      `DELETE FROM variance_classification_lines
       WHERE monthly_opname_id = $1
         AND source_type = 'MONTHLY_OPNAME'
         AND variance_category = 'SHORTAGE'
         AND COALESCE(resolve_status, 'UNRESOLVED') = 'UNRESOLVED'`,
      [opnameId],
    )
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private calculateSummary(lines: MonthlyStockOpnameLine[]): MonthlyOpnameSummary {
    const completedProducts = lines.filter(l => l.actual_qty !== null).length
    const productsWithSelisih = lines.filter(l => l.selisih_qty !== null && l.selisih_qty !== 0).length
    const totalSelisihValue = lines.reduce((sum, l) => sum + Math.abs(Number(l.selisih_value) || 0), 0)

    return {
      total_products: lines.length,
      completed_products: completedProducts,
      products_with_selisih: productsWithSelisih,
      total_selisih_value: totalSelisihValue,
      completion_pct: lines.length > 0
        ? Math.round((completedProducts / lines.length) * 100)
        : 0,
    }
  }
}

export const monthlyStockOpnameRepository = new MonthlyStockOpnameRepository()
