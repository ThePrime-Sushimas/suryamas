import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  StockAdjustmentWithRelations, StockAdjustmentDetail,
  StockAdjustmentLineWithRelations, StockAdjustmentOutputWithRelations,
  CreateStockAdjustmentDto, AdjustmentType
} from './stock-adjustments.types'

const HEADER_SELECT = `
  sa.*,
  b.branch_name,
  w.warehouse_name,
  ip.product_code AS input_product_code,
  ip.product_name AS input_product_name,
  imu.unit_name AS input_base_unit_name,
  emp.full_name AS confirmed_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  COALESCE(out_agg.output_count, 0)::int AS output_count
`
const HEADER_FROM = `
  FROM stock_adjustments sa
  JOIN branches b ON b.id = sa.branch_id
  JOIN warehouses w ON w.id = sa.warehouse_id
  LEFT JOIN products ip ON ip.id = sa.input_product_id
  LEFT JOIN product_uoms ipu ON ipu.product_id = ip.id AND ipu.is_base_unit = true AND ipu.is_deleted = false
  LEFT JOIN metric_units imu ON imu.id = ipu.metric_unit_id
  LEFT JOIN employees emp ON emp.user_id = sa.confirmed_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count FROM stock_adjustment_lines WHERE stock_adjustment_id = sa.id
  ) lines_agg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS output_count FROM stock_adjustment_outputs WHERE stock_adjustment_id = sa.id
  ) out_agg ON true
`

const LINE_SELECT = `
  sal.*,
  p.product_code, p.product_name, p.station,
  mu.unit_name AS base_unit_name
`
const LINE_FROM = `
  FROM stock_adjustment_lines sal
  JOIN products p ON p.id = sal.product_id
  LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

const OUTPUT_SELECT = `
  sao.*,
  p.product_code, p.product_name,
  mu.unit_name AS base_unit_name
`
const OUTPUT_FROM = `
  FROM stock_adjustment_outputs sao
  JOIN products p ON p.id = sao.product_id
  LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

export class StockAdjustmentsRepository {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async findAll(
    branchIds: string[],
    pagination: { limit: number; offset: number },
    filter?: {
      adjustment_type?: string; status?: string; branch_id?: string
      date_from?: string; date_to?: string; search?: string
    }
  ): Promise<{ data: StockAdjustmentWithRelations[]; total: number }> {
    const conditions = ['sa.branch_id = ANY($1::uuid[])', 'sa.deleted_at IS NULL']
    const params: unknown[] = [branchIds]
    let idx = 2

    if (filter?.adjustment_type) { params.push(filter.adjustment_type); conditions.push(`sa.adjustment_type = $${idx++}`) }
    if (filter?.status) { params.push(filter.status); conditions.push(`sa.status = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`sa.branch_id = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`sa.adjustment_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`sa.adjustment_date <= $${idx++}::date`) }
    if (filter?.search) {
      params.push(`%${filter.search}%`)
      conditions.push(`(sa.adjustment_number ILIKE $${idx} OR ip.product_name ILIKE $${idx})`)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY sa.adjustment_date DESC, sa.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM stock_adjustments sa LEFT JOIN products ip ON ip.id = sa.input_product_id ${where}`,
        params
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────────

  async findById(id: string, branchIds: string[]): Promise<StockAdjustmentDetail | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE sa.id = $1 AND sa.deleted_at IS NULL AND sa.branch_id = ANY($2::uuid[])`,
      [id, branchIds]
    )
    if (rows.length === 0) return null

    const header = rows[0] as StockAdjustmentWithRelations
    const { rows: lines } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE sal.stock_adjustment_id = $1 ORDER BY sal.sort_order`,
      [id]
    )
    const { rows: outputs } = await pool.query(
      `SELECT ${OUTPUT_SELECT} ${OUTPUT_FROM} WHERE sao.stock_adjustment_id = $1 ORDER BY sao.sort_order`,
      [id]
    )

    return { ...header, lines, outputs } as StockAdjustmentDetail
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(
    client: PoolClient,
    companyId: string,
    branchId: string,
    dto: CreateStockAdjustmentDto,
    adjustmentNumber: string,
  ): Promise<{ id: string }> {
    const { rows } = await client.query(
      `INSERT INTO stock_adjustments
        (company_id, branch_id, warehouse_id, adjustment_number, adjustment_type,
         adjustment_date, reason, notes, input_product_id, input_qty, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        companyId, branchId, dto.warehouse_id, adjustmentNumber, dto.adjustment_type,
        dto.adjustment_date, dto.reason ?? null, dto.notes ?? null,
        dto.input_product_id ?? null, dto.input_qty ?? null, dto.created_by ?? null,
      ]
    )
    return rows[0]
  }

  async createLines(
    client: PoolClient,
    adjustmentId: string,
    lines: { product_id: string; qty: number; notes?: string | null }[]
  ): Promise<void> {
    if (lines.length === 0) return
    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      values.push(adjustmentId, l.product_id, l.qty, l.notes ?? null, i)
    }
    await client.query(
      `INSERT INTO stock_adjustment_lines (stock_adjustment_id, product_id, qty, notes, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  async createOutputs(
    client: PoolClient,
    adjustmentId: string,
    outputs: { product_id: string; qty: number; notes?: string | null }[]
  ): Promise<void> {
    if (outputs.length === 0) return
    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1
    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i]
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      values.push(adjustmentId, o.product_id, o.qty, o.notes ?? null, i)
    }
    await client.query(
      `INSERT INTO stock_adjustment_outputs (stock_adjustment_id, product_id, qty, notes, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  // ─── NUMBER GENERATION ────────────────────────────────────────────────────────

  async generateAdjustmentNumber(
    client: PoolClient, companyId: string, branchCode: string,
    adjustmentDate: string, adjustmentType: AdjustmentType
  ): Promise<string> {
    const prefix = adjustmentType === 'BREAKDOWN' ? 'BD' : 'WS'
    const dateStr = adjustmentDate.replace(/-/g, '')
    const pattern = `${prefix}-${branchCode}-${dateStr}-%`

    const { rows } = await client.query(
      `SELECT adjustment_number FROM stock_adjustments
       WHERE company_id = $1 AND adjustment_number LIKE $2 AND deleted_at IS NULL
       ORDER BY adjustment_number DESC LIMIT 1`,
      [companyId, pattern]
    )
    let seq = 1
    if (rows.length > 0) {
      const lastSeq = parseInt(rows[0].adjustment_number.split('-').pop() || '0')
      seq = lastSeq + 1
    }
    return `${prefix}-${branchCode}-${dateStr}-${String(seq).padStart(3, '0')}`
  }

  async getBranchCode(client: PoolClient, branchId: string): Promise<string | null> {
    const { rows } = await client.query('SELECT branch_code FROM branches WHERE id = $1', [branchId])
    return rows[0]?.branch_code ?? null
  }

  async getWarehouseBranchId(client: PoolClient, warehouseId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT branch_id FROM warehouses WHERE id = $1 AND deleted_at IS NULL', [warehouseId]
    )
    return rows[0]?.branch_id ?? null
  }

  async getWarehouseCompanyId(warehouseId: string): Promise<string | null> {
    const { rows } = await pool.query(
      'SELECT company_id FROM warehouses WHERE id = $1 AND deleted_at IS NULL', [warehouseId]
    )
    return rows[0]?.company_id ?? null
  }

  async getWarehouseType(warehouseId: string): Promise<string | null> {
    const { rows } = await pool.query(
      'SELECT warehouse_type FROM warehouses WHERE id = $1 AND deleted_at IS NULL', [warehouseId]
    )
    return rows[0]?.warehouse_type ?? null
  }

  // ─── CONFIRM ──────────────────────────────────────────────────────────────────

  async lockAndFindById(client: PoolClient, id: string, branchIds: string[]): Promise<StockAdjustmentDetail | null> {
    const { rows } = await client.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE sa.id = $1 AND sa.deleted_at IS NULL AND sa.branch_id = ANY($2::uuid[])
       FOR UPDATE OF sa`,
      [id, branchIds]
    )
    if (rows.length === 0) return null

    const header = rows[0] as StockAdjustmentWithRelations
    const { rows: lines } = await client.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE sal.stock_adjustment_id = $1 ORDER BY sal.sort_order`,
      [id]
    )
    const { rows: outputs } = await client.query(
      `SELECT ${OUTPUT_SELECT} ${OUTPUT_FROM} WHERE sao.stock_adjustment_id = $1 ORDER BY sao.sort_order`,
      [id]
    )
    return { ...header, lines, outputs } as StockAdjustmentDetail
  }

  async updateLineMovement(client: PoolClient, lineId: string, movementId: string, costPerUnit: number): Promise<void> {
    await client.query(
      `UPDATE stock_adjustment_lines SET movement_id = $2, cost_per_unit = $3 WHERE id = $1`,
      [lineId, movementId, costPerUnit]
    )
  }

  async updateInputMovement(client: PoolClient, id: string, movementId: string, costPerUnit: number): Promise<void> {
    await client.query(
      `UPDATE stock_adjustments
       SET input_movement_id = $2, input_cost_per_unit = $3, updated_at = now()
       WHERE id = $1`,
      [id, movementId, costPerUnit]
    )
  }

  async updateOutputMovement(client: PoolClient, outputId: string, movementId: string, costPerUnit: number): Promise<void> {
    await client.query(
      `UPDATE stock_adjustment_outputs SET movement_id = $2, cost_per_unit = $3 WHERE id = $1`,
      [outputId, movementId, costPerUnit]
    )
  }

  async confirmAdjustment(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE stock_adjustments
       SET status = 'CONFIRMED', confirmed_at = now(), confirmed_by = $2, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId]
    )
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancelDirect(id: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE stock_adjustments
       SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2, updated_at = now(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId]
    )
  }

  // ─── JOURNAL ──────────────────────────────────────────────────────────────────

  async findOpenFiscalPeriod(companyId: string, date: string, client: PoolClient): Promise<{ period: string } | null> {
    const { rows } = await client.query(
      `SELECT period FROM fiscal_periods
       WHERE company_id = $1 AND is_open = true
         AND period_start <= $2::date AND period_end >= $2::date
       LIMIT 1`,
      [companyId, date],
    )
    return rows[0] ? { period: rows[0].period as string } : null
  }

  async findCoaByCode(companyId: string, accountCode: string, client: PoolClient): Promise<{ id: string } | null> {
    const { rows } = await client.query(
      `SELECT id FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 LIMIT 1`,
      [companyId, accountCode],
    )
    return rows[0] ?? null
  }

  async getNextJournalSequence(client: PoolClient, companyId: string, period: string): Promise<number> {
    const { rows } = await client.query(
      `SELECT get_next_journal_sequence($1, $2, 'INVENTORY'::journal_type_enum) AS seq`,
      [companyId, period],
    )
    return Number(rows[0].seq)
  }

  async insertJournalHeader(
    client: PoolClient,
    data: {
      companyId: string; branchId: string; journalNumber: string; sequenceNumber: number
      journalDate: string; period: string; description: string; totalAmount: number
      referenceId: string; referenceNumber: string; createdBy: string | null
    },
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO journal_headers (
         company_id, branch_id, journal_number, sequence_number,
         journal_type, journal_date, period, description,
         total_debit, total_credit, currency, exchange_rate,
         status, source_module, reference_type, reference_id, reference_number,
         is_auto, posted_at, created_by, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'INVENTORY', $5, $6, $7, $8, $8, 'IDR', 1,
         'POSTED', 'stock_adjustment', 'stock_adjustment', $9, $10,
         true, NOW(), $11, NOW(), NOW())
       RETURNING id`,
      [
        data.companyId, data.branchId, data.journalNumber, data.sequenceNumber,
        data.journalDate, data.period, data.description, data.totalAmount,
        data.referenceId, data.referenceNumber, data.createdBy,
      ],
    )
    return rows[0].id as string
  }

  async insertJournalLine(
    client: PoolClient,
    data: { journalHeaderId: string; lineNumber: number; accountId: string; description: string; debitAmount: number; creditAmount: number },
  ): Promise<void> {
    await client.query(
      `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $5, $6)`,
      [data.journalHeaderId, data.lineNumber, data.accountId, data.description, data.debitAmount, data.creditAmount],
    )
  }

  async saveJournalId(client: PoolClient, id: string, journalId: string | null): Promise<void> {
    await client.query(
      `UPDATE stock_adjustments SET journal_id = $2, updated_at = now() WHERE id = $1`,
      [id, journalId]
    )
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────────

  async softDelete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE stock_adjustments SET deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId]
    )
    return (rowCount ?? 0) > 0
  }
}

export const stockAdjustmentsRepository = new StockAdjustmentsRepository()
