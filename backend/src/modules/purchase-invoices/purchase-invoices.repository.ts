import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  PurchaseInvoice,
  PurchaseInvoiceDetail,
  PurchaseInvoiceLine,
  PurchaseInvoiceWithRelations,
} from './purchase-invoices.types'

type PostingRow = {
  purchase_invoice_line_id: string
  // goods_processing_output
  goods_processing_output_id: string
  product_id: string
  qty_output: number
  output_sort_order: number
  is_waste: boolean
  // stock
  stock_movement_id: string | null
  warehouse_id: string
  // line subtotal (net of tax)
  line_subtotal: number
}

type UpdateGpOutputCostAndLinkToInvoiceLineInput = {
  goods_processing_output_id: string
  purchase_invoice_line_id: string
  allocatedCost: number
  unitCost: number
}

type UpdateStockMovementCostInput = {
  stock_movement_id: string
  costPerUnit: number
  totalCost: number
}

const HEADER_SELECT = `
  pi.*,
  s.supplier_name,
  b.branch_name,
  b.branch_code,
  COALESCE(gr_agg.goods_receipt_count, 0)::int AS goods_receipt_count
`

const HEADER_FROM = `
  FROM purchase_invoices pi
  JOIN suppliers s ON s.id = pi.supplier_id
  JOIN branches b ON b.id = pi.branch_id
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT pilg.goods_receipt_id)::int AS goods_receipt_count
    FROM purchase_invoice_gr_links pilg
    WHERE pilg.purchase_invoice_id = pi.id
  ) gr_agg ON true
`

const LINE_SELECT = `
  pil.*,
  p.product_code,
  p.product_name
`

const LINE_FROM = `
  FROM purchase_invoice_lines pil
  JOIN products p ON p.id = pil.product_id
`

export class PurchaseInvoicesRepository {
  /**
   * Build posting rows for cost allocation + journal + qty_invoiced updates.
   * Mapping:
   *  purchase_invoice_lines (by invoice)
   *    → goods_processing_inputs (gr_line_id)
   *      → goods_processing_outputs (non-waste only for cost allocation)
   *  Also collects:
   *   - output_sort_order for rounding
   *   - stock_movement_id + warehouse_id for stock updates
   *   - line_subtotal for allocation total per PI line (net of tax)
   */
  async findPostingRowsForInvoice(client: PoolClient, invoiceId: string): Promise<PostingRow[]> {
    const { rows } = await client.query<PostingRow>(
      `
      SELECT
        pil.id AS purchase_invoice_line_id,

        gpo.id AS goods_processing_output_id,
        gpo.product_id,

        gpo.qty_output,
        gpo.sort_order AS output_sort_order,
        gpo.is_waste,

        gpo.stock_movement_id,
        gpo.warehouse_id,

        pil.subtotal AS line_subtotal
      FROM purchase_invoice_lines pil
      JOIN goods_processing_inputs gpi
        ON gpi.gr_line_id = pil.gr_line_id
       AND gpi.deleted_at IS NULL
      JOIN goods_processing_outputs gpo
        ON gpo.goods_processing_id = gpi.goods_processing_id
       AND gpo.input_id = gpi.id
       AND gpo.is_waste = FALSE
       AND gpo.deleted_at IS NULL
      WHERE pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
      ORDER BY pil.sort_order, gpo.sort_order, gpo.created_at
      `,
      [invoiceId],
    )

    return rows
  }

  async updateGpOutputCostAndLinkToInvoiceLine(
    client: PoolClient,
    input: UpdateGpOutputCostAndLinkToInvoiceLineInput,
  ): Promise<void> {
    await client.query(
      `
      UPDATE goods_processing_outputs
      SET unit_cost = $1,
          allocated_cost = $2,
          purchase_invoice_line_id = $3,
          updated_at = now()
      WHERE id = $4
      `,
      [input.unitCost, input.allocatedCost, input.purchase_invoice_line_id, input.goods_processing_output_id],
    )
  }

  async updateStockMovementCost(client: PoolClient, input: UpdateStockMovementCostInput): Promise<void> {
    await client.query(
      `
      UPDATE stock_movements
      SET cost_per_unit = $1,
          total_cost = $2,
          updated_at = now()
      WHERE id = $3
      `,
      [input.costPerUnit, input.totalCost, input.stock_movement_id],
    )
  }

  async createJournalHeader(
    client: PoolClient,
    input: {
      companyId: string
      branchId: string
      journalDate: string
      currency: string
      journalType: string
      referenceType: string
      referenceId: string
      referenceNumber: string
      description: string
      totalDebit: number
      totalCredit: number
      createdBy: string
    },
  ): Promise<{ id: string }> {
    const { rows } = await client.query(
      `
      INSERT INTO journal_headers (
        company_id,
        branch_id,
        journal_date,
        currency,
        journal_type,
        reference_type,
        reference_id,
        reference_number,
        description,
        total_debit,
        total_credit,
        created_by,
        updated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      RETURNING id
      `,
      [
        input.companyId,
        input.branchId,
        input.journalDate,
        input.currency,
        input.journalType,
        input.referenceType,
        input.referenceId,
        input.referenceNumber,
        input.description,
        input.totalDebit,
        input.totalCredit,
        input.createdBy,
      ],
    )

    return { id: rows[0].id }
  }

  async createJournalLines(
    client: PoolClient,
    input: {
      journalHeaderId: string
      debitAccountId: string
      debitAmount: number
      taxAccountId: string
      taxAmount: number
      creditAccountId: string
      creditAmount: number
      createdBy: string
    },
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO journal_lines (
        journal_header_id,
        line_type,
        account_id,
        amount,
        debit_credit,
        created_by,
        updated_by
      )
      VALUES
        ($1,'DEBIT',$2,$3,'DEBIT',$7,$7),
        ($1,'DEBIT_TAX',$4,$5,'DEBIT',$7,$7),
        ($1,'CREDIT',$6,$8,'CREDIT',$7,$7)
      `,
      [
        input.journalHeaderId,
        input.debitAccountId,
        input.debitAmount,
        input.taxAccountId,
        input.taxAmount,
        input.creditAccountId,
        input.createdBy,
        input.creditAmount,
      ],
    )
  }

  async updatePaymentDueDateForReferencedPOs(client: PoolClient, invoiceId: string, dueDate: string): Promise<void> {
    await client.query(
      `
      UPDATE purchase_orders po
      SET payment_due_date = $1,
          updated_at = now()
      WHERE po.id IN (
        SELECT DISTINCT po2.id
        FROM purchase_invoice_gr_links pilg
        JOIN goods_receipts gr ON gr.id = pilg.goods_receipt_id
        JOIN purchase_orders po2 ON po2.id = gr.po_id
        WHERE pilg.purchase_invoice_id = $2
          AND po2.deleted_at IS NULL
      )
      `,
      [dueDate, invoiceId],
    )
  }

  async updateGoodsReceiptQtyInvoiced(client: PoolClient, invoiceId: string): Promise<void> {
    // qty_invoiced on goods_receipt_lines = SUM(purchase_invoice_lines.qty_invoiced) for linked invoice(s)
    await client.query(
      `
      UPDATE goods_receipt_lines grl
      SET qty_invoiced = COALESCE(sub.sum_qty, 0),
          updated_at = now()
      FROM (
        SELECT pil.gr_line_id,
               SUM(pil.qty_invoiced)::numeric(20,4) AS sum_qty
        FROM purchase_invoice_lines pil
        WHERE pil.purchase_invoice_id = $1
          AND pil.deleted_at IS NULL
        GROUP BY pil.gr_line_id
      ) sub
      WHERE grl.id = sub.gr_line_id
        AND grl.deleted_at IS NULL
      `,
      [invoiceId],
    )
  }

  async updateJournalIdAndPost(
    client: PoolClient,
    invoiceId: string,
    journalId: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE purchase_invoices
      SET journal_id = $1,
          status = 'POSTED',
          posted_by = $2,
          posted_at = now(),
          updated_by = $2,
          updated_at = now()
      WHERE id = $3
      `,
      [journalId, userId, invoiceId],
    )
  }

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string },
  ): Promise<{ data: PurchaseInvoiceWithRelations[]; total: number }> {

    const conditions = ['pi.company_id = $1', 'pi.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) {
      const trimmed = filter.status.trim()
      if (trimmed.includes(',')) {
        const statuses = trimmed.split(',').map((s) => s.trim())
        params.push(statuses)
        conditions.push(`pi.status = ANY($${idx++}::text[])`)
      } else {
        params.push(trimmed)
        conditions.push(`pi.status = $${idx++}`)
      }
    }

    if (filter?.supplier_id) {
      params.push(filter.supplier_id)
      conditions.push(`pi.supplier_id = $${idx++}`)
    }

    if (filter?.branch_id) {
      params.push(filter.branch_id)
      conditions.push(`pi.branch_id = $${idx++}`)
    }

    if (filter?.date_from) {
      params.push(filter.date_from)
      conditions.push(`pi.invoice_date >= $${idx++}::date`)
    }

    if (filter?.date_to) {
      params.push(filter.date_to)
      conditions.push(`pi.invoice_date <= $${idx++}::date`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY pi.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total ${HEADER_FROM} ${where}`,
        params,
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<PurchaseInvoiceDetail | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE pi.id = $1 AND pi.company_id = $2 AND pi.deleted_at IS NULL`,
      [id, companyId],
    )
    const header = rows[0]
    if (!header) return null

    const [linesRes, linksRes] = await Promise.all([
      pool.query<PurchaseInvoiceLine>(
        `SELECT ${LINE_SELECT} ${LINE_FROM}
         WHERE pil.purchase_invoice_id = $1 AND pil.deleted_at IS NULL
         ORDER BY pil.sort_order, pil.created_at ASC`,
        [id],
      ),
      pool.query(
        `SELECT pilg.*,
                gr.received_date,
                gr.gr_number AS goods_receipt_number,
                po.supplier_id,
                s.supplier_name
         FROM purchase_invoice_gr_links pilg
         JOIN goods_receipts gr ON gr.id = pilg.goods_receipt_id
         JOIN purchase_orders po ON po.id = gr.po_id
         JOIN suppliers s ON s.id = po.supplier_id
         WHERE pilg.purchase_invoice_id = $1
         ORDER BY gr.received_date DESC`,
        [id],
      ),
    ])

    return {
      ...header,
      gr_links: linksRes.rows,
      lines: linesRes.rows,
    }
  }

  async create(client: PoolClient, companyId: string, data: {
    supplier_id: string
    branch_id: string
    invoice_number: string
    invoice_date: string
    notes: string | null
    subtotal: number
    total_tax: number
    total_amount: number
    created_by: string
  }): Promise<PurchaseInvoice> {
    const { rows } = await client.query<PurchaseInvoice>(
      `INSERT INTO purchase_invoices (
         company_id, supplier_id, branch_id, invoice_number, invoice_date,
         due_date, status, notes,
         subtotal, total_tax, total_amount,
         created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10,$11,$11)
       RETURNING *`,
      [
        companyId,
        data.supplier_id,
        data.branch_id,
        data.invoice_number,
        data.invoice_date,
        null,
        data.notes,
        data.subtotal,
        data.total_tax,
        data.total_amount,
        data.created_by,
      ],
    )
    return rows[0]
  }

  async replaceLines(client: PoolClient, invoiceId: string, lines: {
    gr_line_id: string
    product_id: string
    qty_received: number
    qty_invoiced: number
    unit_price: number
    tax_rate: number
    subtotal: number
    tax_amount: number
    total: number
    qty_po: number | null
    unit_price_po: number | null
    variance_qty: number
    variance_price: number
    match_status: 'MATCH' | 'OVER' | 'UNDER'
    sort_order: number
    created_by: string
    updated_by: string
  }[]): Promise<void> {
    await client.query('DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id = $1 AND deleted_at IS NULL', [invoiceId])
    if (lines.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const l of lines) {
      valueRows.push(`($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17},$${idx + 18},$${idx + 19})`)
      params.push(
        invoiceId,
        l.gr_line_id,
        l.product_id,
        l.qty_received,
        l.qty_invoiced,
        l.unit_price,
        l.subtotal,
        l.tax_rate,
        l.tax_amount,
        l.total,
        l.qty_po,
        l.unit_price_po,
        l.variance_qty,
        l.variance_price,
        l.match_status,
        l.sort_order,
        false,
        null,
        l.created_by,
        l.updated_by,
      )
      idx += 20
    }

    await client.query(
      `INSERT INTO purchase_invoice_lines (
         purchase_invoice_id, gr_line_id, product_id,
         qty_received, qty_invoiced, unit_price,
         subtotal, tax_rate, tax_amount, total,
         qty_po, unit_price_po,
         variance_qty, variance_price,
         match_status, sort_order,
         is_deleted, deleted_at,
         created_by, updated_by
       ) VALUES ${valueRows.join(', ')}`,
      params,
    )
  }

  async updateStatus(client: PoolClient, invoiceId: string, status: string, extra: Record<string, unknown>): Promise<void> {
    const fields: string[] = ['status = $1', 'updated_at = now()']
    const params: unknown[] = [status]
    let idx = 2

    for (const [key, val] of Object.entries(extra)) {
      fields.push(`${key} = $${idx++}`)
      params.push(val)
    }

    params.push(invoiceId)

    await client.query(`UPDATE purchase_invoices SET ${fields.join(', ')} WHERE id = $${idx}`, params)
  }

  async softDelete(client: PoolClient, invoiceId: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices
       SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`,
      [userId, invoiceId, companyId],
    )
  }

  async updateDueDate(client: PoolClient, invoiceId: string, dueDate: string): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices SET due_date = $1, updated_at = now() WHERE id = $2`,
      [dueDate, invoiceId],
    )
  }

  async findSupplierPaymentTermForInvoice(client: PoolClient, supplierId: string): Promise<any> {
    // delegated in service via purchaseOrdersRepository; keep repo minimal for now
    return null
  }

  async findLinesWithGrProductsForPosting(client: PoolClient, invoiceId: string) {
    const { rows } = await client.query(
      `SELECT
         pil.*,
         p.product_id,
         p.product_code,
         p.product_name,
         grl.qty_received AS gr_qty_received,
         grl.uom_received AS gr_uom_received,
         grl.po_line_id,
         grl.qty_po AS qty_po,
         grl.unit_price_po AS unit_price_po
       FROM purchase_invoice_lines pil
       JOIN goods_receipt_lines grl ON grl.id = pil.gr_line_id
       JOIN products p ON p.id = pil.product_id
       WHERE pil.purchase_invoice_id = $1 AND pil.deleted_at IS NULL`,
      [invoiceId],
    )
    return rows
  }

  async insertGrLinks(client: PoolClient, invoiceId: string, grIds: string[]): Promise<void> {
    if (grIds.length === 0) return
    const values = grIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO purchase_invoice_gr_links (purchase_invoice_id, goods_receipt_id)
       VALUES ${values} ON CONFLICT DO NOTHING`,
      [invoiceId, ...grIds],
    )
  }

  async replaceGrLinks(client: PoolClient, invoiceId: string, grIds: string[]): Promise<void> {
    await client.query(
      `DELETE FROM purchase_invoice_gr_links WHERE purchase_invoice_id = $1`,
      [invoiceId],
    )
    await this.insertGrLinks(client, invoiceId, grIds)
  }

  async findAvailableGrs(companyId: string, supplierId: string, branchId: string) {
    const { rows } = await pool.query(
      `SELECT gr.id, gr.gr_number, gr.received_date, gr.branch_id,
              s.supplier_name,
              COUNT(grl.id)::int AS line_count
       FROM goods_receipts gr
       JOIN purchase_orders po ON po.id = gr.po_id
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN goods_receipt_lines grl ON grl.gr_id = gr.id AND grl.deleted_at IS NULL
       WHERE gr.company_id = $1
         AND gr.status = 'CONFIRMED'
         AND gr.deleted_at IS NULL
         AND po.supplier_id = $2
         AND gr.branch_id = $3
         AND grl.qty_invoiced < grl.qty_received
       GROUP BY gr.id, gr.gr_number, gr.received_date, gr.branch_id, s.supplier_name
       ORDER BY gr.received_date DESC`,
      [companyId, supplierId, branchId],
    )
    return rows
  }
}

export const purchaseInvoicesRepository = new PurchaseInvoicesRepository()

