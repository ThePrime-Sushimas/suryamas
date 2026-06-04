import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  DailyClosingCount,
  DailyClosingCountWithRelations,
  DailyClosingCountDetail,
  DailyClosingCountLine,
  OpnameSummary,
  BranchOpnameConfig,
  OpnameDashboardItem,
  VarianceReportItem,
  VarianceReportExportRow,
  VarianceReportFilter,
  UpsertOpnameConfigDto,
} from './daily-stock-opname.types'

// ─── HELPER TYPES ─────────────────────────────────────────────────────────────

export interface InsertLineData {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  system_qty: number
  expected_qty: number
  cost_per_unit: number
  main_balance: number
  dpo_in_qty: number
  theoretical_out: number
  is_high_risk: boolean
  requires_photo: boolean
  has_recipe: boolean
  has_warning: boolean
  warning_message: string | null
  sort_order: number
}

export interface ProductStockInfo {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  risk_category: string
  qty: number
  avg_cost: number
}

// ─── SQL FRAGMENTS ────────────────────────────────────────────────────────────

const HEADER_SELECT = `
  dcc.*,
  b.branch_name, b.branch_code,
  w.warehouse_name,
  pic.full_name AS pic_name,
  pos.position_name AS position_name,
  pos.position_code AS position_code,
  resolver.full_name AS resolved_by_name,
  confirmer.full_name AS confirmed_by_name
`

const HEADER_FROM = `
  FROM daily_closing_counts dcc
  JOIN branches b ON b.id = dcc.branch_id
  JOIN warehouses w ON w.id = dcc.warehouse_id
  LEFT JOIN employees pic ON pic.user_id = dcc.pic_user_id
  LEFT JOIN positions pos ON pos.id = dcc.position_id
  LEFT JOIN employees resolver ON resolver.user_id = dcc.resolved_by
  LEFT JOIN employees confirmer ON confirmer.user_id = dcc.confirmed_by
`

// ─── REPOSITORY CLASS ─────────────────────────────────────────────────────────

export class DailyStockOpnameRepository {

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
    filter?: { branch_id?: string; status?: string; date_from?: string; date_to?: string },
    search?: string,
  ): Promise<{ data: DailyClosingCountWithRelations[]; total: number }> {
    const scopedBranches = filter?.branch_id
      ? branchIds.filter((id) => id === filter.branch_id)
      : branchIds

    const conditions = ['dcc.branch_id = ANY($1::uuid[])', 'dcc.is_deleted = false']
    const params: unknown[] = [scopedBranches]
    let idx = 2

    // Status filter with MISSED logic
    if (filter?.status === 'MISSED') {
      // MISSED = DRAFT sessions from previous days (closing_date < today Jakarta TZ)
      conditions.push(`dcc.status = 'DRAFT'`)
      conditions.push(`dcc.closing_date < (now() AT TIME ZONE 'Asia/Jakarta')::date`)
    } else if (filter?.status) {
      params.push(filter.status)
      conditions.push(`dcc.status = $${idx++}`)
    }

    if (filter?.date_from) {
      params.push(filter.date_from)
      conditions.push(`dcc.closing_date >= $${idx++}::date`)
    }
    if (filter?.date_to) {
      params.push(filter.date_to)
      conditions.push(`dcc.closing_date <= $${idx++}::date`)
    }

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(pic.full_name ILIKE $${idx} OR dcc.opname_number ILIKE $${idx})`)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where}
         ORDER BY dcc.closing_date DESC, dcc.created_at DESC
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
  ): Promise<DailyClosingCountDetail | null> {
    // Fetch header with relations
    const { rows: headerRows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE dcc.id = $1 AND dcc.branch_id = ANY($2::uuid[]) AND dcc.is_deleted = false`,
      [id, branchIds],
    )
    if (headerRows.length === 0) return null

    const header = headerRows[0] as DailyClosingCountWithRelations

    // Fetch lines
    const { rows: lines } = await pool.query(
      `SELECT * FROM daily_closing_count_lines
       WHERE closing_id = $1
       ORDER BY sort_order, product_name`,
      [id],
    )

    // Calculate summary
    const typedLines = lines as DailyClosingCountLine[]
    const summary: OpnameSummary = {
      total_expected_cost: typedLines.reduce((sum, l) => sum + (l.expected_qty * l.cost_per_unit), 0),
      total_actual_cost: typedLines.reduce((sum, l) => sum + ((l.actual_qty ?? 0) * l.cost_per_unit), 0),
      total_variance_cost: typedLines.reduce((sum, l) => sum + Math.abs(l.variance_cost ?? 0), 0),
      completion_pct: typedLines.length > 0
        ? Math.round((typedLines.filter(l => l.actual_qty !== null).length / typedLines.length) * 100)
        : 0,
      line_count: typedLines.length,
      completed_count: typedLines.filter(l => l.actual_qty !== null).length,
      flagged_line_count: typedLines.filter(l => l.has_warning).length,
    }

    return {
      ...header,
      lines: typedLines,
      summary,
    }
  }

  async findByBranchAndDate(
    branchId: string,
    date: string,
  ): Promise<DailyClosingCount | null> {
    const { rows } = await pool.query(
      `SELECT * FROM daily_closing_counts
       WHERE branch_id = $1 AND closing_date = $2::date AND is_deleted = false`,
      [branchId, date],
    )
    return rows[0] ?? null
  }

  /**
   * Check if a session already exists for this branch + date + position combination.
   */
  async findByBranchDateAndPosition(
    branchId: string,
    date: string,
    positionId: string,
  ): Promise<DailyClosingCount | null> {
    const { rows } = await pool.query(
      `SELECT * FROM daily_closing_counts
       WHERE branch_id = $1 AND closing_date = $2::date AND position_id = $3 AND is_deleted = false`,
      [branchId, date, positionId],
    )
    return rows[0] ?? null
  }

  /**
   * Get all product IDs that belong to WIP items accessible by a given position.
   * Returns both material (ingredient) product_ids and output_product_ids.
   */
  async getProductIdsByPosition(positionId: string, companyId: string): Promise<Set<string>> {
    const { rows } = await pool.query(
      `SELECT DISTINCT product_id FROM (
        -- Materials/ingredients of WIPs accessible by this position
        SELECT wi.product_id
        FROM wip_position_access wpa
        JOIN wip_items w ON w.id = wpa.wip_id AND w.is_deleted = false AND w.is_active = true AND w.company_id = $2
        JOIN wip_ingredients wi ON wi.wip_id = w.id
        WHERE wpa.position_id = $1

        UNION

        -- Output products of WIPs accessible by this position
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
   * Get position by ID for access check.
   */
  async findPositionById(positionId: string): Promise<{ can_access_all_wip: boolean } | null> {
    const { rows } = await pool.query(
      `SELECT can_access_all_wip FROM positions WHERE id = $1 AND is_deleted = false`,
      [positionId],
    )
    return rows[0] ?? null
  }

  /**
   * Get position details for a list of position IDs.
   * Returns all active, non-deleted positions (no WIP assignment check).
   */
  async getPositionDetails(positionIds: string[]): Promise<{ id: string; position_code: string; position_name: string; department_name: string }[]> {
    if (positionIds.length === 0) return []
    const { rows } = await pool.query(
      `SELECT DISTINCT p.id, p.position_code, p.position_name, d.department_name
       FROM positions p
       JOIN departments d ON d.id = p.department_id
       WHERE p.id = ANY($1::uuid[])
         AND p.is_deleted = false
         AND p.is_active = true
       ORDER BY p.position_name`,
      [positionIds],
    )
    return rows
  }

  async hasConfirmedSession(branchId: string, date: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM daily_closing_counts
         WHERE branch_id = $1
           AND closing_date = $2::date
           AND status IN ('CONFIRMED', 'FLAGGED')
           AND is_deleted = false
       ) AS has_confirmed`,
      [branchId, date],
    )
    return Boolean(rows[0]?.has_confirmed)
  }

  async generateOpnameNumber(client: PoolClient, companyId: string, branchCode: string, closingDate: string): Promise<string> {
    const dateStr = closingDate.replace(/-/g, '')
    const prefix = `OPN-${branchCode}-${dateStr}`

    // Advisory lock to prevent race condition
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [prefix])

    const { rows } = await client.query(
      `SELECT opname_number FROM daily_closing_counts
       WHERE company_id = $1 AND opname_number LIKE $2
       ORDER BY opname_number DESC LIMIT 1 FOR UPDATE`,
      [companyId, `${prefix}-%`]
    )
    const lastSeq = rows.length > 0 ? parseInt(rows[0].opname_number?.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  async insertHeader(
    client: PoolClient,
    data: {
      company_id: string
      branch_id: string
      warehouse_id: string
      opname_number: string
      closing_date: string
      pic_user_id: string
      position_id: string | null
      notes?: string | null
      created_by?: string | null
    },
  ): Promise<DailyClosingCount> {
    const { rows } = await client.query(
      `INSERT INTO daily_closing_counts
         (company_id, branch_id, warehouse_id, opname_number, closing_date, pic_user_id, position_id, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $9)
       RETURNING *`,
      [
        data.company_id,
        data.branch_id,
        data.warehouse_id,
        data.opname_number,
        data.closing_date,
        data.pic_user_id,
        data.position_id,
        data.notes ?? null,
        data.created_by ?? null,
      ],
    )
    return rows[0]
  }

  async updateHeaderStatus(
    client: PoolClient,
    id: string,
    data: {
      status?: string
      total_variance_cost?: number
      total_expected_cost?: number
      total_actual_cost?: number
      line_count?: number
      completed_count?: number
      confirmed_by?: string | null
      confirmed_at?: string | null
      resolved_by?: string | null
      resolved_at?: string | null
      resolution_note?: string | null
      updated_by?: string | null
    },
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.status !== undefined) { params.push(data.status); setClauses.push(`status = $${idx++}`) }
    if (data.total_variance_cost !== undefined) { params.push(data.total_variance_cost); setClauses.push(`total_variance_cost = $${idx++}`) }
    if (data.total_expected_cost !== undefined) { params.push(data.total_expected_cost); setClauses.push(`total_expected_cost = $${idx++}`) }
    if (data.total_actual_cost !== undefined) { params.push(data.total_actual_cost); setClauses.push(`total_actual_cost = $${idx++}`) }
    if (data.line_count !== undefined) { params.push(data.line_count); setClauses.push(`line_count = $${idx++}`) }
    if (data.completed_count !== undefined) { params.push(data.completed_count); setClauses.push(`completed_count = $${idx++}`) }
    if (data.confirmed_by !== undefined) { params.push(data.confirmed_by); setClauses.push(`confirmed_by = $${idx++}`) }
    if (data.confirmed_at !== undefined) { params.push(data.confirmed_at); setClauses.push(`confirmed_at = $${idx++}`) }
    if (data.resolved_by !== undefined) { params.push(data.resolved_by); setClauses.push(`resolved_by = $${idx++}`) }
    if (data.resolved_at !== undefined) { params.push(data.resolved_at); setClauses.push(`resolved_at = $${idx++}`) }
    if (data.resolution_note !== undefined) { params.push(data.resolution_note); setClauses.push(`resolution_note = $${idx++}`) }
    if (data.updated_by !== undefined) { params.push(data.updated_by); setClauses.push(`updated_by = $${idx++}`) }

    params.push(id)
    await client.query(
      `UPDATE daily_closing_counts SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    )
  }

  async softDelete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE daily_closing_counts
       SET is_deleted = true, deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND status = 'DRAFT' AND is_deleted = false`,
      [userId, id],
    )
    return (rowCount ?? 0) > 0
  }

  // ─── LINE METHODS ──────────────────────────────────────────────────────────

  /**
   * Bulk insert opname lines within a transaction.
   * Accepts a PoolClient for transaction support.
   */
  async insertLines(client: PoolClient, closingId: string, lines: InsertLineData[]): Promise<void> {
    if (lines.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      valueRows.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15}, $${idx + 16})`,
      )
      params.push(
        closingId,
        l.product_id,
        l.product_code,
        l.product_name,
        l.uom,
        l.system_qty,
        l.expected_qty,
        l.cost_per_unit,
        l.main_balance,
        l.dpo_in_qty,
        l.theoretical_out,
        l.is_high_risk,
        l.requires_photo,
        l.has_recipe,
        l.has_warning,
        l.warning_message,
        l.sort_order,
      )
      idx += 17
    }

    await client.query(
      `INSERT INTO daily_closing_count_lines
        (closing_id, product_id, product_code, product_name, uom,
         system_qty, expected_qty, cost_per_unit, main_balance, dpo_in_qty,
         theoretical_out, is_high_risk, requires_photo, has_recipe, has_warning,
         warning_message, sort_order)
       VALUES ${valueRows.join(', ')}`,
      params,
    )
  }

  /**
   * Update actual_qty for a line and recalculate variance fields.
   * variance_qty = actual_qty - expected_qty
   * variance_cost = variance_qty × cost_per_unit
   * variance_pct = (variance_qty / expected_qty) × 100 when expected_qty > 0
   *   - null when expected_qty = 0 and actual_qty > 0
   *   - 0 when expected_qty = 0 and actual_qty = 0
   */
  async updateLineActual(
    id: string,
    closingId: string,
    actual_qty: number,
  ): Promise<DailyClosingCountLine> {
    const { rows } = await pool.query<DailyClosingCountLine>(
      `UPDATE daily_closing_count_lines
       SET actual_qty = $1,
           variance_qty = $1 - expected_qty,
           variance_cost = ($1 - expected_qty) * cost_per_unit,
           variance_pct = CASE
             WHEN expected_qty > 0 THEN ROUND((($1 - expected_qty) / expected_qty) * 100, 2)
             WHEN expected_qty = 0 AND $1 > 0 THEN NULL
             ELSE 0
           END,
           updated_at = now()
       WHERE id = $2 AND closing_id = $3
       RETURNING *`,
      [actual_qty, id, closingId],
    )
    return rows[0]
  }

  /**
   * Store photo URL for an opname line.
   */
  async updateLinePhoto(id: string, closingId: string, photo_url: string): Promise<void> {
    await pool.query(
      `UPDATE daily_closing_count_lines
       SET photo_url = $1, updated_at = now()
       WHERE id = $2 AND closing_id = $3`,
      [photo_url, id, closingId],
    )
  }

  /**
   * Store movement IDs and final variance fields on a line after confirmation.
   * Called within a transaction during the confirm flow.
   */
  async updateLineMovements(
    client: PoolClient,
    id: string,
    data: {
      out_movement_id?: string | null
      in_movement_id?: string | null
      variance_qty: number
      variance_pct: number | null
      variance_cost: number
    },
  ): Promise<void> {
    await client.query(
      `UPDATE daily_closing_count_lines
       SET out_movement_id = $1,
           in_movement_id = $2,
           variance_qty = $3,
           variance_pct = $4,
           variance_cost = $5,
           updated_at = now()
       WHERE id = $6`,
      [
        data.out_movement_id ?? null,
        data.in_movement_id ?? null,
        data.variance_qty,
        data.variance_pct,
        data.variance_cost,
        id,
      ],
    )
  }

  /**
   * Get a single opname line by ID and closing_id.
   */
  async getLineById(id: string, closingId: string): Promise<DailyClosingCountLine | null> {
    const { rows } = await pool.query<DailyClosingCountLine>(
      `SELECT * FROM daily_closing_count_lines
       WHERE id = $1 AND closing_id = $2`,
      [id, closingId],
    )
    return rows[0] ?? null
  }

  /**
   * Count lines with actual_qty IS NOT NULL for a closing session.
   * Used to update completed_count on the header after line updates.
   */
  async countCompletedLines(closingId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM daily_closing_count_lines
       WHERE closing_id = $1 AND actual_qty IS NOT NULL`,
      [closingId],
    )
    return rows[0]?.count ?? 0
  }

  /**
   * Batch fetch multiple lines by IDs within a closing session.
   * Used by bulkUpdateLines to avoid N sequential getLineById calls.
   */
  async getLinesByIds(lineIds: string[], closingId: string): Promise<DailyClosingCountLine[]> {
    if (lineIds.length === 0) return []
    const { rows } = await pool.query<DailyClosingCountLine>(
      `SELECT * FROM daily_closing_count_lines
       WHERE id = ANY($1::uuid[]) AND closing_id = $2`,
      [lineIds, closingId],
    )
    return rows
  }

  /**
   * Get all lines for a closing session within a transaction.
   * Used during the confirm flow to read lines with transactional consistency.
   */
  async getLinesByClosingId(client: PoolClient, closingId: string): Promise<DailyClosingCountLine[]> {
    const { rows } = await client.query<DailyClosingCountLine>(
      `SELECT * FROM daily_closing_count_lines
       WHERE closing_id = $1
       ORDER BY sort_order, product_name`,
      [closingId],
    )
    return rows
  }

  // ─── EXPECTED BALANCE HELPERS ───────────────────────────────────────────────

  /**
   * Get all stock balances for a READY warehouse.
   * Returns Map<productId, { qty, avg_cost }>
   */
  async getReadyBalances(warehouseId: string): Promise<Map<string, { qty: number; avg_cost: number }>> {
    const { rows } = await pool.query(
      `SELECT product_id, qty, avg_cost
       FROM stock_balances
       WHERE warehouse_id = $1`,
      [warehouseId],
    )

    const map = new Map<string, { qty: number; avg_cost: number }>()
    for (const row of rows) {
      map.set(row.product_id, {
        qty: Number(row.qty),
        avg_cost: Number(row.avg_cost),
      })
    }
    return map
  }

  /**
   * Sum today's DPO IN_TRANSFER movements to the READY warehouse for display purposes.
   * Returns Map<productId, totalQty>
   */
  async getDpoTransfersForDate(warehouseId: string, date: string): Promise<Map<string, number>> {
    const { rows } = await pool.query(
      `SELECT product_id, SUM(qty)::numeric AS total_qty
       FROM stock_movements
       WHERE warehouse_id = $1
         AND movement_type = 'IN_TRANSFER'
         AND reference_type = 'transfer_order'
         AND movement_date = $2::date
       GROUP BY product_id`,
      [warehouseId, date],
    )

    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.product_id, Number(row.total_qty))
    }
    return map
  }

  /**
   * Get all stock balances for the MAIN warehouse (snapshot for display).
   * Returns Map<productId, qty>
   */
  async getMainBalances(mainWarehouseId: string): Promise<Map<string, number>> {
    const { rows } = await pool.query(
      `SELECT product_id, qty
       FROM stock_balances
       WHERE warehouse_id = $1`,
      [mainWarehouseId],
    )

    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.product_id, Number(row.qty))
    }
    return map
  }

  /**
   * Get all products that have a positive balance in the given warehouse,
   * joining with products table for name/code/uom/risk_category.
   */
  async getProductsWithStock(warehouseId: string): Promise<ProductStockInfo[]> {
    const { rows } = await pool.query(
      `SELECT
        p.id AS product_id,
        p.product_code,
        p.product_name,
        COALESCE(mu.unit_name, '') AS uom,
        COALESCE(p.risk_category, 'LOW') AS risk_category,
        sb.qty,
        sb.avg_cost
       FROM stock_balances sb
       JOIN products p ON p.id = sb.product_id
       LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE sb.warehouse_id = $1
         AND sb.qty > 0
         AND p.is_deleted = false`,
      [warehouseId],
    )

    return rows.map((row) => ({
      product_id: row.product_id,
      product_code: row.product_code,
      product_name: row.product_name,
      uom: row.uom,
      risk_category: row.risk_category,
      qty: Number(row.qty),
      avg_cost: Number(row.avg_cost),
    }))
  }

  /**
   * Fallback cost lookup: get cost_per_unit from the most recent stock_movement
   * for a given product in the warehouse. Returns 0 if no movement exists.
   */
  async getLastMovementCost(warehouseId: string, productId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT cost_per_unit
       FROM stock_movements
       WHERE warehouse_id = $1
         AND product_id = $2
       ORDER BY movement_date DESC, created_at DESC
       LIMIT 1`,
      [warehouseId, productId],
    )

    return rows.length > 0 ? Number(rows[0].cost_per_unit) : 0
  }

  // ─── WAREHOUSE RESOLUTION ────────────────────────────────────────────────────

  /**
   * Resolve a warehouse by branch and type (e.g., 'READY' or 'MAIN').
   * Returns the warehouse ID and name, or null if not found.
   */
  async findWarehouseByBranchAndType(
    branchId: string,
    warehouseType: string,
  ): Promise<{ id: string; warehouse_name: string } | null> {
    const { rows } = await pool.query(
      `SELECT id, warehouse_name FROM warehouses
       WHERE branch_id = $1 AND warehouse_type = $2 AND deleted_at IS NULL AND is_active = true
       LIMIT 1`,
      [branchId, warehouseType],
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

  // ─── CONFIG ─────────────────────────────────────────────────────────────────

  async findConfig(branchId: string): Promise<BranchOpnameConfig | null> {
    const { rows } = await pool.query(
      `SELECT * FROM branch_opname_config WHERE branch_id = $1`,
      [branchId]
    )
    return rows[0] ?? null
  }

  async upsertConfig(
    branchId: string,
    companyId: string,
    data: UpsertOpnameConfigDto,
    userId: string
  ): Promise<BranchOpnameConfig> {
    const { rows } = await pool.query(
      `INSERT INTO branch_opname_config (
        company_id, branch_id, variance_threshold_pct, closing_time, grace_period_minutes, updated_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (branch_id) DO UPDATE SET
        variance_threshold_pct = COALESCE($3, branch_opname_config.variance_threshold_pct),
        closing_time = COALESCE($4, branch_opname_config.closing_time),
        grace_period_minutes = COALESCE($5, branch_opname_config.grace_period_minutes),
        updated_by = $6,
        updated_at = now()
      RETURNING *`,
      [
        companyId,
        branchId,
        data.variance_threshold_pct ?? 15,
        data.closing_time ?? '23:59',
        data.grace_period_minutes ?? 15,
        userId,
      ]
    )
    return rows[0]
  }

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────

  async getDashboardData(branchIds: string[], today: string): Promise<OpnameDashboardItem[]> {
    if (!branchIds.length) return []

    const { rows } = await pool.query(
      `SELECT
        b.id AS branch_id,
        b.branch_name,
        b.branch_code,
        today_session.id AS today_session_id,
        today_session.status AS today_status,
        today_session.total_variance_cost AS today_variance_cost,
        today_session.line_count AS today_line_count,
        today_session.completed_count AS today_completed_count,
        prev_draft.id AS prev_draft_id,
        prev_draft.closing_date AS prev_draft_date
      FROM branches b
      LEFT JOIN daily_closing_counts today_session
        ON today_session.branch_id = b.id
        AND today_session.closing_date = $2::date
        AND today_session.is_deleted = false
      LEFT JOIN LATERAL (
        SELECT dcc.id, dcc.closing_date
        FROM daily_closing_counts dcc
        WHERE dcc.branch_id = b.id
          AND dcc.closing_date < $2::date
          AND dcc.status = 'DRAFT'
          AND dcc.is_deleted = false
        ORDER BY dcc.closing_date DESC
        LIMIT 1
      ) prev_draft ON true
      WHERE b.id = ANY($1::uuid[])
        AND b.status = 'active'
      ORDER BY b.branch_name`,
      [branchIds, today]
    )

    return rows.map((row) => {
      let status: OpnameDashboardItem['status']
      let sessionId: string | null = null
      let totalVarianceCost: number | null = null
      let completionPct: number | null = null
      let closingDate: string | null = null

      if (row.today_session_id) {
        // Session exists for today
        status = row.today_status as OpnameDashboardItem['status']
        sessionId = row.today_session_id
        totalVarianceCost = Number(row.today_variance_cost)
        closingDate = today
        if (row.today_line_count > 0) {
          completionPct = Math.round((row.today_completed_count / row.today_line_count) * 100)
        }
      } else if (row.prev_draft_id) {
        // No session today, but there's a DRAFT from a previous day → MISSED
        status = 'MISSED'
        closingDate = row.prev_draft_date
      } else {
        // No session today and no stale drafts
        status = 'NOT_STARTED'
      }

      return {
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        branch_code: row.branch_code,
        status,
        session_id: sessionId,
        total_variance_cost: totalVarianceCost,
        completion_pct: completionPct,
        closing_date: closingDate,
      }
    })
  }

  // ─── VARIANCE REPORT ────────────────────────────────────────────────────────

  async getVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<VarianceReportItem[]> {
    if (!branchIds.length) return []

    const conditions: string[] = [
      'dcc.branch_id = ANY($1::uuid[])',
      'dcc.is_deleted = false',
      "dcc.status IN ('CONFIRMED', 'FLAGGED')",
      'dccl.actual_qty IS NOT NULL',
      'dcc.closing_date >= $2::date',
      'dcc.closing_date <= $3::date',
    ]
    const params: unknown[] = [branchIds, filter.date_from, filter.date_to]
    let idx = 4

    if (filter.branch_id) {
      conditions.push(`dcc.branch_id = $${idx}`)
      params.push(filter.branch_id)
      idx++
    }

    if (filter.product_id) {
      conditions.push(`dccl.product_id = $${idx}`)
      params.push(filter.product_id)
      idx++
    }

    if (filter.risk_category) {
      conditions.push(`p.risk_category = $${idx}`)
      params.push(filter.risk_category)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    // Determine grouping for trend data
    let groupByClause: string
    let selectExtra = ''

    if (filter.group_by === 'week') {
      selectExtra = `, DATE_TRUNC('week', dcc.closing_date)::date AS period`
      groupByClause = `GROUP BY dccl.product_id, p.product_code, p.product_name, dccl.uom, COALESCE(p.risk_category, 'LOW'), DATE_TRUNC('week', dcc.closing_date)`
    } else if (filter.group_by === 'month') {
      selectExtra = `, DATE_TRUNC('month', dcc.closing_date)::date AS period`
      groupByClause = `GROUP BY dccl.product_id, p.product_code, p.product_name, dccl.uom, COALESCE(p.risk_category, 'LOW'), DATE_TRUNC('month', dcc.closing_date)`
    } else {
      // Default: group by product only (aggregate across all days)
      selectExtra = ''
      groupByClause = `GROUP BY dccl.product_id, p.product_code, p.product_name, dccl.uom, COALESCE(p.risk_category, 'LOW')`
    }

    const sql = `
      SELECT
        dccl.product_id,
        p.product_code,
        p.product_name,
        dccl.uom,
        COALESCE(p.risk_category, 'LOW') AS risk_category,
        SUM(dccl.variance_qty)::numeric AS total_variance_qty,
        SUM(ABS(dccl.variance_cost))::numeric AS total_variance_cost,
        ROUND(AVG(dccl.variance_pct) FILTER (WHERE dccl.variance_pct IS NOT NULL), 2) AS avg_variance_pct,
        COUNT(DISTINCT dcc.id)::int AS session_count,
        COUNT(DISTINCT dcc.id) FILTER (WHERE dcc.status = 'FLAGGED')::int AS flagged_count
        ${selectExtra}
      FROM daily_closing_count_lines dccl
      JOIN daily_closing_counts dcc ON dcc.id = dccl.closing_id
      JOIN products p ON p.id = dccl.product_id
      ${where}
      ${groupByClause}
      ORDER BY total_variance_cost DESC`

    const { rows } = await pool.query(sql, params)

    return rows.map((row) => ({
      product_id: row.product_id,
      product_code: row.product_code,
      product_name: row.product_name,
      uom: row.uom,
      risk_category: row.risk_category,
      total_variance_qty: Number(row.total_variance_qty ?? 0),
      total_variance_cost: Number(row.total_variance_cost ?? 0),
      avg_variance_pct: Number(row.avg_variance_pct ?? 0),
      session_count: row.session_count,
      flagged_count: row.flagged_count,
    }))
  }

  // ─── CONVERSION MOVEMENTS ─────────────────────────────────────────────────

  /**
   * Get net conversion movements for a given date and warehouse.
   * Returns Map<productId, netConversion> where netConversion = IN_CONVERSION - OUT_CONVERSION.
   */
  async getConversionMovementsForDate(
    warehouseId: string,
    date: string,
    productIds: string[]
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map()

    const { rows } = await pool.query(
      `SELECT product_id,
        SUM(CASE WHEN movement_type = 'IN_CONVERSION' THEN qty ELSE 0 END) -
        SUM(CASE WHEN movement_type = 'OUT_CONVERSION' THEN qty ELSE 0 END) AS net_conversion
      FROM stock_movements
      WHERE warehouse_id = $1
        AND movement_date = $2::date
        AND movement_type IN ('OUT_CONVERSION', 'IN_CONVERSION')
        AND product_id = ANY($3::uuid[])
      GROUP BY product_id`,
      [warehouseId, date, productIds]
    )

    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.product_id, Number(row.net_conversion))
    }
    return map
  }

  // ─── VARIANCE REPORT EXPORT (LINE-LEVEL) ────────────────────────────────────

  async getVarianceReportExportData(branchIds: string[], filter: VarianceReportFilter): Promise<VarianceReportExportRow[]> {
    if (!branchIds.length) return []

    const conditions: string[] = [
      'dcc.branch_id = ANY($1::uuid[])',
      'dcc.is_deleted = false',
      "dcc.status IN ('CONFIRMED', 'FLAGGED')",
      'dccl.actual_qty IS NOT NULL',
      'dcc.closing_date >= $2::date',
      'dcc.closing_date <= $3::date',
    ]
    const params: unknown[] = [branchIds, filter.date_from, filter.date_to]
    let idx = 4

    if (filter.branch_id) {
      conditions.push(`dcc.branch_id = $${idx}`)
      params.push(filter.branch_id)
      idx++
    }

    if (filter.product_id) {
      conditions.push(`dccl.product_id = $${idx}`)
      params.push(filter.product_id)
      idx++
    }

    if (filter.risk_category) {
      conditions.push(`p.risk_category = $${idx}`)
      params.push(filter.risk_category)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const sql = `
      SELECT
        dcc.closing_date,
        b.branch_name,
        dccl.product_code,
        dccl.product_name,
        dccl.expected_qty,
        dccl.actual_qty,
        dccl.variance_qty,
        dccl.variance_pct,
        dccl.variance_cost
      FROM daily_closing_count_lines dccl
      JOIN daily_closing_counts dcc ON dcc.id = dccl.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      JOIN products p ON p.id = dccl.product_id
      ${where}
      ORDER BY dcc.closing_date DESC, b.branch_name, dccl.product_name`

    const { rows } = await pool.query(sql, params)

    return rows.map((row) => ({
      closing_date: row.closing_date,
      branch_name: row.branch_name,
      product_code: row.product_code,
      product_name: row.product_name,
      expected_qty: Number(row.expected_qty ?? 0),
      actual_qty: Number(row.actual_qty ?? 0),
      variance_qty: Number(row.variance_qty ?? 0),
      variance_pct: row.variance_pct !== null ? Number(row.variance_pct) : null,
      variance_cost: Number(row.variance_cost ?? 0),
    }))
  }
}

export const dailyStockOpnameRepository = new DailyStockOpnameRepository()
