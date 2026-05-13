import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  PurchaseRequest, PurchaseRequestWithRelations, PurchaseRequestLine,
  PurchaseRequestLineWithRelations, PurchaseRequestWithLines,
  CreatePurchaseRequestLineDto, PurchaseRequestStatus
} from './purchase-requests.types'

const HEADER_SELECT = `
  pr.*,
  b.branch_name, b.branch_code,
  req_emp.full_name AS requested_by_name,
  app_emp.full_name AS approved_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  COALESCE(lines_agg.total_estimated, 0)::numeric AS total_estimated,
  COALESCE(lines_agg.total_pricelist, 0)::numeric AS total_pricelist
`
const HEADER_FROM = `
  FROM purchase_requests pr
  JOIN branches b ON b.id = pr.branch_id
  LEFT JOIN employees req_emp ON req_emp.user_id = pr.requested_by
  LEFT JOIN employees app_emp ON app_emp.user_id = pr.approved_by
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS line_count,
      SUM(COALESCE(prl.estimated_price, 0) * prl.qty) AS total_estimated,
      SUM(COALESCE((
        SELECT pl.price FROM pricelists pl
        WHERE pl.product_id = prl.product_id
          AND pl.supplier_id = prl.supplier_id
          AND pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
          AND pl.valid_from <= CURRENT_DATE AND (pl.valid_to IS NULL OR pl.valid_to >= CURRENT_DATE)
        ORDER BY pl.valid_from DESC LIMIT 1
      ), prl.estimated_price, 0) * prl.qty) AS total_pricelist
    FROM purchase_request_lines prl WHERE prl.request_id = pr.id
  ) lines_agg ON true
`

const LINE_SELECT = `
  prl.*,
  p.product_code, p.product_name,
  s.supplier_name,
  COALESCE(po_agg.qty_ordered, 0)::numeric AS qty_ordered,
  COALESCE(po_agg.qty_received, 0)::numeric AS qty_received
`
const LINE_FROM = `
  FROM purchase_request_lines prl
  JOIN products p ON p.id = prl.product_id
  LEFT JOIN suppliers s ON s.id = prl.supplier_id
  LEFT JOIN LATERAL (
    SELECT SUM(pol.qty) AS qty_ordered, SUM(pol.qty_received) AS qty_received
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.id = pol.po_id AND po.deleted_at IS NULL
    WHERE pol.pr_line_id = prl.id
  ) po_agg ON true
`

export class PurchaseRequestsRepository {
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string },
    search?: string
  ): Promise<{ data: PurchaseRequestWithRelations[]; total: number }> {
    const conditions = ['pr.company_id = $1', 'pr.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`pr.status = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`pr.branch_id = $${idx++}`) }
    else if (filter?.branch_ids && (filter.branch_ids as string[]).length > 0) { params.push(filter.branch_ids); conditions.push(`pr.branch_id = ANY($${idx++}::uuid[])`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`pr.request_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`pr.request_date <= $${idx++}::date`) }
    if (search) { params.push(`%${search}%`); conditions.push(`(pr.request_number ILIKE $${idx} OR b.branch_name ILIKE $${idx})`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY pr.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM purchase_requests pr JOIN branches b ON b.id = pr.branch_id ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<PurchaseRequestWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE pr.id = $1 AND pr.company_id = $2 AND pr.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findWithLines(id: string, companyId: string): Promise<PurchaseRequestWithLines | null> {
    const header = await this.findById(id, companyId)
    if (!header) return null

    const { rows: lines } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE prl.request_id = $1 ORDER BY prl.sort_order ASC`,
      [id]
    )

    return { ...header, lines }
  }

  async create(client: PoolClient, companyId: string, data: {
    branch_id: string; request_number: string; request_date?: string;
    needed_by_date?: string | null; priority?: string; notes?: string | null;
    requested_by?: string | null; status?: string; created_by?: string | null
  }): Promise<PurchaseRequest> {
    const { rows } = await client.query(
      `INSERT INTO purchase_requests (company_id, branch_id, request_number, request_date, needed_by_date, priority, notes, requested_by, status, created_by, updated_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, COALESCE($9, 'DRAFT'), $10, $10) RETURNING *`,
      [companyId, data.branch_id, data.request_number, data.request_date ?? null, data.needed_by_date ?? null, data.priority ?? 'normal', data.notes ?? null, data.requested_by ?? null, data.status ?? 'DRAFT', data.created_by ?? null]
    )
    return rows[0]
  }

  async insertLines(client: PoolClient, requestId: string, lines: CreatePurchaseRequestLineDto[]): Promise<PurchaseRequestLine[]> {
    if (lines.length === 0) return []

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      valueRows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`)
      params.push(requestId, l.product_id, l.qty, l.uom, l.estimated_price ?? null, l.supplier_id ?? null, l.notes ?? null, i)
      idx += 8
    }

    const { rows } = await client.query(
      `INSERT INTO purchase_request_lines (request_id, product_id, qty, uom, estimated_price, supplier_id, notes, sort_order)
       VALUES ${valueRows.join(', ')} RETURNING *`,
      params
    )
    return rows
  }

  async deleteLines(client: PoolClient, requestId: string): Promise<void> {
    await client.query('DELETE FROM purchase_request_lines WHERE request_id = $1', [requestId])
  }

  async updateStatus(id: string, companyId: string, status: PurchaseRequestStatus, extra?: Record<string, unknown>): Promise<PurchaseRequest | null> {
    const fields = ['status = $1', 'updated_at = now()']
    const params: unknown[] = [status]
    let idx = 2

    if (extra?.approved_by) { params.push(extra.approved_by); fields.push(`approved_by = $${idx++}`) }
    if (extra?.approved_at) { params.push(extra.approved_at); fields.push(`approved_at = $${idx++}`) }
    if (extra?.rejected_reason) { params.push(extra.rejected_reason); fields.push(`rejected_reason = $${idx++}`) }
    if (extra?.updated_by) { params.push(extra.updated_by); fields.push(`updated_by = $${idx++}`) }

    params.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE purchase_requests SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async update(id: string, companyId: string, data: { needed_by_date?: string | null; notes?: string | null; updated_by?: string }): Promise<PurchaseRequest | null> {
    const fields: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.needed_by_date !== undefined) { params.push(data.needed_by_date); fields.push(`needed_by_date = $${idx++}`) }
    if (data.notes !== undefined) { params.push(data.notes); fields.push(`notes = $${idx++}`) }
    if (data.updated_by) { params.push(data.updated_by); fields.push(`updated_by = $${idx++}`) }

    params.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE purchase_requests SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL AND status = 'DRAFT' RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE purchase_requests SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL AND status IN ('DRAFT', 'REJECTED', 'CANCELLED')`,
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async generateRequestNumber(client: PoolClient, companyId: string, branchCode: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `PR-${branchCode}-${dateStr}`

    const { rows } = await client.query(
      `SELECT request_number FROM purchase_requests
       WHERE company_id = $1 AND request_number LIKE $2
       ORDER BY request_number DESC LIMIT 1
       FOR UPDATE`,
      [companyId, `${prefix}-%`]
    )

    const lastSeq = rows.length > 0 ? parseInt(rows[0].request_number.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  // ─── Approval-related queries ────────────────────────────────────────────

  async findMainWarehouseByBranch(branchId: string): Promise<{ id: string; warehouse_name: string } | null> {
    const { rows } = await pool.query(
      `SELECT id, warehouse_name FROM warehouses WHERE branch_id = $1 AND warehouse_type = 'MAIN' AND deleted_at IS NULL LIMIT 1`,
      [branchId]
    )
    return rows[0] ?? null
  }

  async findStockBalancesBatch(warehouseId: string, productIds: string[]): Promise<Array<{ product_id: string; qty: number }>> {
    const { rows } = await pool.query(
      `SELECT product_id, qty::numeric FROM stock_balances WHERE warehouse_id = $1 AND product_id = ANY($2::uuid[])`,
      [warehouseId, productIds]
    )
    return rows.map(r => ({ product_id: r.product_id, qty: parseFloat(r.qty) }))
  }

  async findLatestPricesBatch(productIds: string[], supplierIds: string[]): Promise<Array<{ product_id: string; supplier_id: string; price: number; price_uom: string | null }>> {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (pl.product_id, pl.supplier_id)
         pl.product_id, pl.supplier_id, pl.price, mu.unit_name AS price_uom
       FROM pricelists pl
       LEFT JOIN product_uoms pu ON pu.id = pl.uom_id
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE pl.product_id = ANY($1::uuid[]) AND pl.supplier_id = ANY($2::uuid[])
         AND pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
         AND pl.valid_from <= CURRENT_DATE AND (pl.valid_to IS NULL OR pl.valid_to >= CURRENT_DATE)
       ORDER BY pl.product_id, pl.supplier_id, pl.valid_from DESC, pl.created_at DESC`,
      [productIds, supplierIds]
    )
    return rows.map(r => ({ product_id: r.product_id, supplier_id: r.supplier_id, price: parseFloat(r.price), price_uom: r.price_uom ?? null }))
  }

  async findSupplierWithPaymentTerms(supplierId: string): Promise<{ supplier_name: string; phone: string | null; payment_term_days: number | null; payment_term_name: string | null } | null> {
    const { rows } = await pool.query(
      `SELECT s.supplier_name, s.phone, pt.days AS payment_term_days, pt.term_name AS payment_term_name
       FROM suppliers s
       LEFT JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id
       WHERE s.id = $1`,
      [supplierId]
    )
    return rows[0] ?? null
  }

  async lockPRForUpdate(client: PoolClient, prId: string, companyId: string): Promise<{ id: string; status: string; branch_id: string; branch_code: string; branch_name: string } | null> {
    const { rows } = await client.query(
      `SELECT pr.*, b.branch_code, b.branch_name FROM purchase_requests pr
       JOIN branches b ON b.id = pr.branch_id
       WHERE pr.id = $1 AND pr.company_id = $2 AND pr.deleted_at IS NULL FOR UPDATE`,
      [prId, companyId]
    )
    return rows[0] ?? null
  }

  async findLinesWithProducts(client: PoolClient, requestId: string): Promise<Array<{ id: string; product_id: string; product_name: string; product_code: string; qty: string; uom: string; estimated_price: string | null; supplier_id: string | null; notes: string | null }>> {
    const { rows } = await client.query(
      `SELECT prl.*, p.product_name, p.product_code FROM purchase_request_lines prl
       JOIN products p ON p.id = prl.product_id WHERE prl.request_id = $1`,
      [requestId]
    )
    return rows
  }

  async setConvertedStatus(client: PoolClient, prId: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE purchase_requests SET status = 'CONVERTED', approved_by = $1, approved_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND company_id = $3`,
      [userId, prId, companyId]
    )
  }

  async setQtyApprovedBatchWithValues(client: PoolClient, lines: Array<{ pr_line_id: string; qty_approved: number }>): Promise<void> {
    if (lines.length === 0) return
    const cases = lines.map((l, i) => `WHEN id = $${i * 2 + 1}::uuid THEN $${i * 2 + 2}::numeric`).join(' ')
    const ids = lines.map(l => l.pr_line_id)
    const params: unknown[] = []
    for (const l of lines) { params.push(l.pr_line_id, l.qty_approved) }
    params.push(ids)
    await client.query(
      `UPDATE purchase_request_lines SET qty_approved = CASE ${cases} END WHERE id = ANY($${params.length}::uuid[])`,
      params
    )
  }
}

export const purchaseRequestsRepository = new PurchaseRequestsRepository()
