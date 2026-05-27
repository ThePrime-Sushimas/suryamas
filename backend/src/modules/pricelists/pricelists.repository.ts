import type { PoolClient } from 'pg'
import { pool } from '../../config/db'
import {
  Pricelist,
  PricelistWithRelations,
  CreatePricelistDto,
  UpdatePricelistDto,
  PricelistListQuery,
  PricelistLookup,
  InsertPriceChangeInput,
  UnpostPricelistBlockedItem,
  PricelistSource,
  PriceChangeWithRelations,
  PriceChangeListQuery,
  PriceChangeSummary,
  PriceChangeChartQuery,
  PriceChangeChartResult,
} from './pricelists.types'
import { calcChangeAmount, calcChangePct, SPARKLINE_HISTORY_POINTS } from './pricelists.utils'

const DETAIL_SELECT = `
  pl.*,
  s.supplier_name, s.supplier_code,
  p.product_name, p.product_code,
  mu.unit_name AS uom_name
`
const DETAIL_FROM = `
  FROM pricelists pl
  LEFT JOIN suppliers s ON s.id = pl.supplier_id
  LEFT JOIN products p ON p.id = pl.product_id
  LEFT JOIN product_uoms pu ON pu.id = pl.uom_id
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

function mapWithRelations(row: Record<string, unknown>): PricelistWithRelations {
  return {
    ...row,
    supplier_name: row.supplier_name || 'Unknown',
    product_name: row.product_name || 'Unknown',
    uom_name: row.uom_name || 'Unknown',
    supplier: row.supplier_name ? { id: row.supplier_id, supplier_code: row.supplier_code, supplier_name: row.supplier_name } : undefined,
    product: row.product_name ? { id: row.product_id, product_code: row.product_code, product_name: row.product_name } : undefined,
  } as unknown as PricelistWithRelations
}

const VALID_SORT_FIELDS = ['created_at', 'price', 'valid_from', 'valid_to', 'status']

export class PricelistsRepository {
  async findAll(pagination: { limit: number; offset: number }, query?: PricelistListQuery): Promise<{ data: PricelistWithRelations[]; total: number }> {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!query?.include_deleted) conditions.push('pl.deleted_at IS NULL')
    if (query?.supplier_id) { params.push(query.supplier_id); conditions.push(`pl.supplier_id = $${idx}`); idx++ }
    if (query?.product_id) { params.push(query.product_id); conditions.push(`pl.product_id = $${idx}`); idx++ }
    if (query?.status) { params.push(query.status); conditions.push(`pl.status = $${idx}`); idx++ }
    if (query?.is_active !== undefined) { params.push(query.is_active); conditions.push(`pl.is_active = $${idx}`); idx++ }
    if (query?.search) { params.push(`%${query.search}%`); conditions.push(`(s.supplier_name ILIKE $${idx} OR p.product_name ILIKE $${idx} OR p.product_code ILIKE $${idx})`); idx++ }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortBy = query?.sort_by && VALID_SORT_FIELDS.includes(query.sort_by) ? `pl.${query.sort_by}` : 'pl.created_at'
    const sortOrder = query?.sort_order === 'asc' ? 'ASC' : 'DESC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${DETAIL_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapWithRelations), total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<PricelistWithRelations | null> {
    const { rows } = await pool.query(`SELECT ${DETAIL_SELECT} ${DETAIL_FROM} WHERE pl.id = $1 AND pl.deleted_at IS NULL`, [id])
    return rows[0] ? mapWithRelations(rows[0]) : null
  }

  async findActiveDuplicate(companyId: string, supplierId: string, productId: string, uomId: string): Promise<Pricelist | null> {
    const { rows } = await pool.query(
      "SELECT * FROM pricelists WHERE company_id = $1 AND supplier_id = $2 AND product_id = $3 AND uom_id = $4 AND is_active = true AND status = 'APPROVED' AND deleted_at IS NULL",
      [companyId, supplierId, productId, uomId]
    )
    return rows[0] ?? null
  }

  async findActiveForUpdate(
    client: PoolClient,
    companyId: string,
    supplierId: string,
    productId: string,
    uomId: string,
  ): Promise<{ id: string; price: number } | null> {
    const { rows } = await client.query(
      `SELECT id, price FROM pricelists
       WHERE company_id = $1 AND supplier_id = $2 AND product_id = $3 AND uom_id = $4
         AND is_active = true AND status = 'APPROVED' AND deleted_at IS NULL
       FOR UPDATE`,
      [companyId, supplierId, productId, uomId],
    )
    return rows[0] ? { id: rows[0].id, price: Number(rows[0].price) } : null
  }

  async findByIdForUpdate(client: PoolClient, id: string): Promise<Pricelist | null> {
    const { rows } = await client.query(
      `SELECT * FROM pricelists WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    )
    return rows[0] ?? null
  }

  async deactivateWithValidTo(
    client: PoolClient,
    id: string,
    validTo: string,
    updatedBy?: string,
  ): Promise<void> {
    await client.query(
      `UPDATE pricelists
       SET is_active = false, valid_to = $1, updated_by = $2, updated_at = now()
       WHERE id = $3`,
      [validTo, updatedBy ?? null, id],
    )
  }

  async createInTransaction(
    client: PoolClient,
    data: CreatePricelistDto & {
      source?: PricelistSource
      purchase_invoice_id?: string | null
      created_by?: string
    },
  ): Promise<Pricelist> {
    const insertData: Record<string, unknown> = {
      company_id: data.company_id,
      supplier_id: data.supplier_id,
      product_id: data.product_id,
      uom_id: data.uom_id,
      price: data.price,
      currency: data.currency || 'IDR',
      valid_from: data.valid_from,
      valid_to: data.valid_to ?? null,
      is_active: data.is_active ?? true,
      status: 'APPROVED',
      source: data.source ?? 'MANUAL',
      purchase_invoice_id: data.purchase_invoice_id ?? null,
      created_by: data.created_by ?? null,
    }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await client.query(
      `INSERT INTO pricelists (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values,
    )
    return rows[0]
  }

  async insertPriceChange(data: InsertPriceChangeInput, client?: PoolClient): Promise<void> {
    const db = client ?? pool
    const changeAmount = calcChangeAmount(data.old_price, data.new_price)
    const changePct = calcChangePct(data.old_price, data.new_price)
    await db.query(
      `INSERT INTO pricelist_price_changes (
         company_id, supplier_id, product_id, uom_id,
         old_price, new_price, change_amount, change_pct,
         effective_date, source,
         purchase_invoice_id, purchase_invoice_line_id, pricelist_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        data.company_id,
        data.supplier_id,
        data.product_id,
        data.uom_id,
        data.old_price,
        data.new_price,
        changeAmount,
        changePct,
        data.effective_date,
        data.source,
        data.purchase_invoice_id ?? null,
        data.purchase_invoice_line_id ?? null,
        data.pricelist_id ?? null,
        data.created_by ?? null,
      ],
    )
  }

  async findUnpostBlockedItems(
    client: PoolClient,
    purchaseInvoiceId: string,
    companyId: string,
  ): Promise<UnpostPricelistBlockedItem[]> {
    const { rows } = await client.query<UnpostPricelistBlockedItem & {
      pricelist_is_active: boolean
      has_newer_pi_post: boolean
    }>(
      `SELECT
         p.product_name,
         mu.unit_name AS uom_name,
         pl.is_active AS pricelist_is_active,
         (newer.invoice_number IS NOT NULL) AS has_newer_pi_post,
         newer.invoice_number AS superseding_invoice_number
       FROM pricelist_price_changes ppc
       JOIN products p ON p.id = ppc.product_id
       JOIN product_uoms pu ON pu.id = ppc.uom_id
       JOIN metric_units mu ON mu.id = pu.metric_unit_id
       JOIN pricelists pl ON pl.id = ppc.pricelist_id
       LEFT JOIN LATERAL (
         SELECT pi2.invoice_number
         FROM pricelist_price_changes ppc2
         JOIN purchase_invoices pi2 ON pi2.id = ppc2.purchase_invoice_id
         JOIN purchase_invoices pi_orig ON pi_orig.id = $1
         WHERE ppc2.supplier_id = ppc.supplier_id
           AND ppc2.product_id = ppc.product_id
           AND ppc2.uom_id = ppc.uom_id
           AND ppc2.source = 'PI_POST'
           AND ppc2.purchase_invoice_id != $1
           AND pi2.status = 'POSTED'
           AND pi2.deleted_at IS NULL
           AND (
             ppc2.effective_date > ppc.effective_date
             OR (
               ppc2.effective_date = ppc.effective_date
               AND pi2.posted_at > pi_orig.posted_at
             )
           )
         ORDER BY ppc2.effective_date DESC, pi2.posted_at DESC
         LIMIT 1
       ) newer ON true
       WHERE ppc.purchase_invoice_id = $1
         AND ppc.company_id = $2
         AND ppc.source = 'PI_POST'`,
      [purchaseInvoiceId, companyId],
    )

    return rows
      .filter((r) => !r.pricelist_is_active || r.has_newer_pi_post)
      .map((r) => ({
        product_name: r.product_name,
        uom_name: r.uom_name,
        superseding_invoice_number: r.superseding_invoice_number,
      }))
  }

  async findPiPostChangesForRevert(
    client: PoolClient,
    purchaseInvoiceId: string,
    companyId: string,
  ): Promise<Array<{
    id: string
    supplier_id: string
    product_id: string
    uom_id: string
    product_name: string
    uom_name: string
    old_price: number | null
    new_price: number
    effective_date: string
    pricelist_id: string
  }>> {
    const { rows } = await client.query(
      `SELECT ppc.id, ppc.supplier_id, ppc.product_id, ppc.uom_id,
              ppc.old_price, ppc.new_price, ppc.effective_date, ppc.pricelist_id,
              p.product_name, mu.unit_name AS uom_name
       FROM pricelist_price_changes ppc
       JOIN products p ON p.id = ppc.product_id
       JOIN product_uoms pu ON pu.id = ppc.uom_id
       JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE ppc.purchase_invoice_id = $1 AND ppc.company_id = $2 AND ppc.source = 'PI_POST'
       ORDER BY ppc.created_at ASC`,
      [purchaseInvoiceId, companyId],
    )
    return rows.map((r) => ({
      ...r,
      product_name: r.product_name,
      uom_name: r.uom_name,
      old_price: r.old_price != null ? Number(r.old_price) : null,
      new_price: Number(r.new_price),
    }))
  }

  async getProductName(productId: string): Promise<string> {
    const { rows } = await pool.query('SELECT product_name FROM products WHERE id = $1', [productId])
    return rows[0]?.product_name || 'unknown'
  }

  async deactivate(id: string, updatedBy?: string): Promise<void> {
    await pool.query(
      'UPDATE pricelists SET is_active = false, updated_by = $1, updated_at = now() WHERE id = $2',
      [updatedBy || null, id]
    )
  }

  async create(data: CreatePricelistDto): Promise<Pricelist> {
    const insertData: Record<string, unknown> = {
      company_id: data.company_id, supplier_id: data.supplier_id, product_id: data.product_id,
      uom_id: data.uom_id, price: data.price, currency: data.currency || 'IDR',
      valid_from: data.valid_from, valid_to: data.valid_to,
      is_active: data.is_active ?? true, status: 'APPROVED', created_by: data.created_by,
    }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO pricelists (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdatePricelistDto & { updated_by?: string }): Promise<Pricelist | null> {
    const fullUpdates = { ...updates, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullUpdates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(fullUpdates)
    const { rows } = await pool.query(
      `UPDATE pricelists SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'EXPIRED'): Promise<Pricelist | null> {
    const isActive = status === 'APPROVED'
    const { rows } = await pool.query(
      'UPDATE pricelists SET status = $1, is_active = $2, updated_at = NOW() WHERE id = $3 AND deleted_at IS NULL RETURNING *',
      [status, isActive, id]
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    await pool.query(
      'UPDATE pricelists SET deleted_at = NOW(), is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL',
      [userId || null, id]
    )
  }

  async restorePricelist(id: string, userId?: string): Promise<Pricelist> {
    const { rows: deleted } = await pool.query('SELECT * FROM pricelists WHERE id = $1 AND deleted_at IS NOT NULL', [id])
    if (!deleted[0]) throw new Error('Deleted pricelist not found')

    const duplicate = await this.findActiveDuplicate(deleted[0].company_id, deleted[0].supplier_id, deleted[0].product_id, deleted[0].uom_id)
    if (duplicate) throw new Error('Cannot restore: An active pricelist already exists for this supplier-product-uom combination')

    const { rows } = await pool.query(
      'UPDATE pricelists SET deleted_at = NULL, is_active = true, updated_by = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NOT NULL RETURNING *',
      [userId || null, id]
    )
    return rows[0]
  }

  async lookupPrice(lookup: PricelistLookup): Promise<Pricelist | null> {
    const targetDate = lookup.date || new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `SELECT * FROM pricelists
       WHERE supplier_id = $1 AND product_id = $2 AND uom_id = $3
         AND status = 'APPROVED' AND is_active = true AND deleted_at IS NULL
         AND valid_from <= $4 AND (valid_to IS NULL OR valid_to >= $4)
       ORDER BY valid_from DESC LIMIT 1`,
      [lookup.supplier_id, lookup.product_id, lookup.uom_id, targetDate]
    )
    return rows[0] ?? null
  }

  /**
   * Batch lookup latest prices for multiple products from a supplier.
   * Returns Map<product_id, { price, uom_name, conversion_factor }>
   */
  async batchLookupBySupplier(
    supplierId: string,
    productIds: string[],
  ): Promise<Map<string, { price: number; uom_name: string; conversion_factor: number }>> {
    if (productIds.length === 0) return new Map()
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (pl.product_id)
        pl.product_id, pl.price, mu.unit_name AS uom_name, pu.conversion_factor
       FROM pricelists pl
       JOIN product_uoms pu ON pu.id = pl.uom_id AND pu.is_deleted = false
       JOIN metric_units mu ON mu.id = pu.metric_unit_id
       WHERE pl.supplier_id = $1
         AND pl.product_id = ANY($2::uuid[])
         AND pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
         AND pl.valid_from <= CURRENT_DATE
       ORDER BY pl.product_id, pl.valid_from DESC, pl.updated_at DESC`,
      [supplierId, productIds]
    )
    return new Map(
      rows.map((r) => [
        r.product_id,
        {
          price: Number(r.price),
          uom_name: r.uom_name,
          conversion_factor: Number(r.conversion_factor),
        },
      ]),
    )
  }

  async expireOldPricelists(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]
    const { rows } = await pool.query(
      `UPDATE pricelists SET status = 'EXPIRED', is_active = false, updated_at = NOW()
       WHERE status = 'APPROVED' AND valid_to IS NOT NULL AND valid_to < $1 AND deleted_at IS NULL
       RETURNING id`,
      [today]
    )
    return rows.length
  }

  /**
   * Get latest approved pricelist cost per base unit for a product.
   * Returns price / conversion_factor from the most recent valid_from (not future).
   */
  async getLatestCostPerBaseUnit(productId: string, client?: PoolClient): Promise<number | null> {
    const db = client ?? pool
    const { rows } = await db.query(
      `SELECT pl.price, pu.conversion_factor
       FROM pricelists pl
       JOIN product_uoms pu ON pu.id = pl.uom_id
       WHERE pl.product_id = $1 AND pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
         AND pu.conversion_factor > 0
         AND pl.valid_from <= CURRENT_DATE
       ORDER BY pl.valid_from DESC, pl.updated_at DESC
       LIMIT 1`,
      [productId]
    )
    if (rows.length === 0) return null
    const cost = Number(rows[0].price) / Number(rows[0].conversion_factor)
    return Number(cost.toFixed(6))
  }

  async updateProductAverageCost(productId: string, averageCost: number, client?: PoolClient): Promise<void> {
    const db = client ?? pool
    await db.query(
      'UPDATE products SET average_cost = $1, updated_at = now() WHERE id = $2',
      [averageCost, productId]
    )
  }

  /**
   * Update base_price for all UOMs of a product.
   * base_price = costPerBaseUnit × conversion_factor
   */
  async updateAllUomBasePrices(productId: string, costPerBaseUnit: number, client?: PoolClient): Promise<void> {
    const db = client ?? pool
    await db.query(
      `UPDATE product_uoms
       SET base_price = ROUND(($1 * conversion_factor)::numeric, 2), updated_at = now()
       WHERE product_id = $2 AND is_deleted = false`,
      [costPerBaseUnit, productId]
    )
  }

  private buildPriceChangeFilters(
    companyIds: string[],
    query?: PriceChangeListQuery,
  ): { where: string; params: unknown[] } {
    const conditions = ['ppc.company_id = ANY($1::uuid[])']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (query?.supplier_id) {
      conditions.push(`ppc.supplier_id = $${idx++}`)
      params.push(query.supplier_id)
    }
    if (query?.product_id) {
      conditions.push(`ppc.product_id = $${idx++}`)
      params.push(query.product_id)
    }
    if (query?.uom_id) {
      conditions.push(`ppc.uom_id = $${idx++}`)
      params.push(query.uom_id)
    }
    if (query?.source) {
      conditions.push(`ppc.source = $${idx++}`)
      params.push(query.source)
    }
    if (query?.date_from) {
      conditions.push(`ppc.effective_date >= $${idx++}`)
      params.push(query.date_from)
    }
    if (query?.date_to) {
      conditions.push(`ppc.effective_date <= $${idx++}`)
      params.push(query.date_to)
    }
    if (query?.search) {
      conditions.push(`(
        p.product_name ILIKE $${idx}
        OR p.product_code ILIKE $${idx}
        OR s.supplier_name ILIKE $${idx}
        OR pi.invoice_number ILIKE $${idx}
      )`)
      params.push(`%${query.search}%`)
      idx++
    }

    return { where: `WHERE ${conditions.join(' AND ')}`, params }
  }

  /** Shared FROM/JOIN for price-change list, count, and summary (keep in sync). */
  private priceChangeListFrom(): string {
    return `
      FROM pricelist_price_changes ppc
      JOIN suppliers s ON s.id = ppc.supplier_id
      JOIN products p ON p.id = ppc.product_id
      JOIN product_uoms pu ON pu.id = ppc.uom_id
      JOIN metric_units mu ON mu.id = pu.metric_unit_id
      LEFT JOIN purchase_invoices pi ON pi.id = ppc.purchase_invoice_id`
  }

  async findPriceChanges(
    companyIds: string[],
    pagination: { limit: number; offset: number },
    query?: PriceChangeListQuery,
  ): Promise<{ data: PriceChangeWithRelations[]; total: number }> {
    const { where, params } = this.buildPriceChangeFilters(companyIds, query)
    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2

    const sql = `
      SELECT
        ppc.*,
        s.supplier_name,
        p.product_name,
        p.product_code,
        mu.unit_name AS uom_name,
        pi.invoice_number,
        COALESCE(
          (
            SELECT ARRAY_AGG(sub.new_price ORDER BY sub.effective_date ASC, sub.created_at ASC)
            FROM (
              SELECT ppc2.new_price, ppc2.effective_date, ppc2.created_at
              FROM pricelist_price_changes ppc2
              WHERE ppc2.company_id = ppc.company_id
                AND ppc2.supplier_id = ppc.supplier_id
                AND ppc2.product_id = ppc.product_id
                AND ppc2.uom_id = ppc.uom_id
                AND (
                  ppc2.effective_date < ppc.effective_date
                  OR (ppc2.effective_date = ppc.effective_date AND ppc2.created_at < ppc.created_at)
                )
              ORDER BY ppc2.effective_date DESC, ppc2.created_at DESC
              LIMIT ${SPARKLINE_HISTORY_POINTS}
            ) sub
          ),
          ARRAY[]::numeric[]
        ) AS recent_prices
      FROM pricelist_price_changes ppc
      JOIN suppliers s ON s.id = ppc.supplier_id
      JOIN products p ON p.id = ppc.product_id
      JOIN product_uoms pu ON pu.id = ppc.uom_id
      JOIN metric_units mu ON mu.id = pu.metric_unit_id
      LEFT JOIN purchase_invoices pi ON pi.id = ppc.purchase_invoice_id
      ${where}
      ORDER BY ppc.effective_date DESC, ppc.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`

    const countSql = `
      SELECT COUNT(*)::int AS total
      ${this.priceChangeListFrom()}
      ${where}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(sql, [...params, pagination.limit, pagination.offset]),
      pool.query(countSql, params),
    ])

    return {
      data: dataRes.rows.map((row) => ({
        ...row,
        old_price: row.old_price != null ? Number(row.old_price) : null,
        new_price: Number(row.new_price),
        change_amount: row.change_amount != null ? Number(row.change_amount) : null,
        change_pct: row.change_pct != null ? Number(row.change_pct) : null,
        recent_prices: (row.recent_prices ?? []).map(Number),
      })) as PriceChangeWithRelations[],
      total: countRes.rows[0].total,
    }
  }

  async summarizePriceChanges(
    companyIds: string[],
    query?: PriceChangeListQuery,
  ): Promise<PriceChangeSummary> {
    const { where, params } = this.buildPriceChangeFilters(companyIds, query)
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ppc.change_pct > 0)::int AS up_count,
         COUNT(*) FILTER (WHERE ppc.change_pct < 0)::int AS down_count,
         ROUND(AVG(ppc.change_pct) FILTER (WHERE ppc.change_pct IS NOT NULL), 2) AS avg_change_pct
       ${this.priceChangeListFrom()}
       ${where}`,
      params,
    )
    const row = rows[0]
    return {
      up_count: Number(row.up_count ?? 0),
      down_count: Number(row.down_count ?? 0),
      avg_change_pct: row.avg_change_pct != null ? Number(row.avg_change_pct) : null,
    }
  }

  async findPriceChangeChart(
    companyIds: string[],
    query: PriceChangeChartQuery,
  ): Promise<PriceChangeChartResult> {
    const limit = Math.min(query.limit ?? 30, 90)
    const days = query.days ?? 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { rows } = await pool.query(
      `SELECT ppc.effective_date, ppc.new_price, ppc.change_pct, ppc.source
       FROM pricelist_price_changes ppc
       WHERE ppc.company_id = ANY($1::uuid[])
         AND ppc.supplier_id = $2
         AND ppc.product_id = $3
         AND ppc.uom_id = $4
         AND ppc.effective_date >= $5
       ORDER BY ppc.effective_date ASC, ppc.created_at ASC
       LIMIT $6`,
      [companyIds, query.supplier_id, query.product_id, query.uom_id, cutoffStr, limit],
    )

    const activeRes = await pool.query(
      `SELECT price FROM pricelists
       WHERE company_id = ANY($1::uuid[]) AND supplier_id = $2 AND product_id = $3 AND uom_id = $4
         AND is_active = true AND status = 'APPROVED' AND deleted_at IS NULL
       LIMIT 1`,
      [companyIds, query.supplier_id, query.product_id, query.uom_id],
    )

    return {
      points: rows.map((r) => ({
        effective_date: String(r.effective_date).slice(0, 10),
        new_price: Number(r.new_price),
        change_pct: r.change_pct != null ? Number(r.change_pct) : null,
        source: r.source,
      })),
      active_price: activeRes.rows[0] ? Number(activeRes.rows[0].price) : null,
    }
  }
}

export const pricelistsRepository = new PricelistsRepository()
