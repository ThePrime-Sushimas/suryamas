import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import { SQL_SUPPLIER_ELIGIBLE_FOR_PI } from '../suppliers/suppliers.constants'
import type {
  PurchaseInvoice,
  PurchaseInvoiceCharge,
  PurchaseInvoiceDetail,
  PurchaseInvoiceGpLineAudit,
  PurchaseInvoiceLine,
  PurchaseInvoiceWithRelations,
  GrLineAllocationSummary,
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
  COALESCE(gr_agg.goods_receipt_count, 0)::int AS goods_receipt_count,
  u_created.full_name AS creator_name,
  u_submitted.full_name AS submitter_name,
  u_approved.full_name AS approver_name,
  u_rejected.full_name AS rejector_name,
  u_posted.full_name AS poster_name,
  (
    pi.status = 'APPROVED'
    AND pi.journal_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM purchase_invoice_lines pil
      JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
      JOIN goods_processing gp ON gp.id = gpi.goods_processing_id
      WHERE pil.purchase_invoice_id = pi.id
        AND pil.deleted_at IS NULL
        AND gpi.status != 'CONFIRMED'
    )
    AND EXISTS (
      SELECT 1
      FROM purchase_invoice_lines pil
      JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
      JOIN goods_processing_outputs gpo
        ON gpo.goods_processing_id = gpi.goods_processing_id
       AND gpo.input_id = gpi.id
       AND gpo.is_waste = FALSE
      WHERE pil.purchase_invoice_id = pi.id
        AND pil.deleted_at IS NULL
        AND gpi.status = 'CONFIRMED'
    )
  ) AS post_journal_ready
`

const HEADER_FROM = `
  FROM purchase_invoices pi
  JOIN suppliers s ON s.id = pi.supplier_id
  JOIN branches b ON b.id = pi.branch_id
  LEFT JOIN employees u_created ON u_created.user_id = pi.created_by
  LEFT JOIN employees u_submitted ON u_submitted.user_id = pi.submitted_by
  LEFT JOIN employees u_approved ON u_approved.user_id = pi.approved_by
  LEFT JOIN employees u_rejected ON u_rejected.user_id = pi.rejected_by
  LEFT JOIN employees u_posted ON u_posted.user_id = pi.posted_by
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT pilg.goods_receipt_id)::int AS goods_receipt_count
    FROM purchase_invoice_gr_links pilg
    WHERE pilg.purchase_invoice_id = pi.id
  ) gr_agg ON true
`

const LINE_SELECT = `
  pil.*,
  p.product_code,
  p.product_name,
  grl.uom_received,
  grl.qty_po_uom,
  grl.uom_po,
  grl.conversion_factor
`

const LINE_FROM = `
  FROM purchase_invoice_lines pil
  JOIN products p ON p.id = pil.product_id
  JOIN goods_receipt_lines grl ON grl.id = pil.gr_line_id
`

export type PiPaymentContextRow = {
  invoice_id: string
  po_payment_due_date: string | null
  gr_received_date: string | null
}

export type GrPaymentAnchorDates = {
  max_received_date: string | null
  min_po_payment_due_date: string | null
}

export type GrLineDetailForInvoicing = {
  id: string
  gr_id: string
  product_id: string
  qty_received: string | number
  qty_po_uom: string | number
  uom_po: string
  uom_received: string
  unit_price_invoice: string | number | null
  unit_price_po: string | number
}

export class PurchaseInvoicesRepository {
  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      // Re-throw all errors (BusinessRuleError, ConflictError, DB) — caller handles HTTP mapping.
      throw error
    } finally {
      client.release()
    }
  }

  async findGrLineDetailsForInvoicing(client: PoolClient, grLineIds: string[]): Promise<GrLineDetailForInvoicing[]> {
    const { rows } = await client.query(
      `SELECT grl.id, grl.gr_id, grl.product_id,
              grl.qty_received, grl.qty_po_uom, grl.uom_po, grl.uom_received,
              grl.unit_price_invoice, grl.unit_price_po
       FROM goods_receipt_lines grl
       WHERE grl.id = ANY($1::uuid[])`,
      [grLineIds],
    )
    return rows
  }

  /** Qty already on non-rejected PIs (draft through posted), optionally excluding one invoice. */
  async findGrLineAllocationSummary(
    client: PoolClient,
    grLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<GrLineAllocationSummary[]> {
    if (grLineIds.length === 0) return []

    const params: unknown[] = [grLineIds]
    let excludeClause = ''
    if (excludeInvoiceId) {
      params.push(excludeInvoiceId)
      excludeClause = `AND pil.purchase_invoice_id != $${params.length}`
    }

    const { rows } = await client.query<GrLineAllocationSummary>(
      `SELECT
         grl.id AS gr_line_id,
         grl.qty_received::float AS qty_received,
         COALESCE(SUM(pil.qty_invoiced), 0)::float AS qty_allocated
       FROM goods_receipt_lines grl
       LEFT JOIN purchase_invoice_lines pil
         ON pil.gr_line_id = grl.id
        AND pil.deleted_at IS NULL
        ${excludeClause}
       LEFT JOIN purchase_invoices pi
         ON pi.id = pil.purchase_invoice_id
        AND pi.deleted_at IS NULL
        AND pi.status NOT IN ('REJECTED')
       WHERE grl.id = ANY($1::uuid[])
       GROUP BY grl.id, grl.qty_received`,
      params,
    )
    return rows
  }

  async findActiveDraftInvoiceForGr(
    client: PoolClient,
    grId: string,
    companyId: string,
  ): Promise<string | null> {
    const { rows } = await client.query<{ id: string }>(
      `SELECT pi.id
       FROM purchase_invoices pi
       JOIN purchase_invoice_gr_links l ON l.purchase_invoice_id = pi.id
       WHERE l.goods_receipt_id = $1
         AND pi.company_id = $2
         AND pi.deleted_at IS NULL
         AND pi.status = 'DRAFT'
       LIMIT 1`,
      [grId, companyId],
    )
    return rows[0]?.id ?? null
  }

  async findDuplicateInvoiceNumber(
    client: PoolClient,
    companyId: string,
    supplierId: string,
    invoiceNumber: string,
    excludeInvoiceIds: string[] = [],
  ): Promise<boolean> {
    const params: unknown[] = [companyId, supplierId, invoiceNumber.trim()]
    let excludeClause = ''
    if (excludeInvoiceIds.length > 0) {
      params.push(excludeInvoiceIds)
      excludeClause = `AND pi.id != ALL($${params.length}::uuid[])`
    }

    const { rows } = await client.query(
      `SELECT 1
       FROM purchase_invoices pi
       WHERE pi.company_id = $1
         AND pi.supplier_id = $2
         AND pi.invoice_number = $3
         AND pi.deleted_at IS NULL
         ${excludeClause}
       LIMIT 1`,
      params,
    )
    return rows.length > 0
  }

  async countActiveCharges(client: PoolClient, invoiceId: string): Promise<number> {
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM purchase_invoice_charges
       WHERE purchase_invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    )
    return Number(rows[0]?.count ?? 0)
  }

  async moveInvoiceLinesByIds(
    client: PoolClient,
    lineIds: string[],
    targetInvoiceId: string,
    userId: string,
  ): Promise<void> {
    if (lineIds.length === 0) return
    await client.query(
      `UPDATE purchase_invoice_lines
       SET purchase_invoice_id = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = ANY($3::uuid[])
         AND deleted_at IS NULL`,
      [targetInvoiceId, userId, lineIds],
    )
  }

  async updateInvoiceHeaderTotals(
    client: PoolClient,
    invoiceId: string,
    totals: { subtotal: number; total_tax: number; total_charges: number; total_amount: number },
    userId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices
       SET subtotal = $1,
           total_tax = $2,
           total_charges = $3,
           total_amount = $4,
           updated_by = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [totals.subtotal, totals.total_tax, totals.total_charges, totals.total_amount, userId, invoiceId],
    )
  }

  async copyAttachmentsFromGrs(client: PoolClient, invoiceId: string, grIds: string[]): Promise<void> {
    await client.query(
      `INSERT INTO purchase_invoice_attachments (purchase_invoice_id, file_path, file_name, file_type, uploaded_by)
       SELECT $1, file_path, file_name, file_type, uploaded_by
       FROM goods_receipt_attachments
       WHERE gr_id = ANY($2::uuid[])
       AND NOT EXISTS (
         SELECT 1 FROM purchase_invoice_attachments
         WHERE purchase_invoice_id = $1 AND file_path = goods_receipt_attachments.file_path
       )`,
      [invoiceId, grIds],
    )
  }

  async findUnconfirmedGpProcessingNumber(client: PoolClient, invoiceId: string): Promise<string | null> {
    const { rows } = await client.query(
      `SELECT gp.processing_number
       FROM purchase_invoice_lines pil
       JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
       JOIN goods_processing gp ON gp.id = gpi.goods_processing_id
       WHERE pil.purchase_invoice_id = $1
         AND pil.deleted_at IS NULL
         AND gpi.status != 'CONFIRMED'
       LIMIT 1`,
      [invoiceId],
    )
    return rows[0]?.processing_number ?? null
  }

  /**
   * Full weighted-average recalc from all IN stock movements (qty > 0, cost > 0)
   * for the warehouse/product pair — not a partial/delta update.
   * Used after post (set costs) and unpost (reset costs to 0).
   */
  async recomputeStockBalanceAvgCost(client: PoolClient, warehouseId: string, productId: string): Promise<void> {
    const { rows } = await client.query(
      `SELECT
         CASE WHEN sb.qty > 0
           THEN (
             SELECT SUM(sm.qty * sm.cost_per_unit) / NULLIF(SUM(sm.qty), 0)
             FROM stock_movements sm
             WHERE sm.warehouse_id = $1 AND sm.product_id = $2
               AND sm.qty > 0 AND sm.cost_per_unit > 0
           )
           ELSE 0
         END AS new_avg_cost
       FROM stock_balances sb
       WHERE sb.warehouse_id = $1 AND sb.product_id = $2`,
      [warehouseId, productId],
    )
    const newAvgCost = Number(rows[0]?.new_avg_cost ?? 0)
    await client.query(
      'UPDATE stock_balances SET avg_cost = $1, updated_at = now() WHERE warehouse_id = $2 AND product_id = $3',
      [newAvgCost, warehouseId, productId],
    )
  }

  async findCoaIdsByCodes(client: PoolClient, companyId: string, codes: string[]): Promise<Array<{ account_code: string; id: string }>> {
    const { rows } = await client.query(
      `SELECT id, account_code
       FROM chart_of_accounts
       WHERE company_id = $1 AND account_code = ANY($2::text[])`,
      [companyId, codes],
    )
    return rows.map((r) => ({ account_code: String(r.account_code), id: String(r.id) }))
  }

  async findFiscalPeriodForDate(client: PoolClient, companyId: string, date: string): Promise<string | null> {
    const { rows } = await client.query(
      `SELECT period FROM fiscal_periods
       WHERE company_id = $1 AND period_start <= $2::date AND period_end >= $2::date
       LIMIT 1`,
      [companyId, date],
    )
    return rows[0]?.period ?? null
  }

  async getNextJournalSequence(client: PoolClient, companyId: string, period: string): Promise<number> {
    const { rows } = await client.query(
      `SELECT get_next_journal_sequence($1, $2, 'GENERAL'::journal_type_enum) AS seq`,
      [companyId, period],
    )
    return Number(rows[0].seq)
  }

  async findAttachmentsByInvoiceId(invoiceId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM purchase_invoice_attachments WHERE purchase_invoice_id = $1 ORDER BY uploaded_at DESC`,
      [invoiceId],
    )
    return rows
  }

  async findGrWithPoForDraft(client: PoolClient, grId: string, companyId: string) {
    const { rows } = await client.query(
      `SELECT gr.*, po.supplier_id, po.branch_id, po.payment_due_date
       FROM goods_receipts gr
       JOIN purchase_orders po ON po.id = gr.po_id
       WHERE gr.id = $1 AND gr.company_id = $2`,
      [grId, companyId],
    )
    return rows[0] ?? null
  }

  async findGrLinesForDraft(client: PoolClient, grId: string) {
    const { rows } = await client.query(
      `SELECT grl.*
       FROM goods_receipt_lines grl
       WHERE grl.gr_id = $1`,
      [grId],
    )
    return rows
  }

  async findGrAttachmentsForDraft(client: PoolClient, grId: string) {
    const { rows } = await client.query(
      `SELECT * FROM goods_receipt_attachments WHERE gr_id = $1`,
      [grId],
    )
    return rows
  }

  async insertInvoiceAttachment(
    client: PoolClient,
    invoiceId: string,
    filePath: string,
    fileName: string,
    fileType: string,
    uploadedBy: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO purchase_invoice_attachments (
         purchase_invoice_id, file_path, file_name, file_type, uploaded_by
       ) VALUES ($1, $2, $3, $4, $5)`,
      [invoiceId, filePath, fileName, fileType, uploadedBy],
    )
  }

  async findDraftInvoicesForMerge(client: PoolClient, invoiceIds: string[], companyId: string) {
    const { rows } = await client.query(
      `SELECT * FROM purchase_invoices
       WHERE id = ANY($1::uuid[]) AND company_id = $2 AND status = 'DRAFT' AND deleted_at IS NULL`,
      [invoiceIds, companyId],
    )
    return rows
  }

  async moveLinesToMasterInvoice(client: PoolClient, masterId: string, userId: string, invoiceIds: string[]): Promise<void> {
    await client.query(
      `UPDATE purchase_invoice_lines
       SET purchase_invoice_id = $1, updated_by = $2, updated_at = NOW()
       WHERE purchase_invoice_id = ANY($3::uuid[]) AND deleted_at IS NULL`,
      [masterId, userId, invoiceIds],
    )
  }

  async moveGrLinksToMasterInvoice(client: PoolClient, masterId: string, invoiceIds: string[]): Promise<void> {
    await client.query(
      `UPDATE purchase_invoice_gr_links SET purchase_invoice_id = $1 WHERE purchase_invoice_id = ANY($2::uuid[])`,
      [masterId, invoiceIds],
    )
  }

  async moveChargesToMasterInvoice(client: PoolClient, masterId: string, invoiceIds: string[]): Promise<void> {
    await client.query(
      `UPDATE purchase_invoice_charges
       SET purchase_invoice_id = $1, updated_at = NOW()
       WHERE purchase_invoice_id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [masterId, invoiceIds],
    )
  }

  async moveAttachmentsToMasterInvoice(client: PoolClient, masterId: string, invoiceIds: string[]): Promise<void> {
    await client.query(
      `UPDATE purchase_invoice_attachments SET purchase_invoice_id = $1 WHERE purchase_invoice_id = ANY($2::uuid[])`,
      [masterId, invoiceIds],
    )
  }

  async sumLineTotalsForInvoice(client: PoolClient, invoiceId: string): Promise<{ subtotal: number; total_tax: number; total_amount: number }> {
    const { rows } = await client.query(
      `SELECT SUM(subtotal) AS subtotal, SUM(tax_amount) AS total_tax, SUM(total) AS total_amount
       FROM purchase_invoice_lines
       WHERE purchase_invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    )
    return {
      subtotal: Number(rows[0]?.subtotal ?? 0),
      total_tax: Number(rows[0]?.total_tax ?? 0),
      total_amount: Number(rows[0]?.total_amount ?? 0),
    }
  }

  /** Tax and totals from charge rows only (lines excluded). */
  async aggregateChargeTotals(client: PoolClient, invoiceId: string): Promise<{
    total_charge_tax: number
    total_charge_amount: number
    total_charges: number
  }> {
    const { rows } = await client.query(
      `SELECT
         COALESCE(SUM(tax_amount), 0) AS total_charge_tax,
         COALESCE(SUM(amount), 0) AS total_charge_amount,
         COALESCE(SUM(total), 0) AS total_charges
       FROM purchase_invoice_charges
       WHERE purchase_invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    )
    return {
      total_charge_tax: Number(rows[0]?.total_charge_tax ?? 0),
      total_charge_amount: Number(rows[0]?.total_charge_amount ?? 0),
      total_charges: Number(rows[0]?.total_charges ?? 0),
    }
  }

  async sumFullInvoiceHeaderTotals(
    client: PoolClient,
    invoiceId: string,
  ): Promise<{ subtotal: number; total_tax: number; total_charges: number; total_amount: number }> {
    const lines = await this.sumLineTotalsForInvoice(client, invoiceId)
    const ch = await this.aggregateChargeTotals(client, invoiceId)
    return {
      subtotal: lines.subtotal,
      total_tax: lines.total_tax + ch.total_charge_tax,
      total_charges: ch.total_charges,
      total_amount: lines.total_amount + ch.total_charges,
    }
  }

  async updateMasterInvoiceAfterMerge(
    client: PoolClient,
    masterId: string,
    totals: { subtotal: number; total_tax: number; total_charges: number; total_amount: number },
    sourceInvoiceIds: string[],
    userId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices
       SET subtotal = $1, total_tax = $2, total_charges = $3, total_amount = $4,
           merged_from_invoice_ids = $5, updated_by = $6, updated_at = NOW()
       WHERE id = $7`,
      [totals.subtotal, totals.total_tax, totals.total_charges, totals.total_amount, sourceInvoiceIds, userId, masterId],
    )
  }

  async softDeleteInvoicesByIds(client: PoolClient, invoiceIds: string[], userId: string): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices SET deleted_at = NOW(), updated_by = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
      [userId, invoiceIds],
    )
  }

  async findStatusCounts(companyId: string): Promise<{ verify_count: number; approval_count: number; final_count: number }> {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('DRAFT', 'REJECTED')) AS verify_count,
         COUNT(*) FILTER (WHERE status = 'SUBMITTED') AS approval_count,
         COUNT(*) FILTER (WHERE status = 'APPROVED') AS final_count
       FROM purchase_invoices
       WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId],
    )
    return {
      verify_count: Number(rows[0].verify_count),
      approval_count: Number(rows[0].approval_count),
      final_count: Number(rows[0].final_count),
    }
  }

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
      JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
      JOIN goods_processing_outputs gpo
        ON gpo.goods_processing_id = gpi.goods_processing_id
       AND gpo.input_id = gpi.id
       AND gpo.is_waste = FALSE
      WHERE pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
        AND gpi.status = 'CONFIRMED'
      ORDER BY pil.sort_order, gpo.sort_order, gpo.created_at, gpo.id
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
      journalNumber: string
      sequenceNumber: number
      journalDate: string
      period: string
      currency: string
      journalType: string
      referenceType: string
      referenceId: string
      referenceNumber: string
      description: string
      totalDebit: number
      totalCredit: number
      createdBy: string | null
    },
  ): Promise<{ id: string }> {
    const { rows } = await client.query(
      `
      INSERT INTO journal_headers (
        company_id,
        branch_id,
        journal_number,
        sequence_number,
        journal_type,
        journal_date,
        period,
        description,
        total_debit,
        total_credit,
        currency,
        exchange_rate,
        status,
        source_module,
        reference_type,
        reference_id,
        reference_number,
        is_auto,
        posted_at,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1,
        'POSTED', 'purchase_invoice', $12, $13, $14,
        true, NOW(), $15, NOW(), NOW()
      )
      RETURNING id
      `,
      [
        input.companyId,
        input.branchId,
        input.journalNumber,
        input.sequenceNumber,
        input.journalType,
        input.journalDate,
        input.period,
        input.description,
        input.totalDebit,
        input.totalCredit,
        input.currency,
        input.referenceType,
        input.referenceId,
        input.referenceNumber,
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
      description: string
      /** When set, used for the inventory debit line (e.g. net = subtotal + pre-tax charges). */
      inventoryDebitDescription?: string
    },
  ): Promise<void> {
    let lineNum = 1

    const debitLineDescription = input.inventoryDebitDescription ?? input.description

    if (input.debitAmount > 0) {
      await client.query(
        `
        INSERT INTO journal_lines (
          journal_header_id, line_number, account_id, description,
          debit_amount, credit_amount, base_debit_amount, base_credit_amount
        )
        VALUES ($1, $2, $3, $4, $5, 0, $5, 0)
        `,
        [input.journalHeaderId, lineNum++, input.debitAccountId, debitLineDescription, input.debitAmount],
      )
    }

    if (input.taxAmount > 0) {
      await client.query(
        `
        INSERT INTO journal_lines (
          journal_header_id, line_number, account_id, description,
          debit_amount, credit_amount, base_debit_amount, base_credit_amount
        )
        VALUES ($1, $2, $3, $4, $5, 0, $5, 0)
        `,
        [input.journalHeaderId, lineNum++, input.taxAccountId, 'PPN Masukan', input.taxAmount],
      )
    }

    await client.query(
      `
      INSERT INTO journal_lines (
        journal_header_id, line_number, account_id, description,
        debit_amount, credit_amount, base_debit_amount, base_credit_amount
      )
      VALUES ($1, $2, $3, $4, 0, $5, 0, $5)
      `,
      [input.journalHeaderId, lineNum, input.creditAccountId, 'Hutang Dagang', input.creditAmount],
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
    await this.recalculateGrQtyInvoicedForGrLines(client, invoiceId)
  }

  /** Sum qty_invoiced from all POSTED invoices for GR lines linked to this PI. */
  async recalculateGrQtyInvoicedForGrLines(client: PoolClient, invoiceId: string): Promise<void> {
    await client.query(
      `
      WITH affected AS (
        SELECT DISTINCT pil.gr_line_id
        FROM purchase_invoice_lines pil
        WHERE pil.purchase_invoice_id = $1
          AND pil.deleted_at IS NULL
      ),
      posted_totals AS (
        SELECT pil.gr_line_id,
               SUM(pil.qty_invoiced)::numeric(20,4) AS sum_qty
        FROM purchase_invoice_lines pil
        JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
        WHERE pil.gr_line_id IN (SELECT gr_line_id FROM affected)
          AND pil.deleted_at IS NULL
          AND pi.deleted_at IS NULL
          AND pi.status = 'POSTED'
        GROUP BY pil.gr_line_id
      )
      UPDATE goods_receipt_lines grl
      SET qty_invoiced = COALESCE(pt.sum_qty, 0),
          updated_at = now()
      FROM affected a
      LEFT JOIN posted_totals pt ON pt.gr_line_id = a.gr_line_id
      WHERE grl.id = a.gr_line_id
      `,
      [invoiceId],
    )
  }

  async findUnpostStockPairsForInvoice(
    client: PoolClient,
    invoiceId: string,
  ): Promise<Array<{ product_id: string; warehouse_id: string; stock_movement_id: string }>> {
    const { rows } = await client.query<{
      product_id: string
      warehouse_id: string
      stock_movement_id: string
    }>(
      `
      SELECT DISTINCT gpo.product_id, gpo.warehouse_id, gpo.stock_movement_id
      FROM goods_processing_outputs gpo
      JOIN purchase_invoice_lines pil ON pil.id = gpo.purchase_invoice_line_id
      WHERE pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
        AND gpo.stock_movement_id IS NOT NULL
        AND gpo.warehouse_id IS NOT NULL
      `,
      [invoiceId],
    )
    return rows
  }

  async resetGpOutputCostsForInvoice(client: PoolClient, invoiceId: string): Promise<void> {
    await client.query(
      `
      UPDATE goods_processing_outputs gpo
      SET unit_cost = 0,
          allocated_cost = 0,
          purchase_invoice_line_id = NULL,
          updated_at = now()
      FROM purchase_invoice_lines pil
      WHERE pil.id = gpo.purchase_invoice_line_id
        AND pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
      `,
      [invoiceId],
    )
  }

  async resetStockMovementCostsForInvoice(client: PoolClient, invoiceId: string): Promise<void> {
    await client.query(
      `
      UPDATE stock_movements sm
      SET cost_per_unit = 0,
          total_cost = 0,
          updated_at = now()
      FROM goods_processing_outputs gpo
      JOIN purchase_invoice_lines pil ON pil.id = gpo.purchase_invoice_line_id
      WHERE sm.id = gpo.stock_movement_id
        AND pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
      `,
      [invoiceId],
    )
  }

  async hardDeleteJournal(client: PoolClient, journalId: string): Promise<void> {
    await client.query('DELETE FROM journal_lines WHERE journal_header_id = $1', [journalId])
    await client.query('DELETE FROM journal_headers WHERE id = $1', [journalId])
  }

  async findLatestPostedPiDueDateForPo(client: PoolClient, poId: string): Promise<string | null> {
    const { rows } = await client.query<{ due_date: string | null }>(
      `
      SELECT pi.due_date
      FROM purchase_invoices pi
      JOIN purchase_invoice_gr_links pilg ON pilg.purchase_invoice_id = pi.id
      JOIN goods_receipts gr ON gr.id = pilg.goods_receipt_id
      WHERE gr.po_id = $1
        AND pi.status = 'POSTED'
        AND pi.deleted_at IS NULL
        AND pi.due_date IS NOT NULL
      ORDER BY pi.posted_at DESC NULLS LAST, pi.created_at DESC
      LIMIT 1
      `,
      [poId],
    )
    return rows[0]?.due_date ?? null
  }

  async findPoIdsForInvoice(client: PoolClient, invoiceId: string): Promise<string[]> {
    const { rows } = await client.query<{ po_id: string }>(
      `
      SELECT DISTINCT gr.po_id
      FROM purchase_invoice_gr_links pilg
      JOIN goods_receipts gr ON gr.id = pilg.goods_receipt_id
      WHERE pilg.purchase_invoice_id = $1
        AND gr.po_id IS NOT NULL
      `,
      [invoiceId],
    )
    return rows.map((r) => r.po_id)
  }

  async updatePoPaymentDueDate(client: PoolClient, poId: string, dueDate: string | null): Promise<void> {
    await client.query(
      `UPDATE purchase_orders SET payment_due_date = $1, updated_at = now() WHERE id = $2`,
      [dueDate, poId],
    )
  }

  async isFiscalPeriodOpen(client: PoolClient, companyId: string, date: string): Promise<boolean> {
    const { rows } = await client.query<{ is_open: boolean }>(
      `SELECT is_open FROM fiscal_periods
       WHERE company_id = $1 AND period_start <= $2::date AND period_end >= $2::date
       LIMIT 1`,
      [companyId, date],
    )
    return Boolean(rows[0]?.is_open)
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

  /**
   * PO due date + latest GR received_date per invoice (for payment term display).
   * MIN(po.payment_due_date) = earliest due among linked POs; term is still per-supplier (edge case: multi-PO invoice).
   */
  async findPaymentContextBatch(invoiceIds: string[]): Promise<Map<string, PiPaymentContextRow>> {
    if (invoiceIds.length === 0) return new Map()
    const { rows } = await pool.query<PiPaymentContextRow>(
      `SELECT pilg.purchase_invoice_id AS invoice_id,
              MIN(po.payment_due_date)::text AS po_payment_due_date,
              MAX(gr.received_date)::text AS gr_received_date
       FROM purchase_invoice_gr_links pilg
       JOIN goods_receipts gr ON gr.id = pilg.goods_receipt_id AND gr.deleted_at IS NULL
       JOIN purchase_orders po ON po.id = gr.po_id AND po.deleted_at IS NULL
       WHERE pilg.purchase_invoice_id = ANY($1::uuid[])
       GROUP BY pilg.purchase_invoice_id`,
      [invoiceIds],
    )
    return new Map(rows.map((r) => [r.invoice_id, r]))
  }

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string },
  ): Promise<{ data: PurchaseInvoiceWithRelations[]; total: number }> {

    const conditions = [
      'pi.company_id = $1',
      'pi.deleted_at IS NULL',
      SQL_SUPPLIER_ELIGIBLE_FOR_PI,
    ]
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
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY pi.created_at ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total ${HEADER_FROM} ${where}`,
        params,
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findGpLineAuditsForInvoice(invoiceId: string, client?: PoolClient): Promise<PurchaseInvoiceGpLineAudit[]> {
    const db = client ?? pool
    const { rows } = await db.query(

      `
      SELECT
        pil.id AS purchase_invoice_line_id,
        pil.gr_line_id,
        gpi.id AS gp_input_id,
        gp.id AS goods_processing_id,
        gp.processing_number,
        gp.processing_type,
        gp.status AS gp_header_status,
        p.product_code,
        p.product_name,
        p.requires_processing,
        gpi.status AS gp_line_status,
        gpi.qty_input,
        gpi.uom,
        gpi.processed_at,
        gpi.qc_confirmed_at,
        gpi.rejected_at,
        gpi.rejection_reason,
        emp_proc.full_name AS processed_by_name,
        emp_qc.full_name AS qc_confirmed_by_name,
        emp_rej.full_name AS rejected_by_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'product_name', op.product_name,
                'qty_output', gpo.qty_output,
                'uom', gpo.uom,
                'is_waste', gpo.is_waste
              )
              ORDER BY gpo.sort_order, gpo.id
            )
            FROM goods_processing_outputs gpo
            JOIN products op ON op.id = gpo.product_id
            WHERE gpo.input_id = gpi.id
          ),
          '[]'::json
        ) AS outputs
      FROM purchase_invoice_lines pil
      JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
      JOIN goods_processing gp ON gp.id = gpi.goods_processing_id AND gp.deleted_at IS NULL
      JOIN products p ON p.id = gpi.product_id
      LEFT JOIN employees emp_proc ON emp_proc.user_id = gpi.processed_by
      LEFT JOIN employees emp_qc ON emp_qc.user_id = gpi.qc_confirmed_by
      LEFT JOIN employees emp_rej ON emp_rej.user_id = gpi.rejected_by
      WHERE pil.purchase_invoice_id = $1
        AND pil.deleted_at IS NULL
      ORDER BY gp.processing_number, gpi.sort_order, p.product_name
      `,
      [invoiceId],
    )

    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      qty_input: Number(row.qty_input),
      requires_processing: Boolean(row.requires_processing),
      outputs: Array.isArray(row.outputs)
        ? row.outputs.map((o: Record<string, unknown>) => ({
            ...o,
            qty_output: Number(o.qty_output),
            is_waste: Boolean(o.is_waste),
          }))
        : [],
    })) as PurchaseInvoiceGpLineAudit[]
  }

  async findById(id: string, companyId: string, client?: PoolClient): Promise<PurchaseInvoiceDetail | null> {
    const db = client ?? pool
    const { rows } = await db.query(

      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE pi.id = $1 AND pi.company_id = $2 AND pi.deleted_at IS NULL`,
      [id, companyId],
    )
    const header = rows[0]
    if (!header) return null

    const [linesRes, linksRes, attachmentsRes, gpLineAudits, chargesRes] = await Promise.all([
      db.query<PurchaseInvoiceLine>(

        `SELECT ${LINE_SELECT} ${LINE_FROM}
         WHERE pil.purchase_invoice_id = $1 AND pil.deleted_at IS NULL
         ORDER BY pil.sort_order, pil.created_at ASC`,
        [id],
      ),
      db.query(
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
      db.query(
        `SELECT * FROM purchase_invoice_attachments 
         WHERE purchase_invoice_id = $1 
         ORDER BY uploaded_at DESC`,
        [id],
      ),
      this.findGpLineAuditsForInvoice(id, client),
      db.query<PurchaseInvoiceCharge>(
        `SELECT * FROM purchase_invoice_charges
         WHERE purchase_invoice_id = $1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at ASC`,
        [id],
      ),
    ])

    return {
      ...header,
      gr_links: linksRes.rows,
      lines: linesRes.rows,
      charges: chargesRes.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        tax_rate: Number(r.tax_rate),
        tax_amount: Number(r.tax_amount),
        total: Number(r.total),
        affects_dpp: Boolean((r as { affects_dpp?: boolean }).affects_dpp),
      })),
      attachments: attachmentsRes.rows,
      gp_line_audits: gpLineAudits,
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
    total_charges: number
    total_amount: number
    created_by: string
    due_date?: string | null
  }): Promise<PurchaseInvoice> {
    const { rows } = await client.query<PurchaseInvoice>(
      `INSERT INTO purchase_invoices (
         company_id, supplier_id, branch_id, invoice_number, invoice_date,
         due_date, status, notes,
         subtotal, total_tax, total_charges, total_amount,
         created_by, updated_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10,$11,$12,$12)
       RETURNING *`,
      [
        companyId,
        data.supplier_id,
        data.branch_id,
        data.invoice_number,
        data.invoice_date,
        data.due_date ?? null,
        data.notes,
        data.subtotal,
        data.total_tax,
        data.total_charges,
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

  async replaceCharges(
    client: PoolClient,
    invoiceId: string,
    charges: Array<{
      charge_type: string
      description: string | null
      amount: number
      tax_rate: number
      tax_amount: number
      total: number
      affects_dpp: boolean
      sort_order: number
      created_by: string
      updated_by: string
    }>,
  ): Promise<void> {
    await client.query('DELETE FROM purchase_invoice_charges WHERE purchase_invoice_id = $1 AND deleted_at IS NULL', [
      invoiceId,
    ])
    if (charges.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const c of charges) {
      valueRows.push(
        `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12})`,
      )
      params.push(
        invoiceId,
        c.charge_type,
        c.description,
        c.amount,
        c.tax_rate,
        c.tax_amount,
        c.total,
        c.affects_dpp,
        c.sort_order,
        false,
        null,
        c.created_by,
        c.updated_by,
      )
      idx += 13
    }

    await client.query(
      `INSERT INTO purchase_invoice_charges (
         purchase_invoice_id, charge_type, description,
         amount, tax_rate, tax_amount, total, affects_dpp,
         sort_order, is_deleted, deleted_at,
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

  async assignSupplierBankAccount(
    client: PoolClient,
    invoiceId: string,
    companyId: string,
    supplierBankAccountId: number | null,
    userId: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    await client.query(
      `UPDATE purchase_invoices
       SET supplier_bank_account_id = $1,
           supplier_bank_account_by = $2,
           supplier_bank_account_at = $3,
           updated_at = $3,
           updated_by = $2
       WHERE id = $4 AND company_id = $5 AND deleted_at IS NULL`,
      [supplierBankAccountId, userId, now, invoiceId, companyId],
    )
  }

  async validateSupplierBankForSupplier(
    client: PoolClient,
    supplierBankAccountId: number,
    supplierId: string,
  ): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT 1 FROM bank_accounts
       WHERE id = $1 AND owner_type = 'supplier' AND owner_id = $2
         AND is_active = true AND deleted_at IS NULL LIMIT 1`,
      [supplierBankAccountId, supplierId],
    )
    return rows.length > 0
  }

  async softDelete(client: PoolClient, invoiceId: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices
       SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`,
      [userId, invoiceId, companyId],
    )
  }

  async updateDueDate(client: PoolClient, invoiceId: string, dueDate: string | null): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices SET due_date = $1, updated_at = now() WHERE id = $2`,
      [dueDate, invoiceId],
    )
  }

  async findGrPaymentAnchorDates(client: PoolClient, grIds: string[]): Promise<GrPaymentAnchorDates> {
    if (grIds.length === 0) {
      return { max_received_date: null, min_po_payment_due_date: null }
    }
    const { rows } = await client.query<{
      max_received_date: string | null
      min_po_payment_due_date: string | null
    }>(
      `SELECT MAX(gr.received_date)::text AS max_received_date,
              MIN(po.payment_due_date)::text AS min_po_payment_due_date
       FROM goods_receipts gr
       JOIN purchase_orders po ON po.id = gr.po_id AND po.deleted_at IS NULL
       WHERE gr.id = ANY($1::uuid[]) AND gr.deleted_at IS NULL`,
      [grIds],
    )
    const row = rows[0]
    return {
      max_received_date: row?.max_received_date?.slice(0, 10) ?? null,
      min_po_payment_due_date: row?.min_po_payment_due_date?.slice(0, 10) ?? null,
    }
  }

  async findGrIdsForInvoice(client: PoolClient, invoiceId: string): Promise<string[]> {
    const { rows } = await client.query<{ goods_receipt_id: string }>(
      `SELECT goods_receipt_id FROM purchase_invoice_gr_links WHERE purchase_invoice_id = $1`,
      [invoiceId],
    )
    return rows.map((r) => r.goods_receipt_id)
  }

  async updateDraftHeaderDates(
    client: PoolClient,
    invoiceId: string,
    invoiceDate: string,
    dueDate: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE purchase_invoices SET invoice_date = $1, due_date = $2, updated_at = now() WHERE id = $3`,
      [invoiceDate, dueDate, invoiceId],
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

  async findAvailableGrs(companyId: string, supplierId: string, branchId: string | null) {
    const params: any[] = [companyId, supplierId]
    let branchFilter = ''
    
    if (branchId) {
      params.push(branchId)
      branchFilter = `AND gr.branch_id = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT gr.id, gr.gr_number, gr.received_date, gr.branch_id,
              s.supplier_name,
              COUNT(grl.id)::int AS line_count
       FROM goods_receipts gr
       JOIN purchase_orders po ON po.id = gr.po_id
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN goods_receipt_lines grl ON grl.gr_id = gr.id
       WHERE gr.company_id = $1
         AND gr.status = 'CONFIRMED'
         AND gr.deleted_at IS NULL
         AND po.supplier_id = $2
         ${branchFilter}
         AND (
           grl.qty_received - COALESCE((
             SELECT SUM(pil.qty_invoiced)
             FROM purchase_invoice_lines pil
             JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id
             WHERE pil.gr_line_id = grl.id
               AND pil.deleted_at IS NULL
               AND pi.deleted_at IS NULL
               AND pi.status NOT IN ('REJECTED')
           ), 0)
         ) > 0.01
         AND ${SQL_SUPPLIER_ELIGIBLE_FOR_PI}
       GROUP BY gr.id, gr.gr_number, gr.received_date, gr.branch_id, s.supplier_name
       ORDER BY gr.received_date DESC`,
      params,
    )
    return rows
  }
}

export const purchaseInvoicesRepository = new PurchaseInvoicesRepository()

