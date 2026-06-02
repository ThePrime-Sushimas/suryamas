import { pool } from '../../config/db'
import type { Warehouse, WarehouseWithBranch, CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.types'

const BASE_SELECT = `
  w.*,
  b.branch_name, b.branch_code
`
const BASE_FROM = `
  FROM warehouses w
  JOIN branches b ON b.id = w.branch_id
`

export class WarehousesRepository {
  async findAll(
    companyIds: string[],
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: string },
    filter?: { branch_id?: string; warehouse_type?: string; is_active?: boolean }
  ): Promise<{ data: WarehouseWithBranch[]; total: number }> {
    const conditions = ['w.company_id = ANY($1::uuid[])', 'w.deleted_at IS NULL']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`w.branch_id = $${idx++}`) }
    if (filter?.warehouse_type) { params.push(filter.warehouse_type); conditions.push(`w.warehouse_type = $${idx++}`) }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`w.is_active = $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const allowedSort = ['warehouse_code', 'warehouse_name', 'warehouse_type', 'created_at']
    const orderBy = sort && allowedSort.includes(sort.field)
      ? `ORDER BY w.${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`
      : 'ORDER BY b.branch_name ASC, w.warehouse_type ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM warehouses w ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyIds: string[], q: string, pagination: { limit: number; offset: number }): Promise<{ data: WarehouseWithBranch[]; total: number }> {
    const params = [companyIds, `%${q}%`]
    const where = `WHERE w.company_id = ANY($1::uuid[]) AND w.deleted_at IS NULL AND (w.warehouse_name ILIKE $2 OR w.warehouse_code ILIKE $2 OR b.branch_name ILIKE $2)`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ORDER BY b.branch_name ASC, w.warehouse_type ASC LIMIT $3 OFFSET $4`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM warehouses w JOIN branches b ON b.id = w.branch_id ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<WarehouseWithBranch | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} WHERE w.id = $1 AND w.company_id = ANY($2::uuid[]) AND w.deleted_at IS NULL`,
      [id, companyIds]
    )
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<WarehouseWithBranch | null> {
    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} WHERE w.id = $1 AND w.company_id = $2 AND w.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findByCode(code: string, companyId: string): Promise<Warehouse | null> {
    const { rows } = await pool.query(
      'SELECT * FROM warehouses WHERE warehouse_code = $1 AND company_id = $2 AND deleted_at IS NULL',
      [code, companyId]
    )
    return rows[0] ?? null
  }

  async findByBranch(branchId: string, companyIds: string[]): Promise<WarehouseWithBranch[]> {
    if (!companyIds.length) return []
    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} WHERE w.branch_id = $1 AND w.company_id = ANY($2::uuid[]) AND w.deleted_at IS NULL ORDER BY w.warehouse_type ASC`,
      [branchId, companyIds]
    )
    return rows
  }

  async findByBranchAndType(branchId: string, warehouseType: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM warehouses WHERE branch_id = $1 AND warehouse_type = $2 AND deleted_at IS NULL LIMIT 1`,
      [branchId, warehouseType]
    )
    return rows.length > 0 ? (rows[0].id as string) : null
  }

  async create(companyId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    const { rows } = await pool.query(
      `INSERT INTO warehouses (company_id, branch_id, warehouse_code, warehouse_name, warehouse_type, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
      [companyId, dto.branch_id, dto.warehouse_code, dto.warehouse_name, dto.warehouse_type ?? 'MAIN', dto.is_active ?? true, dto.created_by ?? null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateWarehouseDto): Promise<Warehouse | null> {
    const fields: string[] = ['updated_at = now()']
    const values: unknown[] = []
    let idx = 1

    if (dto.warehouse_name !== undefined) { values.push(dto.warehouse_name); fields.push(`warehouse_name = $${idx++}`) }
    if (dto.warehouse_type !== undefined) { values.push(dto.warehouse_type); fields.push(`warehouse_type = $${idx++}`) }
    if (dto.is_active !== undefined) { values.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
    if (dto.updated_by) { values.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

    values.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE warehouses SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE warehouses SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async restore(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE warehouses SET deleted_at = NULL, is_deleted = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasChildren(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM stock_balances WHERE warehouse_id = $1 AND qty != 0',
      [id]
    )
    return rows[0].cnt > 0
  }

  async hasMovements(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM stock_movements WHERE warehouse_id = $1 LIMIT 1) AS has',
      [id]
    )
    return rows[0].has
  }
}

export const warehousesRepository = new WarehousesRepository()
