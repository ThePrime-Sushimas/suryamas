import { pool } from '../../config/db'
import { Category, CreateCategoryDto, UpdateCategoryDto } from './categories.types'
import { CategoryErrors } from './categories.errors'

const ALLOWED_SORT_FIELDS = ['id', 'category_code', 'category_name', 'sort_order', 'created_at', 'updated_at']

export class CategoriesRepository {
  private buildListQuery(isDeleted: boolean, search?: string, filter?: { is_active?: boolean }, categoryId?: string) {
    const conditions: string[] = [`is_deleted = ${isDeleted}`]
    const params: (string | boolean)[] = []
    let idx = 1

    if (search) { params.push(`%${search}%`); conditions.push(`(category_name ILIKE $${idx} OR category_code ILIKE $${idx})`); idx++ }
    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`is_active = $${idx}`); idx++ }
    if (categoryId) { params.push(categoryId); conditions.push(`id = $${idx}`); idx++ }

    return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
  }

  async findAll(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: { is_active?: boolean }): Promise<{ data: Category[]; total: number }> {
    const { where, params, idx } = this.buildListQuery(false, undefined, filter)
    const orderBy = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `ORDER BY ${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}` : 'ORDER BY sort_order ASC, category_name ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM categories ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM categories ${where}`, params)
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findTrash(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<{ data: Category[]; total: number }> {
    const { where, params, idx } = this.buildListQuery(true)
    const orderBy = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `ORDER BY ${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM categories ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM categories ${where}`, params)
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<{ data: Category[]; total: number }> {
    const { where, params, idx } = this.buildListQuery(false, searchTerm)
    const orderBy = sort && ALLOWED_SORT_FIELDS.includes(sort.field) ? `ORDER BY ${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}` : ''

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT * FROM categories ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM categories ${where}`, params)
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string): Promise<Category | null> {
    const { rows } = await pool.query('SELECT * FROM categories WHERE id = $1', [id])
    return rows[0] ?? null
  }

  async findByCode(code: string): Promise<Category | null> {
    const { rows } = await pool.query('SELECT * FROM categories WHERE category_code = $1 AND is_deleted = false', [code])
    return rows[0] ?? null
  }

  async create(data: CreateCategoryDto & { created_by?: string; updated_by?: string }): Promise<Category> {
    const existing = await this.findByCode(data.category_code)
    if (existing) throw CategoryErrors.ALREADY_EXISTS(data.category_code)

    const insertData = { ...data, sort_order: data.sort_order ?? 0, is_active: data.is_active ?? true, is_deleted: false }
    const keys = Object.keys(insertData)
    const values = Object.values(insertData)
    const { rows } = await pool.query(
      `INSERT INTO categories (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return rows[0]
  }

  async updateById(id: string, updates: UpdateCategoryDto & { updated_by?: string }): Promise<Category | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE categories SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND is_deleted = false RETURNING *`,
      [...values, id]
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, userId?: string): Promise<void> {
    await pool.query('UPDATE categories SET is_deleted = true, updated_by = $1 WHERE id = $2 AND is_deleted = false', [userId || null, id])
  }

  async restore(id: string, userId?: string): Promise<void> {
    await pool.query('UPDATE categories SET is_deleted = false, updated_by = $1 WHERE id = $2 AND is_deleted = true', [userId || null, id])
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    await pool.query('UPDATE categories SET is_deleted = true, updated_by = $1 WHERE id = ANY($2::uuid[]) AND is_deleted = false', [userId || null, ids])
  }

  async updateStatus(id: string, is_active: boolean, userId?: string): Promise<Category | null> {
    const { rows } = await pool.query(
      'UPDATE categories SET is_active = $1, updated_by = $2 WHERE id = $3 AND is_deleted = false RETURNING *',
      [is_active, userId || null, id]
    )
    return rows[0] ?? null
  }

  async exportData(): Promise<Category[]> {
    const { rows } = await pool.query('SELECT * FROM categories WHERE is_deleted = false ORDER BY sort_order ASC')
    return rows
  }
}

export const categoriesRepository = new CategoriesRepository()
