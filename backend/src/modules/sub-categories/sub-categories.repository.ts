import { pool } from '../../config/db'
import { SubCategory, SubCategoryWithCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../categories/categories.types'

const ALLOWED_SORT_FIELDS = ['id', 'category_id', 'sub_category_code', 'sub_category_name', 'sort_order', 'created_at', 'updated_at']

export class SubCategoriesRepository {
  private buildQuery(isDeleted: boolean, search?: string, categoryId?: string) {
    const conditions: string[] = [`sc.is_deleted = ${isDeleted}`]
    const params: string[] = []
    let idx = 1

    if (search) { params.push(`%${search}%`); conditions.push(`(sc.sub_category_name ILIKE $${idx} OR sc.sub_category_code ILIKE $${idx})`); idx++ }
    if (categoryId) { params.push(categoryId); conditions.push(`sc.category_id = $${idx}`); idx++ }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, categoryId?: string): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    const { where, params, idx } = this.buildQuery(false, undefined, categoryId)
    const sortField = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `sc.${sort.field}` : null
    const orderBy = sortField ? `ORDER BY ${sortField} ${sort?.order === 'desc' ? 'DESC' : 'ASC'}` : 'ORDER BY sc.sort_order ASC, sc.sub_category_name ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT sc.*, c.id AS cat_id, c.category_code AS cat_code, c.category_name AS cat_name
         FROM sub_categories sc LEFT JOIN categories c ON c.id = sc.category_id
         ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM sub_categories sc ${where}`, params)
    ])

    return { data: dataRes.rows.map(this.mapWithCategory), total: countRes.rows[0].total }
  }

  async findTrash(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    const { where, params, idx } = this.buildQuery(true)
    const sortField = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `sc.${sort.field}` : null
    const orderBy = sortField ? `ORDER BY ${sortField} ${sort?.order === 'desc' ? 'DESC' : 'ASC'}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT sc.*, c.id AS cat_id, c.category_code AS cat_code, c.category_name AS cat_name
         FROM sub_categories sc LEFT JOIN categories c ON c.id = sc.category_id
         ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM sub_categories sc ${where}`, params)
    ])

    return { data: dataRes.rows.map(this.mapWithCategory), total: countRes.rows[0].total }
  }

  async search(searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<{ data: SubCategoryWithCategory[]; total: number }> {
    const { where, params, idx } = this.buildQuery(false, searchTerm)
    const sortField = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `sc.${sort.field}` : null
    const orderBy = sortField ? `ORDER BY ${sortField} ${sort?.order === 'desc' ? 'DESC' : 'ASC'}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT sc.*, c.id AS cat_id, c.category_code AS cat_code, c.category_name AS cat_name
         FROM sub_categories sc LEFT JOIN categories c ON c.id = sc.category_id
         ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM sub_categories sc ${where}`, params)
    ])

    return { data: dataRes.rows.map(this.mapWithCategory), total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<SubCategoryWithCategory | null> {
    const { rows } = await pool.query(
      `SELECT sc.*, c.id AS cat_id, c.category_code AS cat_code, c.category_name AS cat_name
       FROM sub_categories sc LEFT JOIN categories c ON c.id = sc.category_id
       WHERE sc.id = $1`,
      [id]
    )
    return rows[0] ? this.mapWithCategory(rows[0]) : null
  }

  async findByCode(code: string, categoryId: string): Promise<SubCategory | null> {
    const { rows } = await pool.query(
      'SELECT * FROM sub_categories WHERE sub_category_code = $1 AND category_id = $2 AND is_deleted = false',
      [code, categoryId]
    )
    return rows[0] ?? null
  }

  async findByCategory(categoryId: string): Promise<SubCategory[]> {
    const { rows } = await pool.query(
      'SELECT * FROM sub_categories WHERE category_id = $1 AND is_deleted = false ORDER BY sort_order ASC',
      [categoryId]
    )
    return rows
  }

  async create(data: CreateSubCategoryDto & { created_by?: string; updated_by?: string }): Promise<SubCategory> {
    const insertData = { ...data, sort_order: data.sort_order ?? 0, is_deleted: false }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO sub_categories (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdateSubCategoryDto & { updated_by?: string }): Promise<SubCategory | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE sub_categories SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND is_deleted = false RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    await pool.query('UPDATE sub_categories SET is_deleted = true, updated_by = $1 WHERE id = $2 AND is_deleted = false', [userId || null, id])
  }

  async restore(id: string, userId?: string): Promise<void> {
    await pool.query('UPDATE sub_categories SET is_deleted = false, updated_by = $1 WHERE id = $2 AND is_deleted = true', [userId || null, id])
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    await pool.query('UPDATE sub_categories SET is_deleted = true, updated_by = $1 WHERE id = ANY($2::uuid[]) AND is_deleted = false', [userId || null, ids])
  }

  async exportData(): Promise<SubCategory[]> {
    const { rows } = await pool.query('SELECT * FROM sub_categories WHERE is_deleted = false ORDER BY sort_order ASC')
    return rows
  }

  private mapWithCategory(row: Record<string, unknown>): SubCategoryWithCategory {
    return {
      ...row,
      category: row.cat_id ? { id: row.cat_id, category_code: row.cat_code, category_name: row.cat_name } : null,
    } as SubCategoryWithCategory
  }
}

export const subCategoriesRepository = new SubCategoriesRepository()
