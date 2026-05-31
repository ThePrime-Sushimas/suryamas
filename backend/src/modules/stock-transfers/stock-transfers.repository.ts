import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  StockTransfer, StockTransferWithRelations, StockTransferDetail,
  StockTransferLineWithRelations, CreateStockTransferDto, TransferType
} from './stock-transfers.types'

const HEADER_SELECT = `
  st.*,
  sw.warehouse_name AS source_warehouse_name,
  tw.warehouse_name AS target_warehouse_name,
  sb.branch_name AS source_branch_name,
  tb.branch_name AS target_branch_name,
  emp.full_name AS confirmed_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count
`
const HEADER_FROM = `
  FROM stock_transfers st
  JOIN warehouses sw ON sw.id = st.source_warehouse_id
  JOIN warehouses tw ON tw.id = st.target_warehouse_id
  JOIN branches sb ON sb.id = st.source_branch_id
  JOIN branches tb ON tb.id = st.target_branch_id
  LEFT JOIN employees emp ON emp.user_id = st.confirmed_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count
    FROM stock_transfer_lines
    WHERE stock_transfer_id = st.id
  ) lines_agg ON true
`

const LINE_SELECT = `
  stl.*,
  p.product_code, p.product_name,
  mu.unit_name AS base_unit_name
`
const LINE_FROM = `
  FROM stock_transfer_lines stl
  JOIN products p ON p.id = stl.product_id
  LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

export class StockTransfersRepository {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async findAll(
    branchIds: string[],
    pagination: { limit: number; offset: number },
    filter?: {
      transfer_type?: string
      status?: string
      source_branch_id?: string
      target_branch_id?: string
      date_from?: string
      date_to?: string
      search?: string
    }
  ): Promise<{ data: StockTransferWithRelations[]; total: number }> {
    // User can see transfers where source OR target branch is accessible
    const conditions = [
      '(st.source_branch_id = ANY($1::uuid[]) OR st.target_branch_id = ANY($1::uuid[]))',
      'st.deleted_at IS NULL',
    ]
    const params: unknown[] = [branchIds]
    let idx = 2

    if (filter?.transfer_type) { params.push(filter.transfer_type); conditions.push(`st.transfer_type = $${idx++}`) }
    if (filter?.status) { params.push(filter.status); conditions.push(`st.status = $${idx++}`) }
    if (filter?.source_branch_id) { params.push(filter.source_branch_id); conditions.push(`(st.source_branch_id = $${idx} OR st.target_branch_id = $${idx})`); idx++ }
    if (filter?.target_branch_id) { params.push(filter.target_branch_id); conditions.push(`st.target_branch_id = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`st.transfer_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`st.transfer_date <= $${idx++}::date`) }
    if (filter?.search) { params.push(`%${filter.search}%`); conditions.push(`st.transfer_number ILIKE $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY st.transfer_date DESC, st.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM stock_transfers st ${where}`,
        params
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────────

  async findById(id: string, branchIds: string[]): Promise<StockTransferDetail | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE st.id = $1 AND st.deleted_at IS NULL
         AND (st.source_branch_id = ANY($2::uuid[]) OR st.target_branch_id = ANY($2::uuid[]))`,
      [id, branchIds]
    )
    if (rows.length === 0) return null

    const header = rows[0] as StockTransferWithRelations
    const { rows: lines } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE stl.stock_transfer_id = $1 ORDER BY stl.sort_order, stl.created_at`,
      [id]
    )

    return { ...header, lines } as StockTransferDetail
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(
    client: PoolClient,
    companyId: string,
    dto: CreateStockTransferDto,
    transferNumber: string,
    sourceBranchId: string,
    targetBranchId: string,
  ): Promise<{ id: string }> {
    const { rows } = await client.query(
      `INSERT INTO stock_transfers
        (company_id, transfer_number, transfer_type, source_warehouse_id, target_warehouse_id,
         source_branch_id, target_branch_id, transfer_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        companyId, transferNumber, dto.transfer_type ?? 'TRANSFER',
        dto.source_warehouse_id, dto.target_warehouse_id,
        sourceBranchId, targetBranchId,
        dto.transfer_date, dto.notes ?? null, dto.created_by ?? null,
      ]
    )
    return rows[0]
  }

  async createLines(
    client: PoolClient,
    transferId: string,
    lines: { product_id: string; qty: number; notes?: string | null }[]
  ): Promise<void> {
    if (lines.length === 0) return

    // Bulk insert with multi-row VALUES
    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      values.push(transferId, line.product_id, line.qty, line.notes ?? null, i)
    }

    await client.query(
      `INSERT INTO stock_transfer_lines (stock_transfer_id, product_id, qty, notes, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  // ─── NUMBER GENERATION ────────────────────────────────────────────────────────

  async getBranchCode(client: PoolClient, branchId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT branch_code FROM branches WHERE id = $1',
      [branchId]
    )
    return rows[0]?.branch_code ?? null
  }

  async generateTransferNumber(
    client: PoolClient,
    companyId: string,
    branchCode: string,
    transferDate: string,
    transferType: TransferType
  ): Promise<string> {
    const prefix = transferType === 'LOAN' ? 'BL' : 'ST'
    const dateStr = transferDate.replace(/-/g, '')
    const pattern = `${prefix}-${branchCode}-${dateStr}-%`

    const { rows } = await client.query(
      `SELECT transfer_number FROM stock_transfers
       WHERE company_id = $1 AND transfer_number LIKE $2 AND deleted_at IS NULL
       ORDER BY transfer_number DESC LIMIT 1`,
      [companyId, pattern]
    )

    let seq = 1
    if (rows.length > 0) {
      const lastSeq = parseInt(rows[0].transfer_number.split('-').pop() || '0')
      seq = lastSeq + 1
    }

    return `${prefix}-${branchCode}-${dateStr}-${String(seq).padStart(3, '0')}`
  }

  // ─── WAREHOUSE LOOKUP ─────────────────────────────────────────────────────────

  async getWarehouseBranchId(client: PoolClient, warehouseId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT branch_id FROM warehouses WHERE id = $1 AND deleted_at IS NULL',
      [warehouseId]
    )
    return rows[0]?.branch_id ?? null
  }

  async getWarehouseCompanyId(warehouseId: string): Promise<string | null> {
    const { rows } = await pool.query(
      'SELECT company_id FROM warehouses WHERE id = $1 AND deleted_at IS NULL',
      [warehouseId]
    )
    return rows[0]?.company_id ?? null
  }

  // ─── CONFIRM ──────────────────────────────────────────────────────────────────

  /**
   * Lock the transfer header row (FOR UPDATE) and return detail with lines.
   * Must be called inside a transaction to prevent race conditions.
   */
  async lockAndFindById(client: PoolClient, id: string, branchIds: string[]): Promise<StockTransferDetail | null> {
    // Lock header row first
    const { rows: headerRows } = await client.query(
      `SELECT st.*
       FROM stock_transfers st
       WHERE st.id = $1 AND st.deleted_at IS NULL
         AND (st.source_branch_id = ANY($2::uuid[]) OR st.target_branch_id = ANY($2::uuid[]))
       FOR UPDATE`,
      [id, branchIds]
    )
    if (headerRows.length === 0) return null

    // Fetch full detail (joins) — header is already locked so status is stable
    const { rows } = await client.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE st.id = $1 AND st.deleted_at IS NULL`,
      [id]
    )
    if (rows.length === 0) return null

    const header = rows[0] as StockTransferWithRelations
    const { rows: lines } = await client.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE stl.stock_transfer_id = $1 ORDER BY stl.sort_order, stl.created_at`,
      [id]
    )

    return { ...header, lines } as StockTransferDetail
  }

  async updateMovementRefs(
    client: PoolClient,
    lineId: string,
    outMovementId: string,
    inMovementId: string
  ): Promise<void> {
    await client.query(
      `UPDATE stock_transfer_lines
       SET out_movement_id = $2, in_movement_id = $3, cost_per_unit = (
         SELECT cost_per_unit FROM stock_movements WHERE id = $2
       )
       WHERE id = $1`,
      [lineId, outMovementId, inMovementId]
    )
  }

  async confirmTransfer(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE stock_transfers
       SET status = 'CONFIRMED', confirmed_at = now(), confirmed_by = $2, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId]
    )
  }

  // ─── RETURN (LOAN) ────────────────────────────────────────────────────────────

  async updateReturnMovementRefs(
    client: PoolClient,
    lineId: string,
    returnOutMovementId: string,
    returnInMovementId: string
  ): Promise<void> {
    await client.query(
      `UPDATE stock_transfer_lines
       SET return_out_movement_id = $2, return_in_movement_id = $3
       WHERE id = $1`,
      [lineId, returnOutMovementId, returnInMovementId]
    )
  }

  async returnLoan(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE stock_transfers
       SET status = 'RETURNED', returned_at = now(), returned_by = $2, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId]
    )
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancelTransfer(client: PoolClient, id: string, userId: string, reason?: string): Promise<void> {
    await client.query(
      `UPDATE stock_transfers
       SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3,
           updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId, reason ?? null]
    )
  }

  /** Direct cancel without requiring a transaction (single UPDATE) */
  async cancelTransferDirect(id: string, userId: string, reason?: string): Promise<void> {
    await pool.query(
      `UPDATE stock_transfers
       SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3,
           updated_at = now(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId, reason ?? null]
    )
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────────

  async softDelete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE stock_transfers SET deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId]
    )
    return (rowCount ?? 0) > 0
  }

  // ─── LINES (for confirm/return) ──────────────────────────────────────────────

  async getLines(transferId: string): Promise<StockTransferLineWithRelations[]> {
    const { rows } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE stl.stock_transfer_id = $1 ORDER BY stl.sort_order`,
      [transferId]
    )
    return rows
  }
}

export const stockTransfersRepository = new StockTransfersRepository()
