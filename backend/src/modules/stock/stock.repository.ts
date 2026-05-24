import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  StockBalance, StockBalanceWithRelations, StockMovement, StockMovementWithRelations,
  CreateMovementDto, StockBalanceFilter, StockMovementFilter,
  ProductStockConfig, StockConfigGridRow, UpsertStockConfigDto, ReorderSuggestionItem
} from './stock.types'

const BALANCE_SELECT = `
  sb.*,
  w.warehouse_code, w.warehouse_name, w.warehouse_type,
  b.branch_name,
  p.product_code, p.product_name,
  mu.unit_name AS base_unit_name
`
const BALANCE_FROM = `
  FROM stock_balances sb
  JOIN warehouses w ON w.id = sb.warehouse_id
  JOIN branches b ON b.id = w.branch_id
  JOIN products p ON p.id = sb.product_id
  LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
  LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
`

const MOVEMENT_SELECT = `
  sm.*,
  w.warehouse_code, w.warehouse_name,
  p.product_code, p.product_name,
  e.full_name AS created_by_name
`
const MOVEMENT_FROM = `
  FROM stock_movements sm
  JOIN warehouses w ON w.id = sm.warehouse_id
  JOIN products p ON p.id = sm.product_id
  LEFT JOIN employees e ON e.user_id = sm.created_by
`

export class StockRepository {
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

  async warehouseBelongsToCompany(warehouseId: string, companyId: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [warehouseId, companyId],
    )
    return rows.length > 0
  }

  async hasOpeningBalanceMovement(
    warehouseId: string,
    productId: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const db = client ?? pool
    const { rows } = await db.query(
      `SELECT EXISTS(
         SELECT 1 FROM stock_movements
         WHERE warehouse_id = $1 AND product_id = $2 AND movement_type = 'IN_OPENING'
       ) AS has_opening`,
      [warehouseId, productId],
    )
    return Boolean(rows[0]?.has_opening)
  }

  async lockBalanceRow(client: PoolClient, warehouseId: string, productId: string): Promise<void> {
    await client.query(
      'SELECT 1 FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
      [warehouseId, productId],
    )
  }

  async getBalanceQty(client: PoolClient, warehouseId: string, productId: string): Promise<number> {
    const { rows } = await client.query(
      'SELECT qty FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
      [warehouseId, productId],
    )
    return rows[0] ? Number(rows[0].qty) : 0
  }

  // ─── BALANCES ───────────────────────────────────────────────────────────────

  async findBalances(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: StockBalanceFilter,
    search?: string
  ): Promise<{ data: StockBalanceWithRelations[]; total: number }> {
    const conditions = ['w.company_id = $1', 'w.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.warehouse_id) { params.push(filter.warehouse_id); conditions.push(`sb.warehouse_id = $${idx++}`) }
    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`w.branch_id = $${idx++}`) }
    if (filter?.warehouse_type) { params.push(filter.warehouse_type); conditions.push(`w.warehouse_type = $${idx++}`) }
    if (filter?.product_id) { params.push(filter.product_id); conditions.push(`sb.product_id = $${idx++}`) }
    if (filter?.has_stock) { conditions.push('sb.qty > 0') }
    if (search) { params.push(`%${search}%`); conditions.push(`(p.product_name ILIKE $${idx} OR p.product_code ILIKE $${idx})`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${BALANCE_SELECT} ${BALANCE_FROM} ${where} ORDER BY b.branch_name, w.warehouse_type, p.product_name LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${BALANCE_FROM} ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findBalanceByWarehouseProduct(warehouseId: string, productId: string): Promise<StockBalance | null> {
    const { rows } = await pool.query(
      'SELECT * FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
      [warehouseId, productId]
    )
    return rows[0] ?? null
  }

  async getBalanceForUpdate(client: PoolClient, warehouseId: string, productId: string): Promise<StockBalance | null> {
    const { rows } = await client.query(
      'SELECT * FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
      [warehouseId, productId]
    )
    return rows[0] ?? null
  }

  async upsertBalance(client: PoolClient, warehouseId: string, productId: string, qty: number, avgCost: number): Promise<StockBalance> {
    const { rows } = await client.query(
      `INSERT INTO stock_balances (warehouse_id, product_id, qty, avg_cost, last_movement_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
         qty = $3, avg_cost = $4, last_movement_at = now(), updated_at = now()
       RETURNING *`,
      [warehouseId, productId, qty, avgCost]
    )
    return rows[0]
  }

  // ─── MOVEMENTS ──────────────────────────────────────────────────────────────

  async findMovements(
    companyId: string,
    pagination: { limit: number; offset: number },
    filter?: StockMovementFilter
  ): Promise<{ data: StockMovementWithRelations[]; total: number }> {
    const conditions = ['w.company_id = $1', 'w.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.warehouse_id) { params.push(filter.warehouse_id); conditions.push(`sm.warehouse_id = $${idx++}`) }
    if (filter?.product_id) { params.push(filter.product_id); conditions.push(`sm.product_id = $${idx++}`) }
    if (filter?.movement_type) { params.push(filter.movement_type); conditions.push(`sm.movement_type = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`sm.movement_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`sm.movement_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${MOVEMENT_SELECT} ${MOVEMENT_FROM} ${where} ORDER BY sm.movement_date DESC, sm.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM stock_movements sm JOIN warehouses w ON w.id = sm.warehouse_id ${where}`,
        params
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findMovementsByProduct(warehouseId: string, productId: string, pagination: { limit: number; offset: number }): Promise<{ data: StockMovementWithRelations[]; total: number }> {
    const where = 'WHERE sm.warehouse_id = $1 AND sm.product_id = $2'
    const params = [warehouseId, productId]

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${MOVEMENT_SELECT} ${MOVEMENT_FROM} ${where} ORDER BY sm.movement_date DESC, sm.created_at DESC LIMIT $3 OFFSET $4`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM stock_movements sm ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async createMovement(client: PoolClient, dto: CreateMovementDto, balanceAfter: number): Promise<StockMovement> {
    const totalCost = dto.qty * dto.cost_per_unit
    const { rows } = await client.query(
      `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, qty, cost_per_unit, total_cost, balance_after, reference_type, reference_id, notes, movement_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::date, CURRENT_DATE), $12)
       RETURNING *`,
      [
        dto.warehouse_id, dto.product_id, dto.movement_type,
        dto.qty, dto.cost_per_unit, totalCost, balanceAfter,
        dto.reference_type ?? null, dto.reference_id ?? null,
        dto.notes ?? null, dto.movement_date ?? null, dto.created_by ?? null,
      ]
    )
    return rows[0]
  }

  // ─── STOCK CONFIG ─────────────────────────────────────────────────────────────

  async findStockConfigGrid(companyId: string): Promise<StockConfigGridRow[]> {
    const { rows } = await pool.query(
      `SELECT
        p.id AS product_id,
        p.product_code,
        p.product_name,
        c.category_name,
        mu.unit_name AS base_unit_name,
        COALESCE(
          json_agg(
            json_build_object(
              'branch_id', psc.branch_id,
              'reorder_point', psc.reorder_point,
              'safety_stock', psc.safety_stock
            )
          ) FILTER (WHERE psc.id IS NOT NULL),
          '[]'
        ) AS configs
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
      LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
      LEFT JOIN product_stock_configs psc ON psc.product_id = p.id AND psc.company_id = $1
      WHERE p.is_deleted = false
        AND p.status = 'ACTIVE'
        AND p.is_purchasable = true
      GROUP BY p.id, p.product_code, p.product_name, c.category_name, mu.unit_name
      ORDER BY c.category_name, p.product_name`,
      [companyId]
    )
    return rows
  }

  async upsertStockConfig(
    companyId: string,
    dto: UpsertStockConfigDto,
    userId: string
  ): Promise<ProductStockConfig> {
    const { rows } = await pool.query(
      `INSERT INTO product_stock_configs
        (company_id, branch_id, product_id, reorder_point, safety_stock, notes, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (branch_id, product_id) DO UPDATE SET
        reorder_point = EXCLUDED.reorder_point,
        safety_stock  = EXCLUDED.safety_stock,
        notes         = EXCLUDED.notes,
        updated_by    = EXCLUDED.updated_by,
        updated_at    = now()
      RETURNING *`,
      [companyId, dto.branch_id, dto.product_id, dto.reorder_point ?? null, dto.safety_stock ?? null, dto.notes ?? null, userId]
    )
    return rows[0]
  }

  // ─── REORDER SUGGESTIONS ────────────────────────────────────────────────────

  async findReorderSuggestions(companyId: string, branchIds?: string[]): Promise<ReorderSuggestionItem[]> {
    const conditions = ['w.company_id = $1', 'w.deleted_at IS NULL', 'p.is_deleted = false', "p.status = 'ACTIVE'"]
    const params: unknown[] = [companyId]
    let idx = 2

    if (branchIds && branchIds.length > 0) {
      params.push(branchIds)
      conditions.push(`w.branch_id = ANY($${idx++}::uuid[])`)
    }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT
        p.id                                            AS product_id,
        p.product_code,
        p.product_name,
        COALESCE(mu.unit_name, '')                      AS base_unit_name,

        b.id                                            AS branch_id,
        b.branch_name,
        w.id                                            AS warehouse_id,
        w.warehouse_name,

        COALESCE(sb.qty, 0)                             AS current_qty,
        COALESCE(psc.reorder_point, p.reorder_point)    AS reorder_point,
        COALESCE(psc.safety_stock,  p.safety_stock)     AS safety_stock,

        -- Berapa kurangnya
        GREATEST(0,
          COALESCE(psc.reorder_point, p.reorder_point)
          - COALESCE(sb.qty, 0)
        )                                               AS shortage,

        -- Critical: stok <= safety stock
        CASE
          WHEN COALESCE(psc.safety_stock, p.safety_stock) IS NOT NULL
           AND COALESCE(sb.qty, 0) <= COALESCE(psc.safety_stock, p.safety_stock)
          THEN true ELSE false
        END                                             AS is_critical,

        -- Qty on order dari PO aktif
        COALESCE((
          SELECT SUM(GREATEST(0, pol.qty - pol.qty_received))
          FROM purchase_order_lines pol
          JOIN purchase_orders po ON po.id = pol.po_id
          WHERE pol.product_id = p.id
            AND po.branch_id   = b.id
            AND po.status      IN ('SENT', 'ORDERED', 'PARTIAL_RECEIVED')
            AND po.deleted_at  IS NULL
        ), 0)                                           AS qty_on_order,

        -- Masih kurang walau on_order sudah diperhitungkan?
        CASE
          WHEN COALESCE(sb.qty, 0)
            + COALESCE((
                SELECT SUM(GREATEST(0, pol.qty - pol.qty_received))
                FROM purchase_order_lines pol
                JOIN purchase_orders po ON po.id = pol.po_id
                WHERE pol.product_id = p.id
                  AND po.branch_id   = b.id
                  AND po.status      IN ('SENT', 'ORDERED', 'PARTIAL_RECEIVED')
                  AND po.deleted_at  IS NULL
              ), 0)
            < COALESCE(psc.reorder_point, p.reorder_point)
          THEN true ELSE false
        END                                             AS still_short_after_order,

        -- Preferred supplier
        sp.supplier_id                                  AS preferred_supplier_id,
        s.supplier_name                                 AS preferred_supplier_name,
        sp.lead_time_days,
        sp.price                                        AS last_purchase_price,

        -- Config source
        CASE WHEN psc.id IS NOT NULL THEN 'branch' ELSE 'product_default' END AS config_source

      FROM products p
      JOIN stock_balances sb ON sb.product_id = p.id
      JOIN warehouses w      ON w.id = sb.warehouse_id
      JOIN branches b        ON b.id = w.branch_id
      LEFT JOIN product_uoms pu  ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
      LEFT JOIN metric_units mu  ON mu.id = pu.metric_unit_id
      LEFT JOIN product_stock_configs psc
                                ON psc.product_id = p.id
                               AND psc.branch_id  = b.id
                               AND psc.company_id = $1
      LEFT JOIN supplier_products sp
                                ON sp.product_id  = p.id
                               AND sp.is_preferred = true
                               AND sp.is_active    = true
                               AND sp.deleted_at   IS NULL
      LEFT JOIN suppliers s      ON s.id = sp.supplier_id AND s.deleted_at IS NULL
      WHERE ${where}
        -- Hanya yang punya config (branch atau product level)
        AND COALESCE(psc.reorder_point, p.reorder_point) IS NOT NULL
        -- Stok di bawah reorder point
        AND COALESCE(sb.qty, 0) < COALESCE(psc.reorder_point, p.reorder_point)
      ORDER BY is_critical DESC, shortage DESC, b.branch_name, p.product_name`,
      params
    )
    return rows
  }
}

export const stockRepository = new StockRepository()
