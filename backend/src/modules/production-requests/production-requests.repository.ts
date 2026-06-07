import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  ProductionRequestWithRelations, ProductionRequestDetail,
  ProductionRequestLineWithRelations, CreateProductionRequestDto,
} from './production-requests.types'

const HEADER_SELECT = `
  pr.*,
  rb.branch_name AS requesting_branch_name,
  fb.branch_name AS fulfilling_branch_name,
  ae.full_name AS accepted_by_name,
  re.full_name AS received_by_name,
  ce.full_name AS created_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  st.transfer_number AS stock_transfer_number
`
const HEADER_FROM = `
  FROM production_requests pr
  JOIN branches rb ON rb.id = pr.requesting_branch_id
  JOIN branches fb ON fb.id = pr.fulfilling_branch_id
  LEFT JOIN employees ae ON ae.user_id = pr.accepted_by
  LEFT JOIN employees re ON re.user_id = pr.received_by
  LEFT JOIN employees ce ON ce.user_id = pr.created_by
  LEFT JOIN stock_transfers st ON st.id = pr.stock_transfer_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count
    FROM production_request_lines
    WHERE production_request_id = pr.id
  ) lines_agg ON true
`

const LINE_SELECT = `
  prl.*,
  w.wip_code, w.wip_name, w.yield_qty, w.uom
`
const LINE_FROM = `
  FROM production_request_lines prl
  JOIN wip_items w ON w.id = prl.wip_id
`

class ProductionRequestsRepository {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async findAll(
    branchIds: string[],
    pagination: { limit: number; offset: number },
    filter?: {
      status?: string
      requesting_branch_id?: string
      fulfilling_branch_id?: string
      date_from?: string
      date_to?: string
      search?: string
    }
  ): Promise<{ data: ProductionRequestWithRelations[]; total: number }> {
    const conditions = [
      '(pr.requesting_branch_id = ANY($1::uuid[]) OR pr.fulfilling_branch_id = ANY($1::uuid[]))',
      'pr.deleted_at IS NULL',
    ]
    const params: unknown[] = [branchIds]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`pr.status = $${idx++}`) }
    if (filter?.requesting_branch_id) { params.push(filter.requesting_branch_id); conditions.push(`pr.requesting_branch_id = $${idx++}`) }
    if (filter?.fulfilling_branch_id) { params.push(filter.fulfilling_branch_id); conditions.push(`pr.fulfilling_branch_id = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`pr.request_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`pr.request_date <= $${idx++}::date`) }
    if (filter?.search) { params.push(`%${filter.search}%`); conditions.push(`pr.request_number ILIKE $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY pr.request_date DESC, pr.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM production_requests pr ${where}`,
        params
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────────

  async findById(id: string, branchIds: string[]): Promise<ProductionRequestDetail | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE pr.id = $1 AND pr.deleted_at IS NULL
         AND (pr.requesting_branch_id = ANY($2::uuid[]) OR pr.fulfilling_branch_id = ANY($2::uuid[]))`,
      [id, branchIds]
    )
    if (rows.length === 0) return null

    const header = rows[0] as ProductionRequestWithRelations
    const { rows: lines } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE prl.production_request_id = $1 ORDER BY prl.sort_order, prl.created_at`,
      [id]
    )

    return { ...header, lines } as ProductionRequestDetail
  }

  // ─── LOCK & FIND (for mutations) ─────────────────────────────────────────────

  async lockAndFindById(client: PoolClient, id: string, branchIds: string[]): Promise<ProductionRequestWithRelations | null> {
    const { rows } = await client.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE pr.id = $1 AND pr.deleted_at IS NULL
         AND (pr.requesting_branch_id = ANY($2::uuid[]) OR pr.fulfilling_branch_id = ANY($2::uuid[]))
       FOR UPDATE OF pr`,
      [id, branchIds]
    )
    return rows[0] ?? null
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async generateRequestNumber(client: PoolClient, companyId: string, branchCode: string, requestDate: string): Promise<string> {
    const prefix = `PRQ-${branchCode}`
    const month = requestDate.slice(2, 4) + requestDate.slice(5, 7) // YYMM
    const pattern = `${prefix}-${month}%`

    const { rows } = await client.query(
      `SELECT request_number FROM production_requests
       WHERE company_id = $1 AND request_number LIKE $2
       ORDER BY request_number DESC LIMIT 1`,
      [companyId, pattern]
    )

    let seq = 1
    if (rows.length > 0) {
      const last = rows[0].request_number as string
      const lastSeq = parseInt(last.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    return `${prefix}-${month}-${String(seq).padStart(4, '0')}`
  }

  async getBranchCode(client: PoolClient, branchId: string): Promise<string | null> {
    const { rows } = await client.query(
      `SELECT branch_code FROM branches WHERE id = $1`,
      [branchId]
    )
    return rows[0]?.branch_code ?? null
  }

  async create(
    client: PoolClient,
    companyId: string,
    dto: CreateProductionRequestDto,
    requestNumber: string,
  ): Promise<{ id: string }> {
    const { rows } = await client.query(
      `INSERT INTO production_requests (
        company_id, request_number, requesting_branch_id, fulfilling_branch_id,
        request_date, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING id`,
      [
        companyId, requestNumber, dto.requesting_branch_id, dto.fulfilling_branch_id,
        dto.request_date, dto.notes ?? null, dto.created_by ?? null,
      ]
    )
    return { id: rows[0].id }
  }

  async createLines(client: PoolClient, requestId: string, lines: CreateProductionRequestDto['lines']): Promise<void> {
    if (lines.length === 0) return
    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      values.push(requestId, line.wip_id, line.qty_batch, line.notes ?? null, i)
    }

    await client.query(
      `INSERT INTO production_request_lines (production_request_id, wip_id, qty_batch, notes, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    )
  }

  // ─── UPDATE (DRAFT only) ─────────────────────────────────────────────────────

  async updateHeader(client: PoolClient, id: string, dto: {
    fulfilling_branch_id?: string
    request_date?: string
    notes?: string | null
    updated_by?: string
  }): Promise<void> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (dto.fulfilling_branch_id !== undefined) { params.push(dto.fulfilling_branch_id); sets.push(`fulfilling_branch_id = $${idx++}`) }
    if (dto.request_date !== undefined) { params.push(dto.request_date); sets.push(`request_date = $${idx++}`) }
    if (dto.notes !== undefined) { params.push(dto.notes); sets.push(`notes = $${idx++}`) }
    if (dto.updated_by) { params.push(dto.updated_by); sets.push(`updated_by = $${idx++}`) }

    params.push(id)
    await client.query(
      `UPDATE production_requests SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    )
  }

  async replaceLines(client: PoolClient, requestId: string, lines: CreateProductionRequestDto['lines']): Promise<void> {
    await client.query(`DELETE FROM production_request_lines WHERE production_request_id = $1`, [requestId])
    await this.createLines(client, requestId, lines)
  }

  // ─── ACCEPT ───────────────────────────────────────────────────────────────────

  async accept(client: PoolClient, id: string, userId: string, notes: string | null): Promise<void> {
    await client.query(
      `UPDATE production_requests SET
        status = 'ACCEPTED', accepted_at = now(), accepted_by = $2,
        accept_notes = $3, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId, notes]
    )
  }

  async updateLineApproval(client: PoolClient, lineId: string, qtyBatchApproved: number): Promise<void> {
    await client.query(
      `UPDATE production_request_lines SET qty_batch_approved = $2 WHERE id = $1`,
      [lineId, qtyBatchApproved]
    )
  }

  // ─── RECEIVE ──────────────────────────────────────────────────────────────────

  async receive(client: PoolClient, id: string, userId: string, notes: string | null): Promise<void> {
    await client.query(
      `UPDATE production_requests SET
        status = 'RECEIVED', received_at = now(), received_by = $2,
        receive_notes = $3, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId, notes]
    )
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancel(client: PoolClient, id: string, userId: string, reason: string | null): Promise<void> {
    await client.query(
      `UPDATE production_requests SET
        status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2,
        cancel_reason = $3, updated_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId, reason]
    )
  }

  // ─── LINK STOCK TRANSFER ─────────────────────────────────────────────────────

  async linkStockTransfer(client: PoolClient, id: string, stockTransferId: string): Promise<void> {
    await client.query(
      `UPDATE production_requests SET stock_transfer_id = $2, updated_at = now() WHERE id = $1`,
      [id, stockTransferId]
    )
  }

  // ─── SUMMARY (rekap per WIP dari semua cabang) ─────────────────────────────

  async getSummary(companyId: string, filter?: { status?: string; date_from?: string; date_to?: string }): Promise<Array<{
    wip_id: string; wip_code: string; wip_name: string; yield_qty: number; uom: string
    total_batch_requested: number; total_batch_approved: number
    request_count: number
    branches: Array<{ branch_id: string; branch_name: string; qty_batch: number; qty_batch_approved: number }>
  }>> {
    const conditions = ['pr.company_id = $1', 'pr.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    // Default: only DRAFT and ACCEPTED (pending production)
    if (filter?.status) { params.push(filter.status); conditions.push(`pr.status = $${idx++}`) }
    else { conditions.push(`pr.status IN ('DRAFT', 'ACCEPTED')`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`pr.request_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`pr.request_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const { rows } = await pool.query(`
      WITH branch_agg AS (
        SELECT
          prl.wip_id,
          pr.requesting_branch_id AS branch_id,
          rb.branch_name,
          SUM(prl.qty_batch)::numeric AS qty_batch,
          SUM(COALESCE(prl.qty_batch_approved, 0))::numeric AS qty_batch_approved
        FROM production_request_lines prl
        JOIN production_requests pr ON pr.id = prl.production_request_id
        JOIN branches rb ON rb.id = pr.requesting_branch_id
        ${where}
        GROUP BY prl.wip_id, pr.requesting_branch_id, rb.branch_name
      )
      SELECT
        prl.wip_id, w.wip_code, w.wip_name, w.yield_qty, w.uom,
        SUM(prl.qty_batch)::numeric AS total_batch_requested,
        SUM(COALESCE(prl.qty_batch_approved, 0))::numeric AS total_batch_approved,
        COUNT(DISTINCT pr.id)::int AS request_count,
        (SELECT json_agg(json_build_object(
          'branch_id', ba.branch_id,
          'branch_name', ba.branch_name,
          'qty_batch', ba.qty_batch,
          'qty_batch_approved', ba.qty_batch_approved
        ) ORDER BY ba.branch_name)
        FROM branch_agg ba WHERE ba.wip_id = prl.wip_id) AS branches
      FROM production_request_lines prl
      JOIN production_requests pr ON pr.id = prl.production_request_id
      JOIN wip_items w ON w.id = prl.wip_id
      ${where}
      GROUP BY prl.wip_id, w.wip_code, w.wip_name, w.yield_qty, w.uom
      ORDER BY w.wip_name
    `, params)

    return rows.map(r => ({
      ...r,
      total_batch_requested: Number(r.total_batch_requested),
      total_batch_approved: Number(r.total_batch_approved),
    }))
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────────

  async softDelete(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE production_requests SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`,
      [id, userId]
    )
  }
}

export const productionRequestsRepository = new ProductionRequestsRepository()
