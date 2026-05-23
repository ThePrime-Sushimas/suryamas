import { pool } from "../../config/db";
import type { PoolClient } from "pg";
import { queryPoReceiptStatus, type PoReceiptFulfillmentStatus } from "../../utils/po-receipt-status.util";
import type {
  GoodsReceipt,
  GoodsReceiptWithRelations,
  GoodsReceiptLineWithRelations,
  GoodsReceiptWithLines,
  CreateGoodsReceiptLineDto,
} from "./goods-receipts.types";

const HEADER_SELECT = `
  gr.*,
  b.branch_name, b.branch_code,
  po.po_number, s.supplier_name, s.invoice_bypass_reason, s.requires_invoice,
  w.warehouse_name,
  emp.full_name AS created_by_name,
  emp_confirm.full_name AS confirmed_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  COALESCE(lines_agg.total_invoice_amount, 0)::numeric AS total_invoice_amount,
  COALESCE(weighing_agg.weighing_line_count, 0)::int AS weighing_line_count,
  weighing_agg.weighing_summary
`;
const HEADER_FROM = `
  FROM goods_receipts gr
  JOIN branches b ON b.id = gr.branch_id
  JOIN purchase_orders po ON po.id = gr.po_id
  JOIN suppliers s ON s.id = po.supplier_id
  JOIN warehouses w ON w.id = gr.warehouse_id
  LEFT JOIN employees emp ON emp.user_id = gr.created_by
  LEFT JOIN employees emp_confirm ON emp_confirm.user_id = gr.updated_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count, SUM(grl.total_price_invoice) AS total_invoice_amount
    FROM goods_receipt_lines grl WHERE grl.gr_id = gr.id
  ) lines_agg ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (
        WHERE grl.uom_po IS DISTINCT FROM grl.uom_received
           OR COALESCE(grl.conversion_factor, 1) <> 1
      )::int AS weighing_line_count,
      string_agg(
        p.product_name || ' ' || TRIM(to_char(grl.qty_received, 'FM999999990.####')) || ' ' || grl.uom_received,
        ' · ' ORDER BY grl.id
      ) FILTER (
        WHERE grl.uom_po IS DISTINCT FROM grl.uom_received
           OR COALESCE(grl.conversion_factor, 1) <> 1
      ) AS weighing_summary
    FROM goods_receipt_lines grl
    JOIN products p ON p.id = grl.product_id
    WHERE grl.gr_id = gr.id
  ) weighing_agg ON true
`;

const LINE_SELECT = `grl.*, grl.qty_po_uom, grl.uom_po, grl.uom_received, grl.conversion_factor, p.product_code, p.product_name, pol.uom`;
const LINE_FROM = `
  FROM goods_receipt_lines grl
  JOIN products p ON p.id = grl.product_id
  JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
`;

export interface GoodsReceiptAttachment {
  id: string;
  gr_id: string;
  file_type: string;
  file_path: string;
  file_name: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export class GoodsReceiptsRepository {
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

  async findPoSupplierId(client: PoolClient, poId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT supplier_id FROM purchase_orders WHERE id = $1',
      [poId],
    )
    return rows[0]?.supplier_id ?? null
  }

  async findMarketplaceSessionStatusForGr(
    client: PoolClient,
    grId: string,
  ): Promise<'SHIPPED' | 'RECEIVED' | null> {
    const { rows } = await client.query<{ status: string }>(
      `SELECT mcs.status
       FROM goods_receipts gr
       JOIN marketplace_checkout_sessions mcs
         ON mcs.session_number = gr.invoice_number
        AND mcs.company_id = gr.company_id
        AND mcs.deleted_at IS NULL
       WHERE gr.id = $1
         AND gr.source = 'MARKETPLACE'
         AND gr.deleted_at IS NULL`,
      [grId],
    )
    const status = rows[0]?.status
    if (status === 'SHIPPED' || status === 'RECEIVED') return status
    return null
  }

  /** Set session RECEIVED hanya jika semua GR marketplace untuk session_number sudah CONFIRMED. */
  async markMarketplaceSessionReceivedIfComplete(client: PoolClient, userId: string, grId: string): Promise<number> {
    const { rowCount } = await client.query(
      `UPDATE marketplace_checkout_sessions mcs
       SET status = 'RECEIVED',
           updated_by = $1,
           updated_at = now()
       FROM goods_receipts gr
       WHERE gr.id = $2
         AND gr.source = 'MARKETPLACE'
         AND gr.deleted_at IS NULL
         AND mcs.session_number = gr.invoice_number
         AND mcs.company_id = gr.company_id
         AND mcs.status = 'SHIPPED'
         AND mcs.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM goods_receipts gr_pending
           WHERE gr_pending.invoice_number = gr.invoice_number
             AND gr_pending.source = 'MARKETPLACE'
             AND gr_pending.deleted_at IS NULL
             AND gr_pending.status <> 'CONFIRMED'
         )`,
      [userId, grId],
    )
    return rowCount ?? 0
  }

  async hasDisassemblyProducts(client: PoolClient, grId: string): Promise<boolean> {
    const { rows } = await client.query<{ requires_processing: boolean }>(
      `SELECT DISTINCT p.requires_processing
       FROM goods_receipt_lines grl
       JOIN products p ON p.id = grl.product_id
       WHERE grl.gr_id = $1`,
      [grId],
    )
    return rows.some((r) => r.requires_processing)
  }

  async createGoodsProcessingDraft(
    client: PoolClient,
    data: {
      companyId: string
      branchId: string
      warehouseId: string
      grId: string
      gpNumber: string
      receivedDate: string
      processingType: 'DISASSEMBLY' | 'PASS_THROUGH'
      userId: string
    },
  ): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO goods_processing (company_id, branch_id, warehouse_id, goods_receipt_id, processing_number, processing_date, processing_type, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8) RETURNING id`,
      [
        data.companyId,
        data.branchId,
        data.warehouseId,
        data.grId,
        data.gpNumber,
        data.receivedDate,
        data.processingType,
        data.userId,
      ],
    )
    return rows[0].id
  }

  async findProductsRequiresProcessing(client: PoolClient, productIds: string[]): Promise<Map<string, boolean>> {
    if (productIds.length === 0) return new Map()
    const { rows } = await client.query<{ id: string; requires_processing: boolean }>(
      'SELECT id, requires_processing FROM products WHERE id = ANY($1::uuid[])',
      [productIds],
    )
    return new Map(rows.map((r) => [r.id, r.requires_processing]))
  }

  async insertGoodsProcessingInput(
    client: PoolClient,
    gpId: string,
    grLineId: string,
    productId: string,
    qtyInput: number,
    uomInput: string,
  ): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO goods_processing_inputs (goods_processing_id, gr_line_id, product_id, qty_input, uom, sort_order)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
      [gpId, grLineId, productId, qtyInput, uomInput],
    )
    return rows[0].id
  }

  async insertGoodsProcessingOutput(
    client: PoolClient,
    data: {
      gpId: string
      inputId: string
      productId: string
      qtyOutput: number
      uom: string
      sortOrder: number
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO goods_processing_outputs (goods_processing_id, input_id, product_id, qty_output, uom, is_waste, sort_order)
       VALUES ($1, $2, $3, $4, $5, false, $6)`,
      [data.gpId, data.inputId, data.productId, data.qtyOutput, data.uom, data.sortOrder],
    )
  }

  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: {
      status?: string;
      po_id?: string;
      branch_id?: string;
      branch_ids?: string[];
      date_from?: string;
      date_to?: string;
      invoice_number?: string;
      source?: string;
    },
  ): Promise<{ data: GoodsReceiptWithRelations[]; total: number }> {
    const conditions = ["gr.company_id = $1", "gr.deleted_at IS NULL"];
    const params: unknown[] = [companyId];
    let idx = 2;

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`gr.status = $${idx++}`);
    }
    if (filter?.po_id) {
      params.push(filter.po_id);
      conditions.push(`gr.po_id = $${idx++}`);
    }
    if (filter?.branch_id) {
      params.push(filter.branch_id);
      conditions.push(`gr.branch_id = $${idx++}`);
    } else if (filter?.branch_ids && filter.branch_ids.length > 0) {
      params.push(filter.branch_ids);
      conditions.push(`gr.branch_id = ANY($${idx++}::uuid[])`);
    }
    if (filter?.date_from) {
      params.push(filter.date_from);
      conditions.push(`gr.received_date >= $${idx++}::date`);
    }
    if (filter?.date_to) {
      params.push(filter.date_to);
      conditions.push(`gr.received_date <= $${idx++}::date`);
    }
    if (filter?.invoice_number) {
      params.push(filter.invoice_number);
      conditions.push(`gr.invoice_number = $${idx++}`);
    }
    if (filter?.source) {
      params.push(filter.source);
      conditions.push(`gr.source = $${idx++}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY gr.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM goods_receipts gr ${where}`,
        params,
      ),
    ]);
    return { data: dataRes.rows, total: countRes.rows[0].total };
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<GoodsReceiptWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE gr.id = $1 AND gr.company_id = $2 AND gr.deleted_at IS NULL`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async findWithLines(
    id: string,
    companyId: string,
  ): Promise<GoodsReceiptWithLines | null> {
    const header = await this.findById(id, companyId);
    if (!header) return null;
    const { rows: lines } = await pool.query(
      `SELECT ${LINE_SELECT} ${LINE_FROM} WHERE grl.gr_id = $1`,
      [id],
    );
    return { ...header, lines };
  }

  async create(
    client: PoolClient,
    companyId: string,
    data: {
      branch_id: string;
      po_id: string;
      warehouse_id: string;
      gr_number: string;
      received_date?: string;
      invoice_number?: string | null;
      invoice_date?: string | null;
      notes?: string | null;
      created_by?: string;
      source?: string;
      status?: string;
    },
  ): Promise<GoodsReceipt> {
    const { rows } = await client.query(
      `INSERT INTO goods_receipts (company_id, branch_id, po_id, warehouse_id, gr_number, received_date, invoice_number, invoice_date, notes, created_by, updated_by, source, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8, $9, $10, $10, COALESCE($11, 'SUPPLIER'), COALESCE($12, 'DRAFT')) RETURNING *`,
      [
        companyId,
        data.branch_id,
        data.po_id,
        data.warehouse_id,
        data.gr_number,
        data.received_date ?? null,
        data.invoice_number ?? null,
        data.invoice_date ?? null,
        data.notes ?? null,
        data.created_by ?? null,
        data.source ?? null,
        data.status ?? null,
      ],
    );
    return rows[0];
  }

  async insertLines(
    client: PoolClient,
    grId: string,
    lines: (CreateGoodsReceiptLineDto & {
      uom_po: string;
      conversion_factor: number;
      unit_price_po: number;
      price_variance: number;
      price_variance_pct: number;
      variance_status: string;
      reject_reason?: string | null; // tambah ini
    })[],
  ): Promise<void> {
    if (lines.length === 0) return;
    const valueRows: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const l of lines) {
      const qtyPoUom = l.qty_po_uom ?? l.qty_received;
      const qtyAccepted = qtyPoUom - (l.qty_rejected ?? 0);
      const totalInvoice = qtyAccepted * l.unit_price_invoice;
      valueRows.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15}, $${idx + 16})`,
      );
      params.push(
        grId,
        l.po_line_id,
        l.product_id,
        qtyPoUom,
        l.uom_po,
        l.qty_received,
        l.uom_received ?? l.uom_po,
        l.conversion_factor,
        l.unit_price_invoice,
        totalInvoice,
        l.unit_price_po,
        l.price_variance,
        l.price_variance_pct,
        l.variance_status,
        l.notes ?? null,
        l.qty_rejected ?? 0,
        l.reject_reason ?? null, // +1 param
      );
      idx += 17; // 16 → 17
    }

    await client.query(
      `INSERT INTO goods_receipt_lines (gr_id, po_line_id, product_id, qty_po_uom, uom_po, qty_received, uom_received, conversion_factor, unit_price_invoice, total_price_invoice, unit_price_po, price_variance, price_variance_pct, variance_status, notes, qty_rejected, reject_reason)
       VALUES ${valueRows.join(", ")}`,
      params,
    );
  }

  async updateStatus(
    client: PoolClient,
    id: string,
    status: string,
    extra?: { journal_id?: string; updated_by?: string },
  ): Promise<void> {
    const fields = ["status = $1", "updated_at = now()"];
    const params: unknown[] = [status];
    let idx = 2;

    if (extra?.journal_id) {
      params.push(extra.journal_id);
      fields.push(`journal_id = $${idx++}`);
    }
    if (extra?.updated_by) {
      params.push(extra.updated_by);
      fields.push(`updated_by = $${idx++}`);
    }

    params.push(id);
    await client.query(
      `UPDATE goods_receipts SET ${fields.join(", ")} WHERE id = $${idx}`,
      params,
    );
  }

  async generateGrNumber(
    client: PoolClient,
    companyId: string,
    branchCode: string,
  ): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `GR-${branchCode}-${dateStr}`;

    // Advisory lock using Postgres hashtext for proper distribution
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${companyId}-${prefix}`,
    ]);

    const { rows } = await client.query(
      `SELECT gr_number FROM goods_receipts WHERE company_id = $1 AND gr_number LIKE $2 ORDER BY gr_number DESC LIMIT 1`,
      [companyId, `${prefix}-%`],
    );

    const lastSeq =
      rows.length > 0 ? parseInt(rows[0].gr_number.split("-").pop() || "0") : 0;
    return `${prefix}-${String(lastSeq + 1).padStart(3, "0")}`;
  }

  // ── Attachments ──

  async findAttachments(grId: string): Promise<GoodsReceiptAttachment[]> {
    const { rows } = await pool.query(
      "SELECT * FROM goods_receipt_attachments WHERE gr_id = $1 ORDER BY uploaded_at DESC",
      [grId],
    );
    return rows;
  }

  async insertAttachment(
    grId: string,
    data: {
      file_type: string;
      file_path: string;
      file_name: string | null;
      uploaded_by: string | null;
    },
  ): Promise<GoodsReceiptAttachment> {
    const { rows } = await pool.query(
      `INSERT INTO goods_receipt_attachments (gr_id, file_type, file_path, file_name, uploaded_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [grId, data.file_type, data.file_path, data.file_name, data.uploaded_by],
    );
    return rows[0];
  }

  async deleteAttachment(attachmentId: string, grId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      "DELETE FROM goods_receipt_attachments WHERE id = $1 AND gr_id = $2",
      [attachmentId, grId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Soft-delete draft GR. Audit actor: updated_by (goods_receipts has no deleted_by column). */
  async softDelete(
    id: string,
    companyId: string,
    userId?: string,
  ): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE goods_receipts SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL AND status = 'DRAFT'`,
      [userId ?? null, id, companyId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Same audit fields as softDelete — used when PO is cancelled. */
  async softDeleteDraftsByPoId(
    poId: string,
    companyId: string,
    userId: string,
    client?: PoolClient,
  ): Promise<number> {
    const db = client ?? pool;
    const { rowCount } = await db.query(
      `UPDATE goods_receipts SET deleted_at = now(), is_deleted = true, updated_by = $1
       WHERE po_id = $2 AND company_id = $3 AND status = 'DRAFT' AND deleted_at IS NULL`,
      [userId, poId, companyId],
    );
    return rowCount ?? 0;
  }

  // ── PO Validation Helpers ──

  async findPoForGr(
    poId: string,
    companyId: string,
  ): Promise<{
    id: string;
    status: string;
    branch_id: string;
    branch_code: string;
    supplier_id: string;
    supplier_name: string;
    invoice_bypass_reason: 'marketplace' | 'cash' | 'informal' | null;
  } | null> {
    const { rows } = await pool.query(
      `SELECT po.id, po.status, po.branch_id, po.supplier_id, b.branch_code,
              s.supplier_name, s.invoice_bypass_reason
       FROM purchase_orders po
       JOIN branches b ON b.id = po.branch_id
       JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
      [poId, companyId],
    );
    return rows[0] ?? null;
  }

  async findWarehouse(
    warehouseId: string,
    companyId: string,
  ): Promise<{ id: string } | null> {
    const { rows } = await pool.query(
      "SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [warehouseId, companyId],
    );
    return rows[0] ?? null;
  }

  async findPoLines(
    poId: string,
  ): Promise<
    Array<{
      id: string;
      product_id: string;
      qty: number;
      qty_received: number;
      qty_short_closed: number;
      unit_price: number;
      uom: string;
      product_name: string;
    }>
  > {
    const { rows } = await pool.query(
      `SELECT pol.id, pol.product_id, pol.qty::numeric AS qty, pol.qty_received::numeric AS qty_received, pol.qty_short_closed::numeric AS qty_short_closed, pol.unit_price::numeric AS unit_price, pol.uom, p.product_name
       FROM purchase_order_lines pol
       JOIN products p ON p.id = pol.product_id
       WHERE pol.po_id = $1`,
      [poId],
    );
    return rows.map((r) => ({
      ...r,
      qty: Number(r.qty),
      qty_received: Number(r.qty_received),
      qty_short_closed: Number(r.qty_short_closed),
      unit_price: Number(r.unit_price),
    }));
  }

  async findPoLinesBasic(
    poId: string,
  ): Promise<Array<{ id: string; qty: number; qty_received: number; qty_short_closed: number }>> {
    const { rows } = await pool.query(
      "SELECT id, qty::numeric AS qty, qty_received::numeric AS qty_received, qty_short_closed::numeric AS qty_short_closed FROM purchase_order_lines WHERE po_id = $1",
      [poId],
    );
    return rows.map((r) => ({
      ...r,
      qty: Number(r.qty),
      qty_received: Number(r.qty_received),
      qty_short_closed: Number(r.qty_short_closed),
    }));
  }

  async findPoLinesForUpdate(
    client: PoolClient,
    poId: string,
  ): Promise<Array<{ id: string; qty: number; qty_received: number; qty_short_closed: number }>> {
    const { rows } = await client.query(
      "SELECT id, qty::numeric AS qty, qty_received::numeric AS qty_received, qty_short_closed::numeric AS qty_short_closed FROM purchase_order_lines WHERE po_id = $1 FOR UPDATE",
      [poId],
    );
    return rows.map((r) => ({
      ...r,
      qty: Number(r.qty),
      qty_received: Number(r.qty_received),
      qty_short_closed: Number(r.qty_short_closed),
    }));
  }

  async findPendingQtyByPo(
    poId: string,
    excludeGrId?: string,
    client?: PoolClient,
  ): Promise<Map<string, number>> {
    const db = client ?? pool;
    const params: unknown[] = [poId];
    let excludeClause = "";
    if (excludeGrId) {
      excludeClause = " AND gr.id != $2";
      params.push(excludeGrId);
    }
    const { rows } = await db.query(
      `SELECT grl.po_line_id, SUM(grl.qty_po_uom - COALESCE(grl.qty_rejected, 0))::numeric AS pending_qty
       FROM goods_receipt_lines grl
       JOIN goods_receipts gr ON gr.id = grl.gr_id
       WHERE gr.po_id = $1 AND gr.status = 'DRAFT' AND gr.deleted_at IS NULL${excludeClause}
       GROUP BY grl.po_line_id`,
      params,
    );
    return new Map(rows.map((r) => [r.po_line_id, Number(r.pending_qty)]));
  }

  async incrementPoLineQtyReceived(
    client: PoolClient,
    poLineId: string,
    qty: number,
  ): Promise<void> {
    await client.query(
      "UPDATE purchase_order_lines SET qty_received = qty_received + $1 WHERE id = $2",
      [qty, poLineId],
    );
  }

  async resolvePoStatus(client: PoolClient, poId: string): Promise<PoReceiptFulfillmentStatus> {
    return queryPoReceiptStatus(poId, client);
  }

  /**
   * Satu draft GR aktif per PO (semua source).
   * ORDER BY created_at DESC — draft terbaru yang dianggap kanonik (edge case: sisa draft lama).
   */
  async findOpenDraftForPo(
    companyId: string,
    poId: string,
    client?: PoolClient,
  ): Promise<{ id: string; gr_number: string; source: string } | null> {
    const db = client ?? pool;
    const { rows } = await db.query<{ id: string; gr_number: string; source: string }>(
      `SELECT gr.id, gr.gr_number, gr.source
       FROM goods_receipts gr
       WHERE gr.company_id = $1
         AND gr.po_id = $2
         AND gr.status = 'DRAFT'
         AND gr.deleted_at IS NULL
       ORDER BY gr.created_at DESC
       LIMIT 1`,
      [companyId, poId],
    );
    return rows[0] ?? null;
  }

  async findOpenPendingDraftGrId(
    client: PoolClient,
    companyId: string,
    poId: string,
  ): Promise<string | null> {
    const draft = await this.findOpenDraftForPo(companyId, poId, client);
    return draft?.id ?? null;
  }

  async findMainWarehouseId(
    client: PoolClient,
    branchId: string,
    companyId: string,
  ): Promise<string | null> {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM warehouses
       WHERE branch_id = $1 AND company_id = $2 AND deleted_at IS NULL
       ORDER BY CASE WHEN warehouse_type = 'MAIN' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [branchId, companyId],
    );
    return rows[0]?.id ?? null;
  }

  async updatePoStatus(
    client: PoolClient,
    poId: string,
    status: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      "UPDATE purchase_orders SET status = $1, updated_at = now(), updated_by = $2 WHERE id = $3",
      [status, userId, poId],
    );
  }

  async updateHeader(
    client: PoolClient,
    id: string,
    companyId: string,
    data: {
      warehouse_id?: string | null;
      received_date?: string | null;
      invoice_number?: string | null;
      invoice_date?: string | null;
      notes?: string | null;
      updated_by: string;
    },
  ): Promise<void> {
    await client.query(
      `UPDATE goods_receipts SET
        warehouse_id = COALESCE($1, warehouse_id),
        received_date = COALESCE($2::date, received_date),
        invoice_number = $3,
        invoice_date = $4::date,
        notes = $5,
        updated_by = $6, updated_at = now()
      WHERE id = $7 AND company_id = $8 AND status = 'DRAFT'`,
      [
        data.warehouse_id ?? null,
        data.received_date ?? null,
        data.invoice_number ?? null,
        data.invoice_date ?? null,
        data.notes ?? null,
        data.updated_by,
        id,
        companyId,
      ],
    );
  }

  async findPoLinePrices(
    client: PoolClient,
    poLineIds: string[],
  ): Promise<Map<string, number>> {
    const { rows } = await client.query(
      "SELECT id, unit_price::numeric FROM purchase_order_lines WHERE id = ANY($1::uuid[])",
      [poLineIds],
    );
    return new Map(rows.map((r) => [r.id, Number(r.unit_price)]));
  }

  async replaceLines(
    client: PoolClient,
    grId: string,
    lines: Array<{
      po_line_id: string;
      product_id: string;
      qty_po_uom: number;
      uom_po: string;
      qty_received: number;
      uom_received: string;
      conversion_factor: number;
      unit_price_invoice: number;
      unit_price_po: number;
      price_variance: number;
      price_variance_pct: number;
      variance_status: string;
      qty_rejected?: number;
      reject_reason?: string | null;
      notes?: string | null;
    }>,
  ): Promise<void> {
    await client.query("DELETE FROM goods_receipt_lines WHERE gr_id = $1", [
      grId,
    ]);

    if (lines.length === 0) return;
    const valueRows: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    // AFTER
    for (const l of lines) {
      const qtyPoUom = l.qty_po_uom ?? l.qty_received;
      const qtyAccepted = qtyPoUom - (l.qty_rejected ?? 0);
      const totalInvoice = qtyAccepted * l.unit_price_invoice;
      valueRows.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15}, $${idx + 16})`,
      );
      params.push(
        grId,
        l.po_line_id,
        l.product_id,
        qtyPoUom,
        l.uom_po,
        l.qty_received,
        l.uom_received ?? l.uom_po,
        l.conversion_factor,
        l.unit_price_invoice,
        totalInvoice,
        l.unit_price_po,
        l.price_variance,
        l.price_variance_pct,
        l.variance_status,
        l.notes ?? null,
        l.qty_rejected ?? 0,
        l.reject_reason ?? null, // +1 param
      );
      idx += 17; // 16 → 17
    }

    await client.query(
      `INSERT INTO goods_receipt_lines (gr_id, po_line_id, product_id, qty_po_uom, uom_po, qty_received, uom_received, conversion_factor, unit_price_invoice, total_price_invoice, unit_price_po, price_variance, price_variance_pct, variance_status, notes, qty_rejected, reject_reason)
   VALUES ${valueRows.join(", ")}`,
      params,
    );
  }
}

export const goodsReceiptsRepository = new GoodsReceiptsRepository();
