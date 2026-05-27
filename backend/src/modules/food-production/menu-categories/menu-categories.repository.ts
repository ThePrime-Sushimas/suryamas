import { pool } from '../../../config/db'
import type { MenuCategory, MenuCategoryWithCoa, CreateMenuCategoryDto, UpdateMenuCategoryDto } from './menu-categories.types'

const BASE_SELECT = `
  mc.*,
  sc.account_code AS sales_coa_code, sc.account_name AS sales_coa_name,
  cc.account_code AS cogs_coa_code, cc.account_name AS cogs_coa_name
`
const BASE_FROM = `
  FROM menu_categories mc
  LEFT JOIN chart_of_accounts sc ON sc.id = mc.sales_coa_id
  LEFT JOIN chart_of_accounts cc ON cc.id = mc.cogs_coa_id
`

export class MenuCategoriesRepository {
  async findAll(companyIds: string[], pagination: { limit: number; offset: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean }): Promise<{ data: MenuCategoryWithCoa[]; total: number }> {
    const conditions = ['mc.company_id = ANY($1::uuid[])', 'mc.deleted_at IS NULL']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (filter?.is_active !== undefined) {
      params.push(filter.is_active)
      conditions.push(`mc.is_active = $${idx++}`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const allowedSort = ['category_code', 'category_name', 'sort_order', 'created_at']
    const orderBy = sort && allowedSort.includes(sort.field)
      ? `ORDER BY mc.${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`
      : 'ORDER BY mc.sort_order ASC, mc.category_name ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM menu_categories mc ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyIds: string[], q: string, pagination: { limit: number; offset: number }): Promise<{ data: MenuCategoryWithCoa[]; total: number }> {
    const params = [companyIds, `%${q}%`]
    const where = `WHERE mc.company_id = ANY($1::uuid[]) AND mc.deleted_at IS NULL AND (mc.category_name ILIKE $2 OR mc.category_code ILIKE $2)`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ORDER BY mc.sort_order ASC LIMIT $3 OFFSET $4`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM menu_categories mc ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<MenuCategoryWithCoa | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE mc.id = $1 AND mc.company_id = ANY($2::uuid[]) AND mc.deleted_at IS NULL`, [id, companyIds])
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<MenuCategoryWithCoa | null> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE mc.id = $1 AND mc.company_id = $2 AND mc.deleted_at IS NULL`, [id, companyId])
    return rows[0] ?? null
  }

  async findByCode(code: string, companyId: string): Promise<MenuCategory | null> {
    const { rows } = await pool.query('SELECT * FROM menu_categories WHERE category_code = $1 AND company_id = $2 AND deleted_at IS NULL', [code, companyId])
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    const { rows } = await pool.query(
      `INSERT INTO menu_categories (company_id, category_code, category_name, sales_coa_id, cogs_coa_id, sort_order, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING *`,
      [companyId, dto.category_code, dto.category_name, dto.sales_coa_id ?? null, dto.cogs_coa_id ?? null, dto.sort_order ?? 0, dto.is_active ?? true, dto.created_by ?? null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateMenuCategoryDto): Promise<MenuCategory | null> {
    const fields: string[] = ['updated_at = now()']
    const values: unknown[] = []
    let idx = 1

    if (dto.category_name !== undefined) { values.push(dto.category_name); fields.push(`category_name = $${idx++}`) }
    if (dto.sales_coa_id !== undefined) { values.push(dto.sales_coa_id); fields.push(`sales_coa_id = $${idx++}`) }
    if (dto.cogs_coa_id !== undefined) { values.push(dto.cogs_coa_id); fields.push(`cogs_coa_id = $${idx++}`) }
    if (dto.sort_order !== undefined) { values.push(dto.sort_order); fields.push(`sort_order = $${idx++}`) }
    if (dto.is_active !== undefined) { values.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
    if (dto.updated_by) { values.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

    values.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE menu_categories SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menu_categories SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async restore(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menu_categories SET deleted_at = NULL, is_deleted = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasChildren(id: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM menu_groups WHERE category_id = $1 AND deleted_at IS NULL', [id])
    return rows[0].cnt > 0
  }
}

export const menuCategoriesRepository = new MenuCategoriesRepository()
