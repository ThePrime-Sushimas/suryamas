import { pool } from '../../config/db'
import { Product, CreateProductDto, UpdateProductDto, ProductStatus } from './products.types'
import { mapProductFromDb, mapProductWithRelations } from './products.mapper'
import { PRODUCT_SORT_FIELDS, PRODUCT_LIMITS } from './products.constants'

export class ProductsRepository {
  private buildFilter(filter?: { status?: string; product_type?: string; category_id?: string; sub_category_id?: string }, search?: string, includeDeleted = false) {
    const conditions: string[] = []
    const params: (string | boolean)[] = []
    let idx = 1

    if (!includeDeleted) conditions.push('p.is_deleted = false')
    if (search) { params.push(`%${search}%`); conditions.push(`(p.product_name ILIKE $${idx} OR p.product_code ILIKE $${idx})`); idx++ }
    if (filter?.status) { params.push(filter.status); conditions.push(`p.status = $${idx}`); idx++ }
    if (filter?.product_type) { params.push(filter.product_type); conditions.push(`p.product_type = $${idx}`); idx++ }
    if (filter?.category_id) { params.push(filter.category_id); conditions.push(`p.category_id = $${idx}`); idx++ }
    if (filter?.sub_category_id) { params.push(filter.sub_category_id); conditions.push(`p.sub_category_id = $${idx}`); idx++ }

    return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params, idx }
  }

  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { status?: string; product_type?: string; category_id?: string; sub_category_id?: string },
    includeDeleted = false
  ): Promise<{ data: Product[]; total: number }> {
    const { where, params, idx } = this.buildFilter(filter, undefined, includeDeleted)
    const sortField = sort?.field && PRODUCT_SORT_FIELDS.includes(sort.field as typeof PRODUCT_SORT_FIELDS[number]) ? `p.${sort.field}` : 'p.product_name'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.*, c.category_name, sc.sub_category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN sub_categories sc ON sc.id = p.sub_category_id
         ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM products p ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapProductWithRelations), total: countRes.rows[0].total }
  }

  async search(
    searchTerm: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { status?: string; product_type?: string; category_id?: string; sub_category_id?: string },
    includeDeleted = false
  ): Promise<{ data: Product[]; total: number }> {
    const { where, params, idx } = this.buildFilter(filter, searchTerm, includeDeleted)
    const sortField = sort?.field && PRODUCT_SORT_FIELDS.includes(sort.field as typeof PRODUCT_SORT_FIELDS[number]) ? `p.${sort.field}` : 'p.product_name'
    const sortOrder = sort?.order === 'desc' ? 'DESC' : 'ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.*, c.category_name, sc.sub_category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN sub_categories sc ON sc.id = p.sub_category_id
         ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM products p ${where}`, params)
    ])

    return { data: dataRes.rows.map(mapProductWithRelations), total: countRes.rows[0].total }
  }

  async findById(id: string, includeDeleted = false): Promise<Product | null> {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id])
    if (!rows[0]) return null
    if (rows[0].is_deleted && !includeDeleted) return null
    return mapProductFromDb(rows[0])
  }

  async findByProductCode(code: string): Promise<Product | null> {
    const { rows } = await pool.query('SELECT * FROM products WHERE product_code = $1 AND is_deleted = false', [code])
    return rows[0] ? mapProductFromDb(rows[0]) : null
  }

  async findByProductName(name: string, excludeId?: string): Promise<Product | null> {
    const params: string[] = [name]
    let query = 'SELECT * FROM products WHERE product_name ILIKE $1 AND is_deleted = false'
    if (excludeId) { params.push(excludeId); query += ' AND id != $2' }
    const { rows } = await pool.query(query, params)
    return rows[0] ? mapProductFromDb(rows[0]) : null
  }

  async create(data: CreateProductDto & { created_by?: string; updated_by?: string }): Promise<Product> {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const { rows } = await pool.query(
      `INSERT INTO products (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    return mapProductFromDb(rows[0])
  }

  async updateById(id: string, updates: UpdateProductDto & { updated_by?: string; is_deleted?: boolean }): Promise<Product | null> {
    const keys = Object.keys(updates)
    if (!keys.length) return this.findById(id)
    const values = Object.values(updates)
    const { rows } = await pool.query(
      `UPDATE products SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    )
    return rows[0] ? mapProductFromDb(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await pool.query('UPDATE products SET is_deleted = true WHERE id = $1', [id])
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!ids?.length) throw new Error('Invalid ids array')
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    await pool.query('UPDATE products SET is_deleted = true WHERE id = ANY($1::uuid[])', [ids])
  }

  async bulkUpdateStatus(ids: string[], status: ProductStatus): Promise<void> {
    if (!ids?.length) throw new Error('Invalid ids array')
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    await pool.query('UPDATE products SET status = $1 WHERE id = ANY($2::uuid[])', [status, ids])
  }

  async bulkRestore(ids: string[]): Promise<void> {
    if (!ids?.length) throw new Error('Invalid ids array')
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) throw new Error(`Bulk operation exceeds maximum limit of ${PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE}`)
    await pool.query('UPDATE products SET is_deleted = false WHERE id = ANY($1::uuid[])', [ids])
  }

  async getFilterOptions(): Promise<{ statuses: string[]; productTypes: string[] }> {
    return { statuses: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'], productTypes: ['raw', 'semi_finished', 'finished_goods'] }
  }

  async minimalActive(): Promise<{ id: string; product_name: string }[]> {
    const { rows } = await pool.query(
      `SELECT id, product_name FROM products WHERE status = 'ACTIVE' AND is_deleted = false ORDER BY product_name LIMIT $1`,
      [PRODUCT_LIMITS.MAX_MINIMAL_PRODUCTS]
    )
    return rows
  }
}

export const productsRepository = new ProductsRepository()
