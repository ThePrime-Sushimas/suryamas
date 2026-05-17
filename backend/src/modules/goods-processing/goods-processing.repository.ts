import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  GoodsProcessingWithRelations,
  GoodsProcessingDetail,
  GoodsProcessingInputWithProduct,
  GoodsProcessingOutputWithProduct,
  ConditionStatus,
} from './goods-processing.types'
import { productOutputTemplateRepository } from '../products/product-output-template.repository'

const HEADER_SELECT = `
  gp.*,
  b.branch_name, b.branch_code,
  w.warehouse_name,
  gr.gr_number,
  s.supplier_name,
  COALESCE(inp_agg.input_count, 0)::int AS input_count,
  COALESCE(inp_agg.item_names, '{}') AS item_names
`
const HEADER_FROM = `
  FROM goods_processing gp
  JOIN branches b ON b.id = gp.branch_id
  JOIN warehouses w ON w.id = gp.warehouse_id
  JOIN goods_receipts gr ON gr.id = gp.goods_receipt_id
  JOIN purchase_orders po ON po.id = gr.po_id
  JOIN suppliers s ON s.id = po.supplier_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS input_count,
      ARRAY_AGG(p.product_name ORDER BY gpi.sort_order) AS item_names
    FROM goods_processing_inputs gpi
    JOIN products p ON p.id = gpi.product_id
    WHERE gpi.goods_processing_id = gp.id
  ) inp_agg ON true
`

export class GoodsProcessingRepository {
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: { status?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string }
  ): Promise<{ data: GoodsProcessingWithRelations[]; total: number }> {
    const conditions: string[] = ['gp.company_id = $1', 'gp.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.status) {
      const trimmed = filter.status.trim()
      if (trimmed.includes(',')) {
        params.push(trimmed.split(',').map(s => s.trim()))
        conditions.push(`gp.status = ANY($${idx++}::text[])`)
      } else {
        params.push(trimmed)
        conditions.push(`gp.status = $${idx++}`)
      }
    }
    if (filter?.branch_id) {
      params.push(filter.branch_id)
      conditions.push(`gp.branch_id = $${idx++}`)
    } else if (filter?.branch_ids && filter.branch_ids.length > 0) {
      params.push(filter.branch_ids)
      conditions.push(`gp.branch_id = ANY($${idx++}::uuid[])`)
    }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`gp.processing_date >= $${idx++}::date`) }
    if (filter?.date_to)   { params.push(filter.date_to);   conditions.push(`gp.processing_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY gp.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM goods_processing gp ${where}`, params),
    ])

    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<GoodsProcessingWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE gp.id = $1 AND gp.company_id = $2 AND gp.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findDetail(id: string, companyId: string): Promise<GoodsProcessingDetail | null> {
    const header = await this.findById(id, companyId)
    if (!header) return null

    const { rows: inputs } = await pool.query<GoodsProcessingInputWithProduct>(
      `SELECT gpi.*, p.product_code, p.product_name, p.requires_processing,
              emp_proc.full_name AS processed_by_name,
              emp_qc.full_name   AS qc_confirmed_by_name
       FROM goods_processing_inputs gpi
       JOIN products p ON p.id = gpi.product_id
       LEFT JOIN employees emp_proc ON emp_proc.user_id = gpi.processed_by
       LEFT JOIN employees emp_qc   ON emp_qc.user_id   = gpi.qc_confirmed_by
       WHERE gpi.goods_processing_id = $1
       ORDER BY gpi.sort_order`,
      [id]
    )

    const { rows: outputs } = await pool.query<GoodsProcessingOutputWithProduct>(
      `SELECT gpo.*, p.product_code, p.product_name
       FROM goods_processing_outputs gpo
       JOIN products p ON p.id = gpo.product_id
       WHERE gpo.goods_processing_id = $1
       ORDER BY gpo.input_id, gpo.sort_order`,
      [id]
    )

    // Batch-fetch output templates for DISASSEMBLY inputs
    const disassemblyProductIds = inputs
      .filter(inp => inp.requires_processing)
      .map(inp => inp.product_id)

    const templates = disassemblyProductIds.length > 0
      ? await productOutputTemplateRepository.findByProductIds(disassemblyProductIds)
      : {}

    return {
      ...header,
      inputs: inputs.map(inp => ({
        ...inp,
        outputs: outputs.filter(o => o.input_id === inp.id),
        output_template: inp.requires_processing ? (templates[inp.product_id] ?? []) : [],
      })),
    }
  }

  async findByGoodsReceiptId(grId: string, companyId: string): Promise<GoodsProcessingWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM} WHERE gp.goods_receipt_id = $1 AND gp.company_id = $2 AND gp.deleted_at IS NULL`,
      [grId, companyId]
    )
    return rows[0] ?? null
  }

  async generateGpNumber(client: PoolClient, companyId: string, branchCode: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix  = `GP-${branchCode}-${dateStr}`

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${companyId}-${prefix}`])

    const { rows } = await client.query(
      `SELECT processing_number FROM goods_processing
       WHERE company_id = $1 AND processing_number LIKE $2
       ORDER BY processing_number DESC LIMIT 1`,
      [companyId, `${prefix}-%`]
    )

    const lastSeq = rows.length > 0 ? parseInt(rows[0].processing_number.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  async updateStatus(client: PoolClient, id: string, status: string, extra: Record<string, unknown> = {}): Promise<void> {
    const fields: string[] = ['status = $1', 'updated_at = now()']
    const params: unknown[] = [status]
    let idx = 2

    for (const [key, val] of Object.entries(extra)) {
      params.push(val)
      fields.push(`${key} = $${idx++}`)
    }

    params.push(id)
    await client.query(`UPDATE goods_processing SET ${fields.join(', ')} WHERE id = $${idx}`, params)
  }

  async updateHeader(client: PoolClient, id: string, data: { processing_type?: string; notes?: string | null; updated_by?: string }): Promise<void> {
    const fields: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.processing_type !== undefined) { params.push(data.processing_type); fields.push(`processing_type = $${idx++}`) }
    if (data.notes !== undefined)           { params.push(data.notes);           fields.push(`notes = $${idx++}`) }
    if (data.updated_by)                    { params.push(data.updated_by);      fields.push(`updated_by = $${idx++}`) }

    if (params.length === 0) return
    params.push(id)
    await client.query(`UPDATE goods_processing SET ${fields.join(', ')} WHERE id = $${idx}`, params)
  }

  async replaceOutputs(
    client: PoolClient,
    gpId: string,
    inputId: string,
    outputs: {
      product_id: string
      qty_output: number
      uom: string
      is_waste: boolean
      waste_reason?: string | null
      photo_urls?: string[] | null
      condition_status?: ConditionStatus | null
      actual_qty?: number | null
      actual_uom?: string | null
      flagged_for_return?: boolean
      return_reason?: string | null
      sort_order: number
    }[]
  ): Promise<void> {
    await client.query(
      'DELETE FROM goods_processing_outputs WHERE goods_processing_id = $1 AND input_id = $2',
      [gpId, inputId]
    )
    if (outputs.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const o of outputs) {
      valueRows.push(
        `($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, $${idx+13})`
      )
      params.push(
        gpId,
        inputId,
        o.product_id,
        o.qty_output,
        o.uom,
        o.is_waste,
        o.waste_reason ?? null,
        o.photo_urls ?? null,
        o.condition_status ?? null,
        o.actual_qty ?? null,
        o.actual_uom ?? null,
        o.flagged_for_return ?? false,
        o.return_reason ?? null,
        o.sort_order
      )
      idx += 14
    }

    await client.query(
      `INSERT INTO goods_processing_outputs
         (goods_processing_id, input_id, product_id, qty_output, uom,
          is_waste, waste_reason, photo_urls,
          condition_status, actual_qty, actual_uom, flagged_for_return, return_reason,
          sort_order)
       VALUES ${valueRows.join(', ')}`,
      params
    )
  }

  async linkMovementToOutput(client: PoolClient, outputId: string, movementId: string, warehouseId: string): Promise<void> {
    await client.query(
      'UPDATE goods_processing_outputs SET stock_movement_id = $1, warehouse_id = $2 WHERE id = $3',
      [movementId, warehouseId, outputId]
    )
  }

  async resolveReturnOutput(client: PoolClient, outputId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE goods_processing_outputs
       SET flagged_for_return = false,
           return_resolved_at = now(),
           return_resolved_by = $1,
           updated_at = now()
       WHERE id = $2`,
      [userId, outputId]
    )
  }

  // Find pending return items across all confirmed GPs for a company
  async findPendingReturns(companyId: string): Promise<unknown[]> {
    const { rows } = await pool.query(
      `SELECT
         gpo.id AS output_id,
         gpo.goods_processing_id,
         gpo.input_id,
         gpo.product_id,
         p.product_name,
         p.product_code,
         gpo.qty_output,
         gpo.actual_qty,
         gpo.uom,
         gpo.return_reason,
         gpo.condition_status,
         gp.processing_number,
         gp.processing_date,
         b.branch_name
       FROM goods_processing_outputs gpo
       JOIN products p ON p.id = gpo.product_id
       JOIN goods_processing gp ON gp.id = gpo.goods_processing_id
       JOIN branches b ON b.id = gp.branch_id
       WHERE gp.company_id = $1
         AND gpo.flagged_for_return = true
         AND gpo.return_resolved_at IS NULL
         AND gp.deleted_at IS NULL
       ORDER BY gp.processing_date DESC, gpo.created_at DESC`,
      [companyId]
    )
    return rows
  }

  async updateInputStatus(client: PoolClient, inputId: string, status: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE goods_processing_inputs 
       SET status = $1, updated_by = $2, updated_at = now()
       WHERE id = $3`,
      [status, userId, inputId]
    )
  }

  async updateInputOutputs(client: PoolClient, inputId: string, outputs: any[]): Promise<void> {
    // Ambil goods_processing_id dari input
    const { rows: [input] } = await client.query(
      'SELECT goods_processing_id FROM goods_processing_inputs WHERE id = $1',
      [inputId]
    )
    if (!input) throw new Error(`Input ${inputId} not found`)

    // Hapus outputs lama
    await client.query(
      'DELETE FROM goods_processing_outputs WHERE input_id = $1',
      [inputId]
    )
    if (outputs.length === 0) return

    // Insert outputs baru
    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1
    for (const o of outputs) {
      valueRows.push(
        `(${idx}, ${idx+1}, ${idx+2}, ${idx+3}, ${idx+4}, ${idx+5}, ${idx+6}, ${idx+7}, ${idx+8}, ${idx+9}, ${idx+10}, ${idx+11}, ${idx+12}, ${idx+13})`
      )
      params.push(
        input.goods_processing_id,
        inputId,
        o.product_id,
        o.qty_output,
        o.uom,
        o.is_waste,
        o.waste_reason ?? null,
        o.photo_urls ?? null,
        o.condition_status ?? null,
        o.actual_qty ?? null,
        o.actual_uom ?? null,
        o.flagged_for_return ?? false,
        o.return_reason ?? null,
        o.sort_order
      )
      idx += 14
    }

    await client.query(
      `INSERT INTO goods_processing_outputs
         (goods_processing_id, input_id, product_id, qty_output, uom,
          is_waste, waste_reason, photo_urls,
          condition_status, actual_qty, actual_uom, flagged_for_return, return_reason,
          sort_order)
       VALUES ${valueRows.join(', ')}`,
      params
    )
  }
}

export const goodsProcessingRepository = new GoodsProcessingRepository()