import { pool } from '../../config/db'
import type { WasteBranchSourceRow, WasteQueryContext, WasteSource } from './waste-report.types'

function itemFilter(alias: string, ctx: WasteQueryContext, params: unknown[], idx: { n: number }): string {
  const parts: string[] = []
  if (ctx.itemId) {
    params.push(ctx.itemId)
    parts.push(`${alias}.product_id = $${idx.n++}`)
  }
  if (ctx.categoryId) {
    params.push(ctx.categoryId)
    parts.push(`p.category_id = $${idx.n++}`)
  }
  return parts.length ? `AND ${parts.join(' AND ')}` : ''
}

export class WasteReportRepository {
  async getGoodsProcessingWasteRows(ctx: WasteQueryContext) {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const extra = itemFilter('gpo', ctx, params, idx)

    const { rows } = await pool.query(
      `SELECT
        gp.processing_date AS record_date,
        gp.branch_id,
        b.branch_name,
        gpo.product_id AS item_id,
        p.product_name AS item_name,
        COALESCE(gpo.actual_qty, gpo.qty_output, 0)::numeric AS qty,
        COALESCE(gpo.unit_cost, 0)::numeric AS unit_cost,
        COALESCE(
          gpo.allocated_cost,
          COALESCE(gpo.unit_cost, 0) * COALESCE(gpo.actual_qty, gpo.qty_output, 0),
          0
        )::numeric AS total_cost,
        gpo.waste_reason AS reason,
        gpo.id AS reference_id,
        gp.processing_number AS reference_code,
        gp.yield_percentage,
        po.supplier_id,
        gp.id AS goods_processing_id
      FROM goods_processing_outputs gpo
      JOIN goods_processing gp ON gp.id = gpo.goods_processing_id
      JOIN products p ON p.id = gpo.product_id
      JOIN goods_receipts gr ON gr.id = gp.goods_receipt_id
      JOIN purchase_orders po ON po.id = gr.po_id
      JOIN branches b ON b.id = gp.branch_id
      WHERE gpo.is_waste = true
        AND gp.branch_id = ANY($1::uuid[])
        AND gp.processing_date BETWEEN $2::date AND $3::date
        AND gp.deleted_at IS NULL
        AND gp.status = 'CONFIRMED'
        ${extra}
      ORDER BY gp.processing_date DESC, gp.processing_number, gpo.sort_order`,
      params,
    )
    return rows
  }

  async getStockAdjustmentWasteRows(ctx: WasteQueryContext) {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const extra = itemFilter('sal', ctx, params, idx)

    const { rows } = await pool.query(
      `SELECT
        sa.adjustment_date AS record_date,
        sa.branch_id,
        b.branch_name,
        sal.product_id AS item_id,
        p.product_name AS item_name,
        ABS(sal.qty)::numeric AS qty,
        COALESCE(sal.cost_per_unit, 0)::numeric AS unit_cost,
        (ABS(sal.qty) * COALESCE(sal.cost_per_unit, 0))::numeric AS total_cost,
        sa.reason,
        sal.id AS reference_id,
        sa.adjustment_number AS reference_code,
        (sa.journal_id IS NOT NULL) AS has_journal,
        sa.id AS adjustment_id
      FROM stock_adjustments sa
      JOIN stock_adjustment_lines sal ON sal.stock_adjustment_id = sa.id
      JOIN products p ON p.id = sal.product_id
      JOIN branches b ON b.id = sa.branch_id
      WHERE sa.adjustment_type = 'WASTE'
        AND sa.status = 'CONFIRMED'
        AND sa.branch_id = ANY($1::uuid[])
        AND sa.adjustment_date BETWEEN $2::date AND $3::date
        AND sa.deleted_at IS NULL
        ${extra}
      ORDER BY sa.adjustment_date DESC, sa.adjustment_number, sal.sort_order`,
      params,
    )
    return rows
  }

  async getProductionOrderWasteRows(ctx: WasteQueryContext) {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const extraParts: string[] = []
    if (ctx.itemId) {
      params.push(ctx.itemId)
      extraParts.push(`pom.product_id = $${idx.n++}`)
    }
    if (ctx.categoryId) {
      params.push(ctx.categoryId)
      extraParts.push(`p.category_id = $${idx.n++}`)
    }
    const extra = extraParts.length ? `AND ${extraParts.join(' AND ')}` : ''

    // All ProductionOrderStatus values included — DRAFT/VOID shown as provisional/cancelled in metadata
    const { rows } = await pool.query(
      `SELECT
        po.production_date AS record_date,
        po.branch_id,
        b.branch_name,
        pom.product_id AS item_id,
        pom.product_name AS item_name,
        pom.waste_qty::numeric AS qty,
        COALESCE(pom.cost_per_unit, 0)::numeric AS unit_cost,
        (pom.waste_qty * COALESCE(pom.cost_per_unit, 0))::numeric AS total_cost,
        pom.waste_reason AS reason,
        pom.id AS reference_id,
        po.order_number AS reference_code,
        po.status AS order_status,
        pol.wip_id,
        pom.production_order_id,
        pom.production_line_id
      FROM production_order_materials pom
      JOIN production_orders po ON po.id = pom.production_order_id
      JOIN branches b ON b.id = po.branch_id
      LEFT JOIN production_order_lines pol ON pol.id = pom.production_line_id
      LEFT JOIN products p ON p.id = pom.product_id
      WHERE pom.waste_qty > 0
        AND po.branch_id = ANY($1::uuid[])
        AND po.production_date BETWEEN $2::date AND $3::date
        AND po.is_deleted = false
        ${extra}
      ORDER BY po.production_date DESC, po.order_number, pom.sort_order`,
      params,
    )
    return rows
  }

  async getDailyOpnameWasteRows(ctx: WasteQueryContext) {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const extraParts: string[] = []
    if (ctx.itemId) {
      params.push(ctx.itemId)
      extraParts.push(`dccl.product_id = $${idx.n++}`)
    }
    if (ctx.categoryId) {
      params.push(ctx.categoryId)
      extraParts.push(`p.category_id = $${idx.n++}`)
    }
    const extra = extraParts.length ? `AND ${extraParts.join(' AND ')}` : ''

    // Table: variance_classification_lines (daily-stock-opname.sql)
    const { rows } = await pool.query(
      `SELECT
        dcc.closing_date AS record_date,
        dcc.branch_id,
        b.branch_name,
        dccl.product_id AS item_id,
        dccl.product_name AS item_name,
        vcl.qty::numeric AS qty,
        COALESCE(dccl.cost_per_unit, 0)::numeric AS unit_cost,
        (vcl.qty * COALESCE(dccl.cost_per_unit, 0))::numeric AS total_cost,
        vcl.id AS reference_id,
        dcc.opname_number AS reference_code,
        vcl.classified_by,
        vcl.closing_id,
        dcc.position_id
      FROM variance_classification_lines vcl
      JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
      JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN products p ON p.id = dccl.product_id
      WHERE vcl.variance_category = 'WASTE'
        AND dcc.branch_id = ANY($1::uuid[])
        AND dcc.closing_date BETWEEN $2::date AND $3::date
        AND dcc.status IN ('CONFIRMED', 'FLAGGED')
        AND dcc.deleted_at IS NULL
        ${extra}
      ORDER BY dcc.closing_date DESC, dcc.opname_number, dccl.sort_order`,
      params,
    )
    return rows
  }

  async getMonthlyOpnameSelisihRows(ctx: WasteQueryContext) {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const extraParts: string[] = []
    if (ctx.itemId) {
      params.push(ctx.itemId)
      extraParts.push(`msol.product_id = $${idx.n++}`)
    }
    if (ctx.categoryId) {
      params.push(ctx.categoryId)
      extraParts.push(`p.category_id = $${idx.n++}`)
    }
    const extra = extraParts.length ? `AND ${extraParts.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT
        mso.opname_date AS record_date,
        mso.branch_id,
        b.branch_name,
        msol.product_id AS item_id,
        msol.product_name AS item_name,
        msol.selisih_qty::numeric AS selisih_qty,
        COALESCE(msol.selisih_value, 0)::numeric AS selisih_value,
        msol.investigasi_note,
        msol.id AS reference_id,
        mso.opname_number AS reference_code
      FROM monthly_stock_opname_lines msol
      JOIN monthly_stock_opname mso ON mso.id = msol.opname_id
      JOIN branches b ON b.id = mso.branch_id
      LEFT JOIN products p ON p.id = msol.product_id
      WHERE msol.selisih_qty < 0
        AND mso.branch_id = ANY($1::uuid[])
        AND mso.opname_date BETWEEN $2::date AND $3::date
        AND mso.status = 'CONFIRMED'
        AND mso.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM variance_classification_lines vcl
          WHERE vcl.monthly_opname_line_id = msol.id
            AND vcl.source_type = 'MONTHLY_OPNAME'
            AND vcl.variance_category = 'SHORTAGE'
        )
        ${extra}
      ORDER BY mso.opname_date DESC, mso.opname_number, msol.sort_order`,
      params,
    )
    return rows
  }

  async getTotalPurchaseCost(ctx: WasteQueryContext): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(pi.total_amount), 0)::numeric AS total_purchase_cost
       FROM purchase_invoices pi
       WHERE pi.branch_id = ANY($1::uuid[])
         AND pi.invoice_date BETWEEN $2::date AND $3::date
         AND pi.deleted_at IS NULL
         AND pi.status = 'POSTED'`,
      [ctx.branchIds, ctx.startDate, ctx.endDate],
    )
    return Number(rows[0]?.total_purchase_cost ?? 0)
  }

  async getBranchNameMap(branchIds: string[]): Promise<Map<string, string>> {
    if (!branchIds.length) return new Map()
    const { rows } = await pool.query(
      `SELECT id, branch_name FROM branches WHERE id = ANY($1::uuid[])`,
      [branchIds],
    )
    return new Map(rows.map((r) => [r.id as string, r.branch_name as string]))
  }

  async getWasteGroupedByBranch(ctx: WasteQueryContext): Promise<WasteBranchSourceRow[]> {
    const params: unknown[] = [ctx.branchIds, ctx.startDate, ctx.endDate]
    const idx = { n: 4 }
    const gpExtra = itemFilter('gpo', ctx, params, idx)
    const saExtra = itemFilter('sal', ctx, params, idx)

    const poExtraParts: string[] = []
    if (ctx.itemId) {
      params.push(ctx.itemId)
      poExtraParts.push(`pom.product_id = $${idx.n++}`)
    }
    if (ctx.categoryId) {
      params.push(ctx.categoryId)
      poExtraParts.push(`p.category_id = $${idx.n++}`)
    }
    const poExtra = poExtraParts.length ? `AND ${poExtraParts.join(' AND ')}` : ''

    const doExtraParts: string[] = []
    if (ctx.itemId) {
      params.push(ctx.itemId)
      doExtraParts.push(`dccl.product_id = $${idx.n++}`)
    }
    if (ctx.categoryId) {
      params.push(ctx.categoryId)
      doExtraParts.push(`p.category_id = $${idx.n++}`)
    }
    const doExtra = doExtraParts.length ? `AND ${doExtraParts.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT
        branch_id,
        MAX(branch_name) AS branch_name,
        source,
        SUM(qty)::numeric AS total_qty,
        SUM(total_cost)::numeric AS total_cost,
        COUNT(*)::int AS record_count
      FROM (
        SELECT
          gp.branch_id,
          b.branch_name,
          'GOODS_PROCESSING'::text AS source,
          COALESCE(gpo.actual_qty, gpo.qty_output, 0)::numeric AS qty,
          CASE
            WHEN COALESCE(gpo.unit_cost, 0) = 0 THEN 0
            ELSE COALESCE(
              gpo.allocated_cost,
              COALESCE(gpo.unit_cost, 0) * COALESCE(gpo.actual_qty, gpo.qty_output, 0),
              0
            )
          END::numeric AS total_cost
        FROM goods_processing_outputs gpo
        JOIN goods_processing gp ON gp.id = gpo.goods_processing_id
        JOIN products p ON p.id = gpo.product_id
        JOIN goods_receipts gr ON gr.id = gp.goods_receipt_id
        JOIN purchase_orders po ON po.id = gr.po_id
        JOIN branches b ON b.id = gp.branch_id
        WHERE gpo.is_waste = true
          AND gp.branch_id = ANY($1::uuid[])
          AND gp.processing_date BETWEEN $2::date AND $3::date
          AND gp.deleted_at IS NULL
          AND gp.status = 'CONFIRMED'
          ${gpExtra}

        UNION ALL

        SELECT
          sa.branch_id,
          b.branch_name,
          'STOCK_ADJUSTMENT'::text AS source,
          ABS(sal.qty)::numeric AS qty,
          (ABS(sal.qty) * COALESCE(sal.cost_per_unit, 0))::numeric AS total_cost
        FROM stock_adjustments sa
        JOIN stock_adjustment_lines sal ON sal.stock_adjustment_id = sa.id
        JOIN products p ON p.id = sal.product_id
        JOIN branches b ON b.id = sa.branch_id
        WHERE sa.adjustment_type = 'WASTE'
          AND sa.status = 'CONFIRMED'
          AND sa.branch_id = ANY($1::uuid[])
          AND sa.adjustment_date BETWEEN $2::date AND $3::date
          AND sa.deleted_at IS NULL
          ${saExtra}

        UNION ALL

        SELECT
          po.branch_id,
          b.branch_name,
          'PRODUCTION_ORDER'::text AS source,
          pom.waste_qty::numeric AS qty,
          (pom.waste_qty * COALESCE(pom.cost_per_unit, 0))::numeric AS total_cost
        FROM production_order_materials pom
        JOIN production_orders po ON po.id = pom.production_order_id
        JOIN branches b ON b.id = po.branch_id
        LEFT JOIN products p ON p.id = pom.product_id
        WHERE pom.waste_qty > 0
          AND po.branch_id = ANY($1::uuid[])
          AND po.production_date BETWEEN $2::date AND $3::date
          AND po.is_deleted = false
          ${poExtra}

        UNION ALL

        SELECT
          dcc.branch_id,
          b.branch_name,
          'DAILY_OPNAME'::text AS source,
          vcl.qty::numeric AS qty,
          (vcl.qty * COALESCE(dccl.cost_per_unit, 0))::numeric AS total_cost
        FROM variance_classification_lines vcl
        JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
        JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
        JOIN branches b ON b.id = dcc.branch_id
        LEFT JOIN products p ON p.id = dccl.product_id
        WHERE vcl.variance_category = 'WASTE'
          AND dcc.branch_id = ANY($1::uuid[])
          AND dcc.closing_date BETWEEN $2::date AND $3::date
          AND dcc.status IN ('CONFIRMED', 'FLAGGED')
          AND dcc.deleted_at IS NULL
          ${doExtra}
      ) combined
      GROUP BY branch_id, source
      ORDER BY SUM(total_cost) DESC`,
      params,
    )

    return rows.map((row) => ({
      branch_id: row.branch_id as string,
      branch_name: (row.branch_name as string | null) ?? null,
      source: row.source as WasteSource,
      total_qty: Number(row.total_qty) || 0,
      total_cost: Number(row.total_cost) || 0,
      record_count: Number(row.record_count) || 0,
    }))
  }
}

export const wasteReportRepository = new WasteReportRepository()
