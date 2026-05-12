import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  GoodsReceipt, GoodsReceiptWithRelations, GoodsReceiptLineWithRelations,
  GoodsReceiptWithLines, CreateGoodsReceiptLineDto
} from './goods-receipts.types'

const HEADER_SELECT = `
  gr.*,
  b.branch_name, b.branch_code,
  po.po_number, s.supplier_name,
  w.warehouse_name,
  emp.full_name AS created_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  COALESCE(lines_agg.total_invoice_amount, 0)::numeric AS total_invoice_amount
`
const HEADER_FROM = `
  FROM goods_receipts gr
  JOIN branches b ON b.id = gr.branch_id
  JOIN purchase_orders po ON po.id = gr.po_id
  JOIN suppliers s ON s.id = po.supplier_id
  JOIN warehouses w ON w.id = gr.warehouse_id
  LEFT JOIN employees emp ON emp.user_id = gr.created_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count, SUM(grl.total_price_invoice) AS total_invoice_amount
    FROM goods_receipt_lines grl WHERE grl.gr_id = gr.id
  ) lines_agg ON true
`

const LINE_SELECT = `grl.*, p.product_code, p.product_name, pol.uom`
const LINE_FROM = `
  FROM goods_receipt_lines grl
  JOIN products p ON p.id = grl.product_id
  JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
`

export interface GoodsReceiptAttachment {
  id: string
  gr_id: string
  file_type: string
  file_path: string
  file_name: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export class GoodsReceiptsRepository {
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; po_id?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string }
  ): Promise<{ data: GoodsReceiptWithRelations[]; total: number }> {
    const conditions = ['gr.company_id = $1', 'gr.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`gr.status = $${idx++}`) }
    if (filter?.po_id) { params.push(filter.po_id); conditions.push(`gr.po_id = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`gr.branch_id = $${idx++}`) }
    else if (filter?.branch_ids && filter.branch_ids.length > 0) { params.push(filter.branch_ids); conditions.push(`gr.branch_id = ANY($${idx++}::uuid[])`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`gr.received_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`gr.received_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY gr.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM goods_receipts gr ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<GoodsReceiptWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE gr.id = $1 AND gr.company_id = $2 AND gr.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findWithLines(id: string, companyId: string): Promise<GoodsReceiptWithLines | null> {
    const header = await this.findById(id, companyId)
    if (!header) return null
    const { rows: lines } = await pool.query(`SELECT ${LINE_SELECT} ${LINE_FROM} WHERE grl.gr_id = $1`, [id])
    return { ...header, lines }
  }

  async create(client: PoolClient, companyId: string, data: {
    branch_id: string; po_id: string; warehouse_id: string; gr_number: string;
    received_date?: string; invoice_number?: string | null; invoice_date?: string | null;
    notes?: string | null; created_by?: string
  }): Promise<GoodsReceipt> {
    const { rows } = await client.query(
      `INSERT INTO goods_receipts (company_id, branch_id, po_id, warehouse_id, gr_number, received_date, invoice_number, invoice_date, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, $10, $10) RETURNING *`,
      [companyId, data.branch_id, data.po_id, data.warehouse_id, data.gr_number,
       data.received_date ?? null, data.invoice_number ?? null, data.invoice_date ?? null,
       data.notes ?? null, data.created_by ?? null]
    )
    return rows[0]
  }

  async insertLines(client: PoolClient, grId: string, lines: (CreateGoodsReceiptLineDto & { unit_price_po: number; price_variance: number; price_variance_pct: number; variance_status: string })[]): Promise<void> {
    if (lines.length === 0) return
    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const l of lines) {
      const totalInvoice = l.qty_received * l.unit_price_invoice
      valueRows.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10})`)
      params.push(grId, l.po_line_id, l.product_id, l.qty_received, l.unit_price_invoice, totalInvoice, l.unit_price_po, l.price_variance, l.price_variance_pct, l.variance_status, l.notes ?? null)
      idx += 11
    }

    await client.query(
      `INSERT INTO goods_receipt_lines (gr_id, po_line_id, product_id, qty_received, unit_price_invoice, total_price_invoice, unit_price_po, price_variance, price_variance_pct, variance_status, notes)
       VALUES ${valueRows.join(', ')}`,
      params
    )
  }

  async updateStatus(client: PoolClient, id: string, status: string, extra?: { journal_id?: string; updated_by?: string }): Promise<void> {
    const fields = ['status = $1', 'updated_at = now()']
    const params: unknown[] = [status]
    let idx = 2

    if (extra?.journal_id) { params.push(extra.journal_id); fields.push(`journal_id = $${idx++}`) }
    if (extra?.updated_by) { params.push(extra.updated_by); fields.push(`updated_by = $${idx++}`) }

    params.push(id)
    await client.query(`UPDATE goods_receipts SET ${fields.join(', ')} WHERE id = $${idx}`, params)
  }

  async generateGrNumber(client: PoolClient, companyId: string, branchCode: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `GR-${branchCode}-${dateStr}`

    // Advisory lock using Postgres hashtext for proper distribution
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${companyId}-${prefix}`])

    const { rows } = await client.query(
      `SELECT gr_number FROM goods_receipts WHERE company_id = $1 AND gr_number LIKE $2 ORDER BY gr_number DESC LIMIT 1`,
      [companyId, `${prefix}-%`]
    )

    const lastSeq = rows.length > 0 ? parseInt(rows[0].gr_number.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  // ── Attachments ──

  async findAttachments(grId: string): Promise<GoodsReceiptAttachment[]> {
    const { rows } = await pool.query(
      'SELECT * FROM goods_receipt_attachments WHERE gr_id = $1 ORDER BY uploaded_at DESC',
      [grId]
    )
    return rows
  }

  async insertAttachment(grId: string, data: { file_type: string; file_path: string; file_name: string | null; uploaded_by: string | null }): Promise<GoodsReceiptAttachment> {
    const { rows } = await pool.query(
      `INSERT INTO goods_receipt_attachments (gr_id, file_type, file_path, file_name, uploaded_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [grId, data.file_type, data.file_path, data.file_name, data.uploaded_by]
    )
    return rows[0]
  }

  async deleteAttachment(attachmentId: string, grId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'DELETE FROM goods_receipt_attachments WHERE id = $1 AND gr_id = $2',
      [attachmentId, grId]
    )
    return (rowCount ?? 0) > 0
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE goods_receipts SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL AND status = 'DRAFT'`,
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }
}

export const goodsReceiptsRepository = new GoodsReceiptsRepository()
