import { pool } from '../../../config/db'
import type { MenuGroup, MenuGroupWithCategory, CreateMenuGroupDto, UpdateMenuGroupDto } from './menu-groups.types'

export class MenuGroupsRepository {
  async findAll(companyIds: string[], pagination: { limit: number; offset: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean; category_id?: string }): Promise<{ data: MenuGroupWithCategory[]; total: number }> {
    const conditions = ['mg.company_id = ANY($1::uuid[])', 'mg.deleted_at IS NULL']
    const params: unknown[] = [companyIds]
    let idx = 2

    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`mg.is_active = $${idx++}`) }
    if (filter?.category_id) { params.push(filter.category_id); conditions.push(`mg.category_id = $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const allowedSort = ['group_code', 'group_name', 'sort_order', 'created_at']
    const orderBy = sort && allowedSort.includes(sort.field)
      ? `ORDER BY mg.${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`
      : 'ORDER BY mc.sort_order ASC, mg.sort_order ASC, mg.group_name ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT mg.*, mc.category_name, mc.category_code
         FROM menu_groups mg JOIN menu_categories mc ON mc.id = mg.category_id
         ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM menu_groups mg ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyIds: string[], q: string, pagination: { limit: number; offset: number }): Promise<{ data: MenuGroupWithCategory[]; total: number }> {
    const params = [companyIds, `%${q}%`]
    const where = `WHERE mg.company_id = ANY($1::uuid[]) AND mg.deleted_at IS NULL AND (mg.group_name ILIKE $2 OR mg.group_code ILIKE $2)`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT mg.*, mc.category_name, mc.category_code
         FROM menu_groups mg JOIN menu_categories mc ON mc.id = mg.category_id
         ${where} ORDER BY mg.sort_order ASC LIMIT $3 OFFSET $4`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM menu_groups mg ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<MenuGroupWithCategory | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT mg.*, mc.category_name, mc.category_code
       FROM menu_groups mg JOIN menu_categories mc ON mc.id = mg.category_id
       WHERE mg.id = $1 AND mg.company_id = ANY($2::uuid[]) AND mg.deleted_at IS NULL`,
      [id, companyIds]
    )
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<MenuGroupWithCategory | null> {
    const { rows } = await pool.query(
      `SELECT mg.*, mc.category_name, mc.category_code
       FROM menu_groups mg JOIN menu_categories mc ON mc.id = mg.category_id
       WHERE mg.id = $1 AND mg.company_id = $2 AND mg.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreateMenuGroupDto): Promise<MenuGroup> {
    const { rows } = await pool.query(
      `INSERT INTO menu_groups (company_id, category_id, group_code, group_name, sort_order, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
      [companyId, dto.category_id, dto.group_code, dto.group_name, dto.sort_order ?? 0, dto.is_active ?? true, dto.created_by ?? null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateMenuGroupDto): Promise<MenuGroup | null> {
    const fields: string[] = ['updated_at = now()']
    const values: unknown[] = []
    let idx = 1

    if (dto.category_id !== undefined) { values.push(dto.category_id); fields.push(`category_id = $${idx++}`) }
    if (dto.group_name !== undefined) { values.push(dto.group_name); fields.push(`group_name = $${idx++}`) }
    if (dto.sort_order !== undefined) { values.push(dto.sort_order); fields.push(`sort_order = $${idx++}`) }
    if (dto.is_active !== undefined) { values.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
    if (dto.updated_by) { values.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

    values.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE menu_groups SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menu_groups SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async restore(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menu_groups SET deleted_at = NULL, is_deleted = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasMenus(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM menus WHERE group_id = $1 AND deleted_at IS NULL',
      [id]
    )
    return rows[0].cnt > 0
  }
}

export const menuGroupsRepository = new MenuGroupsRepository()
