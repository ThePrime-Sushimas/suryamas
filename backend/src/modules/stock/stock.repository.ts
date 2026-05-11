import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  StockBalance, StockBalanceWithRelations, StockMovement, StockMovementWithRelations,
  CreateMovementDto, StockBalanceFilter, StockMovementFilter
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
  au.full_name AS created_by_name
`
const MOVEMENT_FROM = `
  FROM stock_movements sm
  JOIN warehouses w ON w.id = sm.warehouse_id
  JOIN products p ON p.id = sm.product_id
  LEFT JOIN auth_users au ON au.id = sm.created_by
`

export class StockRepository {
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
}

export const stockRepository = new StockRepository()
