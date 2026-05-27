import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'
import type {
  ProductionOrder, ProductionOrderWithBranch, ProductionOrderWithDetails,
  ProductionOrderLine, ProductionOrderMaterial,
  MaterialUsageSummary, DailySummary
} from './production-orders.types'

export class ProductionOrdersRepository {
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

  async userHasBranchAccess(userId: string, branchId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM employee_branches eb
       JOIN employees e ON e.id = eb.employee_id
       WHERE e.user_id = $1 AND eb.branch_id = $2 AND eb.status = 'active'
       LIMIT 1`,
      [userId, branchId],
    )
    return rows.length > 0
  }

  async findBranchCode(client: PoolClient, branchId: string): Promise<string | null> {
    const { rows } = await client.query(`SELECT branch_code FROM branches WHERE id = $1`, [branchId])
    return rows[0]?.branch_code ?? null
  }

  async productionOrderNumberExists(
    client: PoolClient,
    companyId: string,
    orderNumber: string,
  ): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT 1 FROM production_orders WHERE company_id = $1 AND order_number = $2`,
      [companyId, orderNumber],
    )
    return rows.length > 0
  }

  async findProductAverageCost(client: PoolClient, productId: string): Promise<number> {
    const { rows } = await client.query(
      `SELECT average_cost FROM products WHERE id = $1`,
      [productId],
    )
    return Number(rows[0]?.average_cost ?? 0)
  }

  async findOpenFiscalPeriod(companyId: string, productionDate: string): Promise<{ period: string } | null> {
    const { rows } = await pool.query(
      `SELECT period FROM fiscal_periods
       WHERE company_id = $1 AND is_open = true
         AND period_start <= $2::date AND period_end >= $2::date
       LIMIT 1`,
      [companyId, productionDate],
    )
    return rows[0] ? { period: rows[0].period as string } : null
  }

  async findCoaByCode(
    companyId: string,
    accountCode: string,
  ): Promise<{ id: string; account_name: string } | null> {
    const { rows } = await pool.query(
      `SELECT id, account_name FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 LIMIT 1`,
      [companyId, accountCode],
    )
    return rows[0] ?? null
  }

  async getNextJournalSequence(client: PoolClient, companyId: string, period: string): Promise<number> {
    const { rows } = await client.query(
      `SELECT get_next_journal_sequence($1, $2, 'GENERAL'::journal_type_enum) AS seq`,
      [companyId, period],
    )
    return Number(rows[0].seq)
  }

  async insertProductionJournalHeader(
    client: PoolClient,
    data: {
      companyId: string
      branchId: string
      journalNumber: string
      sequenceNumber: number
      journalDate: string
      period: string
      description: string
      totalAmount: number
      referenceId: string
      referenceNumber: string
      createdBy: string | null
    },
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO journal_headers (
         company_id, branch_id, journal_number, sequence_number,
         journal_type, journal_date, period, description,
         total_debit, total_credit, currency, exchange_rate,
         status, source_module, reference_type, reference_id, reference_number,
         is_auto, posted_at, created_by, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, $7, $8, $8, 'IDR', 1,
         'POSTED', 'food_production', 'production_order', $9, $10,
         true, NOW(), $11, NOW(), NOW())
       RETURNING id`,
      [
        data.companyId,
        data.branchId,
        data.journalNumber,
        data.sequenceNumber,
        data.journalDate,
        data.period,
        data.description,
        data.totalAmount,
        data.referenceId,
        data.referenceNumber,
        data.createdBy,
      ],
    )
    return rows[0].id as string
  }

  async insertJournalLine(
    client: PoolClient,
    data: {
      journalHeaderId: string
      lineNumber: number
      accountId: string
      description: string
      debitAmount: number
      creditAmount: number
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $5, $6)`,
      [
        data.journalHeaderId,
        data.lineNumber,
        data.accountId,
        data.description,
        data.debitAmount,
        data.creditAmount,
      ],
    )
  }

  async findJournalLinesByHeaderId(
    client: PoolClient,
    journalHeaderId: string,
  ): Promise<Array<{ account_id: string; description: string; debit_amount: number; credit_amount: number }>> {
    const { rows } = await client.query(
      `SELECT account_id, description, debit_amount, credit_amount
       FROM journal_lines WHERE journal_header_id = $1 ORDER BY line_number`,
      [journalHeaderId],
    )
    return rows
  }

  async findJournalPeriod(client: PoolClient, journalHeaderId: string): Promise<string | null> {
    const { rows } = await client.query(
      `SELECT period FROM journal_headers WHERE id = $1`,
      [journalHeaderId],
    )
    return rows[0]?.period ?? null
  }

  async insertReversalJournalHeader(
    client: PoolClient,
    data: {
      companyId: string
      branchId: string
      journalNumber: string
      sequenceNumber: number
      journalDate: string
      period: string
      description: string
      totalAmount: number
      referenceId: string
      referenceNumber: string
      createdBy: string
      reversalOfJournalId: string
    },
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO journal_headers (
         company_id, branch_id, journal_number, sequence_number,
         journal_type, journal_date, period, description,
         total_debit, total_credit, currency, exchange_rate,
         status, source_module, reference_type, reference_id, reference_number,
         is_auto, posted_at, created_by, created_at, updated_at, reversal_of_journal_id
       ) VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, $7, $8, $8, 'IDR', 1,
         'POSTED', 'food_production', 'production_order', $9, $10,
         true, NOW(), $11, NOW(), NOW(), $12)
       RETURNING id`,
      [
        data.companyId,
        data.branchId,
        data.journalNumber,
        data.sequenceNumber,
        data.journalDate,
        data.period,
        data.description,
        data.totalAmount,
        data.referenceId,
        data.referenceNumber,
        data.createdBy,
        data.reversalOfJournalId,
      ],
    )
    return rows[0].id as string
  }

  async markJournalAsReversed(
    client: PoolClient,
    reversalJournalId: string,
    reason: string,
    originalJournalId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE journal_headers SET is_reversed = true, reversed_by_journal_id = $1, reversal_date = NOW(), reversal_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [reversalJournalId, reason, originalJournalId],
    )
  }

  // ─── List ───

  async findAll(
    companyIds: string[],
    pagination: { limit: number; offset: number },
    filter?: { branch_id?: string; status?: string; date_from?: string; date_to?: string }
  ): Promise<{ data: ProductionOrderWithBranch[]; total: number }> {
    const conditions = ['po.company_id = ANY($1::uuid[])', 'po.is_deleted = false']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`po.branch_id = $${idx++}`) }
    if (filter?.status) { params.push(filter.status); conditions.push(`po.status = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`po.production_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`po.production_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT po.*, b.branch_name, e.full_name AS created_by_name,
                COALESCE(est.total_estimated_cost, 0)::numeric AS total_estimated_cost
         FROM production_orders po
         JOIN branches b ON b.id = po.branch_id
         LEFT JOIN employees e ON e.user_id = po.created_by
         LEFT JOIN LATERAL (
           SELECT SUM(pol.cost_per_batch * pol.planned_batch_qty) AS total_estimated_cost
           FROM production_order_lines pol
           WHERE pol.production_order_id = po.id
         ) est ON true
         ${where}
         ORDER BY po.production_date DESC, po.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM production_orders po ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  // ─── Get by ID (with details) ───

  async findByIdAccessible(id: string, companyIds: string[]): Promise<ProductionOrderWithDetails | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT po.*, b.branch_name
       FROM production_orders po
       JOIN branches b ON b.id = po.branch_id
       WHERE po.id = $1 AND po.company_id = ANY($2::uuid[]) AND po.is_deleted = false`,
      [id, companyIds]
    )
    if (!rows[0]) return null
    return this.loadOrderDetails(rows[0] as ProductionOrderWithDetails, id)
  }

  async findById(id: string, companyId: string): Promise<ProductionOrderWithDetails | null> {
    const { rows } = await pool.query(
      `SELECT po.*, b.branch_name
       FROM production_orders po
       JOIN branches b ON b.id = po.branch_id
       WHERE po.id = $1 AND po.company_id = $2 AND po.is_deleted = false`,
      [id, companyId]
    )
    if (!rows[0]) return null
    return this.loadOrderDetails(rows[0] as ProductionOrderWithDetails, id)
  }

  private async loadOrderDetails(order: ProductionOrderWithDetails, id: string): Promise<ProductionOrderWithDetails> {

    const linesRes = await pool.query(
      `SELECT * FROM production_order_lines WHERE production_order_id = $1 ORDER BY sort_order, created_at`,
      [id]
    )

    const materialsRes = await pool.query(
      `SELECT * FROM production_order_materials WHERE production_order_id = $1 ORDER BY sort_order, created_at`,
      [id]
    )

    const materialsByLine = new Map<string, ProductionOrderMaterial[]>()
    for (const mat of materialsRes.rows) {
      const arr = materialsByLine.get(mat.production_line_id) || []
      arr.push(mat)
      materialsByLine.set(mat.production_line_id, arr)
    }

    order.lines = linesRes.rows.map((line: ProductionOrderLine) => ({
      ...line,
      materials: materialsByLine.get(line.id) || [],
    }))

    return order
  }

  // ─── Insert ───

  async insertHeader(client: PoolClient, data: {
    company_id: string; branch_id: string; order_number: string;
    production_date: string; notes?: string; created_by?: string
  }): Promise<ProductionOrder> {
    const { rows } = await client.query(
      `INSERT INTO production_orders (company_id, branch_id, order_number, production_date, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [data.company_id, data.branch_id, data.order_number, data.production_date, data.notes || null, data.created_by || null]
    )
    return rows[0]
  }

  async insertLine(client: PoolClient, data: {
    production_order_id: string; wip_id: string; wip_name: string; wip_code: string;
    yield_per_batch: number; uom: string; cost_per_batch: number;
    planned_batch_qty: number; sort_order: number
  }): Promise<ProductionOrderLine> {
    const { rows } = await client.query(
      `INSERT INTO production_order_lines
       (production_order_id, wip_id, wip_name, wip_code, yield_per_batch, uom, cost_per_batch, planned_batch_qty, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data.production_order_id, data.wip_id, data.wip_name, data.wip_code,
       data.yield_per_batch, data.uom, data.cost_per_batch, data.planned_batch_qty, data.sort_order]
    )
    return rows[0]
  }

  async insertMaterial(client: PoolClient, data: {
    production_order_id: string; production_line_id: string; product_id: string;
    product_name: string; product_code: string; planned_qty: number;
    uom: string; cost_per_unit: number; cost_source: string; sort_order: number
  }): Promise<ProductionOrderMaterial> {
    const { rows } = await client.query(
      `INSERT INTO production_order_materials
       (production_order_id, production_line_id, product_id, product_name, product_code, planned_qty, uom, cost_per_unit, cost_source, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [data.production_order_id, data.production_line_id, data.product_id,
       data.product_name, data.product_code, data.planned_qty, data.uom,
       data.cost_per_unit, data.cost_source, data.sort_order]
    )
    return rows[0]
  }

  // ─── Update (Complete) ───

  async updateLine(client: PoolClient, id: string, data: {
    actual_batch_qty: number; total_yield: number; total_cost: number
  }): Promise<void> {
    await client.query(
      `UPDATE production_order_lines SET actual_batch_qty = $2, total_yield = $3, total_cost = $4 WHERE id = $1`,
      [id, data.actual_batch_qty, data.total_yield, data.total_cost]
    )
  }

  async updateMaterial(client: PoolClient, id: string, data: {
    actual_qty: number; waste_qty: number; waste_reason: string | null; total_cost: number
  }): Promise<void> {
    await client.query(
      `UPDATE production_order_materials SET actual_qty = $2, waste_qty = $3, waste_reason = $4, total_cost = $5 WHERE id = $1`,
      [id, data.actual_qty, data.waste_qty, data.waste_reason, data.total_cost]
    )
  }

  async updateHeaderStatus(client: PoolClient, id: string, data: {
    status: string; total_material_cost?: number; total_waste_cost?: number;
    completed_by?: string; completed_at?: Date;
    voided_by?: string; voided_at?: Date; void_reason?: string;
    journal_id?: string; updated_by?: string
  }): Promise<void> {
    const sets = ['status = $2', 'updated_at = now()']
    const params: unknown[] = [id, data.status]
    let idx = 3

    if (data.total_material_cost !== undefined) { sets.push(`total_material_cost = $${idx}`); params.push(data.total_material_cost); idx++ }
    if (data.total_waste_cost !== undefined) { sets.push(`total_waste_cost = $${idx}`); params.push(data.total_waste_cost); idx++ }
    if (data.completed_by) { sets.push(`completed_by = $${idx}`); params.push(data.completed_by); idx++ }
    if (data.completed_at) { sets.push(`completed_at = $${idx}`); params.push(data.completed_at); idx++ }
    if (data.voided_by) { sets.push(`voided_by = $${idx}`); params.push(data.voided_by); idx++ }
    if (data.voided_at) { sets.push(`voided_at = $${idx}`); params.push(data.voided_at); idx++ }
    if (data.void_reason) { sets.push(`void_reason = $${idx}`); params.push(data.void_reason); idx++ }
    if (data.journal_id) { sets.push(`journal_id = $${idx}`); params.push(data.journal_id); idx++ }
    if (data.updated_by) { sets.push(`updated_by = $${idx}`); params.push(data.updated_by); idx++ }

    await client.query(`UPDATE production_orders SET ${sets.join(', ')} WHERE id = $1`, params)
  }

  // ─── Soft Delete ───

  async softDelete(id: string, companyId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE production_orders SET is_deleted = true, deleted_at = now(), deleted_by = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND is_deleted = false AND status = 'DRAFT'`,
      [id, companyId, userId]
    )
    return (rowCount ?? 0) > 0
  }

  // ─── Order Number ───

  async getLastOrderNumber(companyId: string, prefix: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT order_number FROM production_orders
       WHERE company_id = $1 AND order_number LIKE $2
       ORDER BY order_number DESC LIMIT 1`,
      [companyId, `${prefix}-%`]
    )
    return rows[0]?.order_number ?? null
  }

  // ─── Reports ───

  async getDailySummary(companyIds: string[], dateFrom: string, dateTo: string, branchId?: string): Promise<DailySummary[]> {
    const conditions = ['po.company_id = ANY($1::uuid[])', 'po.production_date BETWEEN $2 AND $3', "po.status IN ('COMPLETED', 'JOURNALED')", 'po.is_deleted = false']
    const params: unknown[] = [companyIds, dateFrom, dateTo]

    if (branchId) { params.push(branchId); conditions.push(`po.branch_id = $${params.length}`) }

    const { rows } = await pool.query(`
      SELECT
        po.production_date,
        po.branch_id,
        b.branch_name,
        COUNT(DISTINCT po.id)::int AS order_count,
        COALESCE(SUM(lines_agg.total_batches), 0)::numeric AS total_batches,
        SUM(po.total_material_cost)::numeric AS total_cost,
        SUM(po.total_waste_cost)::numeric AS total_waste_cost
      FROM production_orders po
      JOIN branches b ON b.id = po.branch_id
      LEFT JOIN (
        SELECT production_order_id, SUM(actual_batch_qty) AS total_batches
        FROM production_order_lines
        GROUP BY production_order_id
      ) lines_agg ON lines_agg.production_order_id = po.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY po.production_date, po.branch_id, b.branch_name
      ORDER BY po.production_date DESC, b.branch_name
    `, params)
    return rows
  }

  async getMaterialsReport(companyIds: string[], dateFrom: string, dateTo: string, branchId?: string): Promise<MaterialUsageSummary[]> {
    const conditions = ['po.company_id = ANY($1::uuid[])', 'po.production_date BETWEEN $2 AND $3', "po.status IN ('COMPLETED', 'JOURNALED')", 'po.is_deleted = false']
    const params: unknown[] = [companyIds, dateFrom, dateTo]

    if (branchId) { params.push(branchId); conditions.push(`po.branch_id = $${params.length}`) }

    const { rows } = await pool.query(`
      SELECT
        pm.product_id,
        pm.product_name,
        pm.product_code,
        pm.uom,
        SUM(pm.actual_qty)::numeric AS total_used,
        SUM(pm.waste_qty)::numeric AS total_waste,
        SUM(pm.total_cost)::numeric AS total_cost,
        SUM(pm.waste_qty * pm.cost_per_unit)::numeric AS total_waste_cost
      FROM production_order_materials pm
      JOIN production_orders po ON po.id = pm.production_order_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY pm.product_id, pm.product_name, pm.product_code, pm.uom
      ORDER BY total_cost DESC
    `, params)
    return rows
  }

  // ─── Helpers ───

  async getLine(id: string, orderId?: string): Promise<ProductionOrderLine | null> {
    const conditions = ['id = $1']
    const params: unknown[] = [id]
    if (orderId) { params.push(orderId); conditions.push(`production_order_id = $${params.length}`) }
    const { rows } = await pool.query(`SELECT * FROM production_order_lines WHERE ${conditions.join(' AND ')}`, params)
    return rows[0] ?? null
  }

  async getMaterial(id: string, orderId?: string): Promise<ProductionOrderMaterial | null> {
    const conditions = ['id = $1']
    const params: unknown[] = [id]
    if (orderId) { params.push(orderId); conditions.push(`production_order_id = $${params.length}`) }
    const { rows } = await pool.query(`SELECT * FROM production_order_materials WHERE ${conditions.join(' AND ')}`, params)
    return rows[0] ?? null
  }
}

export const productionOrdersRepository = new ProductionOrdersRepository()
