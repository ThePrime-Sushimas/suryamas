import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  PurchaseOrder, PurchaseOrderWithRelations, PurchaseOrderLine,
  PurchaseOrderLineWithRelations, PurchaseOrderWithLines,
  CreatePurchaseOrderLineDto, PurchaseOrderStatus
} from './purchase-orders.types'

const HEADER_SELECT = `
  po.*,
  b.branch_name, b.branch_code,
  s.supplier_name, s.supplier_code,
  pr.request_number,
  app_emp.full_name AS approved_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count
`
const HEADER_FROM = `
  FROM purchase_orders po
  JOIN branches b ON b.id = po.branch_id
  JOIN suppliers s ON s.id = po.supplier_id
  JOIN purchase_requests pr ON pr.id = po.purchase_request_id
  LEFT JOIN employees app_emp ON app_emp.user_id = po.approved_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count FROM purchase_order_lines pol WHERE pol.po_id = po.id
  ) lines_agg ON true
`

const LINE_SELECT = `pol.*, p.product_code, p.product_name`
const LINE_FROM = `FROM purchase_order_lines pol JOIN products p ON p.id = pol.product_id`

export class PurchaseOrdersRepository {
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; supplier_id?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string },
    search?: string
  ): Promise<{ data: PurchaseOrderWithRelations[]; total: number }> {
    const conditions = ['po.company_id = $1', 'po.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`po.status = $${idx++}`) }
    if (filter?.supplier_id) { params.push(filter.supplier_id); conditions.push(`po.supplier_id = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`po.branch_id = $${idx++}`) }
    else if (filter?.branch_ids && (filter.branch_ids as string[]).length > 0) { params.push(filter.branch_ids); conditions.push(`po.branch_id = ANY($${idx++}::uuid[])`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`po.order_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`po.order_date <= $${idx++}::date`) }
    if (search) { params.push(`%${search}%`); conditions.push(`(po.po_number ILIKE $${idx} OR s.supplier_name ILIKE $${idx})`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY po.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM purchase_orders po JOIN branches b ON b.id = po.branch_id JOIN suppliers s ON s.id = po.supplier_id JOIN purchase_requests pr ON pr.id = po.purchase_request_id ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<PurchaseOrderWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findWithLines(id: string, companyId: string): Promise<PurchaseOrderWithLines | null> {
    const header = await this.findById(id, companyId)
    if (!header) return null
    const { rows: lines } = await pool.query(`SELECT ${LINE_SELECT} ${LINE_FROM} WHERE pol.po_id = $1 ORDER BY pol.sort_order`, [id])
    return { ...header, lines }
  }

  async create(client: PoolClient, companyId: string, data: {
    branch_id: string; supplier_id: string; purchase_request_id: string; po_number: string;
    order_date?: string; expected_delivery_date?: string | null; payment_type: string;
    payment_term_id?: number | null; payment_terms_days?: number | null;
    payment_due_date?: string | null; notes?: string | null; total_amount: number; created_by?: string
  }): Promise<PurchaseOrder> {
    let safePaymentTermId: number | null = data.payment_term_id ?? null
    if (safePaymentTermId != null) {
      const { rows: termRows } = await client.query(
        'SELECT id_payment_term FROM payment_terms WHERE id_payment_term = $1 AND deleted_at IS NULL LIMIT 1',
        [safePaymentTermId]
      )
      if (termRows.length === 0) safePaymentTermId = null
    }


    const { rows } = await client.query(
      `INSERT INTO purchase_orders (company_id, branch_id, supplier_id, purchase_request_id, po_number, order_date, expected_delivery_date, payment_type, payment_term_id, payment_terms_days, payment_due_date, notes, total_amount, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, $10, $11, $12, $13, $14, $14) RETURNING *`,
      [companyId, data.branch_id, data.supplier_id, data.purchase_request_id, data.po_number,
       data.order_date ?? null, data.expected_delivery_date ?? null, data.payment_type,
       safePaymentTermId, data.payment_terms_days ?? null, data.payment_due_date ?? null,
       data.notes ?? null, data.total_amount, data.created_by ?? null]
    )
    return rows[0]
  }

  async insertLines(client: PoolClient, poId: string, lines: CreatePurchaseOrderLineDto[]): Promise<PurchaseOrderLine[]> {
    if (lines.length === 0) return []
    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const totalPrice = l.qty * l.unit_price
      valueRows.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9})`)
      params.push(poId, l.pr_line_id ?? null, l.product_id, l.supplier_product_id ?? null, l.qty, l.uom, l.unit_price, totalPrice, l.notes ?? null, i)
      idx += 10
    }

    const { rows } = await client.query(
      `INSERT INTO purchase_order_lines (po_id, pr_line_id, product_id, supplier_product_id, qty, uom, unit_price, total_price, notes, sort_order)
       VALUES ${valueRows.join(', ')} RETURNING *`,
      params
    )
    return rows
  }

  async deleteLines(client: PoolClient, poId: string): Promise<void> {
    await client.query('DELETE FROM purchase_order_lines WHERE po_id = $1', [poId])
  }

  async updateStatus(id: string, companyId: string, status: PurchaseOrderStatus, extra?: Record<string, unknown>): Promise<PurchaseOrder | null> {
    const fields = ['status = $1', 'updated_at = now()']
    const params: unknown[] = [status]
    let idx = 2

    if (extra?.approved_by) { params.push(extra.approved_by); fields.push(`approved_by = $${idx++}`) }
    if (extra?.approved_at) { params.push(extra.approved_at); fields.push(`approved_at = $${idx++}`) }
    if (extra?.cancelled_reason) { params.push(extra.cancelled_reason); fields.push(`cancelled_reason = $${idx++}`) }
    if (extra?.updated_by) { params.push(extra.updated_by); fields.push(`updated_by = $${idx++}`) }

    params.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      params
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE purchase_orders SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL AND status = 'DRAFT'`,
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasGoodsReceipts(poId: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM goods_receipts WHERE po_id = $1 AND deleted_at IS NULL) AS has',
      [poId]
    )
    return rows[0].has
  }

  async generatePoNumber(client: PoolClient, companyId: string, branchCode: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `PO-${branchCode}-${dateStr}`

    const { rows } = await client.query(
      `SELECT po_number FROM purchase_orders
       WHERE company_id = $1 AND po_number LIKE $2
       ORDER BY po_number DESC LIMIT 1
       FOR UPDATE`,
      [companyId, `${prefix}-%`]
    )

    const lastSeq = rows.length > 0 ? parseInt(rows[0].po_number.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  async findSupplierPaymentTerm(supplierId: string, client?: PoolClient): Promise<{
    payment_term_id: number | null
    calculation_type: string
    days: number
    grace_period_days: number
    payment_dates: number[] | null
    payment_day_of_week: number | null
  } | null> {
    const db = client ?? pool
    const { rows } = await db.query(
      `SELECT s.payment_term_id, pt.calculation_type, pt.days, pt.grace_period_days,
              pt.payment_dates, pt.payment_day_of_week
       FROM suppliers s
       LEFT JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [supplierId]
    )
    if (!rows[0] || !rows[0].payment_term_id) return null
    return rows[0]
  }

  async updatePaymentDueDate(client: PoolClient, poId: string, dueDate: string): Promise<void> {
    await client.query(
      `UPDATE purchase_orders SET payment_due_date = $1, updated_at = now() WHERE id = $2`,
      [dueDate, poId]
    )
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository()
