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
  COALESCE(lines_agg.total_estimated, 0)::numeric AS total_estimated
`
const HEADER_FROM = `
  FROM purchase_requests pr
  JOIN branches b ON b.id = pr.branch_id
  LEFT JOIN employees req_emp ON req_emp.user_id = pr.requested_by
  LEFT JOIN employees app_emp ON app_emp.user_id = pr.approved_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count, SUM(COALESCE(prl.estimated_price, 0) * prl.qty) AS total_estimated
    FROM purchase_request_lines prl WHERE prl.request_id = pr.id
  ) lines_agg ON true
`

const LINE_SELECT = `
  prl.*,
  p.product_code, p.product_name,
  s.supplier_name
`
const LINE_FROM = `
  FROM purchase_request_lines prl
  JOIN products p ON p.id = prl.product_id
  LEFT JOIN suppliers s ON s.id = prl.supplier_id
`

export class PurchaseRequestsRepository {
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; branch_id?: string; date_from?: string; date_to?: string },
    search?: string
  ): Promise<{ data: PurchaseRequestWithRelations[]; total: number }> {
    const conditions = ['pr.company_id = $1', 'pr.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`pr.status = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`pr.branch_id = $${idx++}`) }
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
    needed_by_date?: string | null; notes?: string | null;
    requested_by?: string | null; created_by?: string | null
  }): Promise<PurchaseRequest> {
    const { rows } = await client.query(
      `INSERT INTO purchase_requests (company_id, branch_id, request_number, request_date, needed_by_date, notes, requested_by, created_by, updated_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $7, $7) RETURNING *`,
      [companyId, data.branch_id, data.request_number, data.request_date ?? null, data.needed_by_date ?? null, data.notes ?? null, data.created_by ?? null]
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

    // Use FOR UPDATE to prevent race condition on sequence
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
}

export const purchaseRequestsRepository = new PurchaseRequestsRepository()
