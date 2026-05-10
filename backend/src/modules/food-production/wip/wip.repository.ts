import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'
import type { WipItem, WipItemWithIngredients, WipIngredientWithProduct, CreateWipItemDto, UpdateWipItemDto, CreateWipIngredientDto } from './wip.types'

export class WipRepository {
  async findAll(companyId: string, pagination: { limit: number; offset: number }, filter?: { is_active?: boolean; positionIds?: string[]; canAccessAll?: boolean }): Promise<{ data: WipItem[]; total: number }> {
    const conditions = ['w.company_id = $1', 'w.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`w.is_active = $${idx++}`) }

    // Position-based filter: only WIPs accessible by user's positions
    if (filter?.positionIds && !filter.canAccessAll) {
      params.push(filter.positionIds)
      conditions.push(`(
        NOT EXISTS (SELECT 1 FROM wip_position_access wpa WHERE wpa.wip_id = w.id)
        OR EXISTS (SELECT 1 FROM wip_position_access wpa WHERE wpa.wip_id = w.id AND wpa.position_id = ANY($${idx}::uuid[]))
      )`)
      idx++
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT w.* FROM wip_items w ${where} ORDER BY w.wip_name ASC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM wip_items w ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyId: string, q: string, pagination: { limit: number; offset: number }): Promise<{ data: WipItem[]; total: number }> {
    const params = [companyId, `%${q}%`]
    const where = `WHERE w.company_id = $1 AND w.deleted_at IS NULL AND (w.wip_name ILIKE $2 OR w.wip_code ILIKE $2)`
    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT w.* FROM wip_items w ${where} ORDER BY w.wip_name ASC LIMIT $3 OFFSET $4`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM wip_items w ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<WipItem | null> {
    const { rows } = await pool.query('SELECT * FROM wip_items WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [id, companyId])
    return rows[0] ?? null
  }

  async findByIdWithIngredients(id: string, companyId: string): Promise<WipItemWithIngredients | null> {
    const item = await this.findById(id, companyId)
    if (!item) return null

    const { rows: ingredients } = await pool.query(
      `SELECT wi.*, p.product_code, p.product_name
       FROM wip_ingredients wi
       JOIN products p ON p.id = wi.product_id
       WHERE wi.wip_id = $1
       ORDER BY wi.sort_order ASC, p.product_name ASC`,
      [id]
    )
    return { ...item, ingredients }
  }

  async create(companyId: string, dto: CreateWipItemDto): Promise<WipItem> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows } = await client.query(
        `INSERT INTO wip_items (company_id, wip_code, wip_name, uom, yield_qty, notes, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING *`,
        [companyId, dto.wip_code, dto.wip_name, dto.uom ?? 'gram', dto.yield_qty ?? 1, dto.notes ?? null, dto.is_active ?? true, dto.created_by ?? null]
      )
      const wipItem = rows[0] as WipItem

      if (dto.ingredients?.length) {
        await this.replaceIngredients(client, wipItem.id, dto.ingredients)
        await this.recalculateCost(client, wipItem.id)
      }

      // Re-fetch to get updated estimated_cost
      const { rows: updated } = await client.query('SELECT * FROM wip_items WHERE id = $1', [wipItem.id])
      await client.query('COMMIT')
      return updated[0]
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async update(id: string, companyId: string, dto: UpdateWipItemDto): Promise<WipItem | null> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const fields: string[] = ['updated_at = now()']
      const values: unknown[] = []
      let idx = 1

      if (dto.wip_name !== undefined) { values.push(dto.wip_name); fields.push(`wip_name = $${idx++}`) }
      if (dto.uom !== undefined) { values.push(dto.uom); fields.push(`uom = $${idx++}`) }
      if (dto.yield_qty !== undefined) { values.push(dto.yield_qty); fields.push(`yield_qty = $${idx++}`) }
      if (dto.notes !== undefined) { values.push(dto.notes); fields.push(`notes = $${idx++}`) }
      if (dto.is_active !== undefined) { values.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
      if (dto.updated_by) { values.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

      if (fields.length > 1) {
        values.push(id, companyId)
        await client.query(
          `UPDATE wip_items SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL`,
          values
        )
      }

      if (dto.ingredients !== undefined) {
        await this.replaceIngredients(client, id, dto.ingredients)
        await this.recalculateCost(client, id)
      }

      const { rows } = await client.query('SELECT * FROM wip_items WHERE id = $1 AND deleted_at IS NULL', [id])
      await client.query('COMMIT')
      return rows[0] ?? null
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE wip_items SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async restore(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE wip_items SET deleted_at = NULL, is_deleted = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasRecipeLines(id: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM recipe_lines WHERE wip_id = $1', [id])
    return rows[0].cnt > 0
  }

  // ── Private helpers ──

  private async replaceIngredients(client: PoolClient, wipId: string, ingredients: CreateWipIngredientDto[]): Promise<void> {
    // Delete existing
    await client.query('DELETE FROM wip_ingredients WHERE wip_id = $1', [wipId])

    if (ingredients.length === 0) return

    // Batch fetch product costs
    const productIds = ingredients.map(i => i.product_id)
    const { rows: products } = await client.query(
      'SELECT id, average_cost FROM products WHERE id = ANY($1::uuid[])',
      [productIds]
    )
    const costMap = new Map(products.map(p => [p.id as string, Number(p.average_cost) || 0]))

    // Batch insert via unnest
    const wipIds = ingredients.map(() => wipId)
    const pIds = ingredients.map(i => i.product_id)
    const qtys = ingredients.map(i => i.qty)
    const uoms = ingredients.map(i => i.uom ?? 'gram')
    const costs = ingredients.map(i => costMap.get(i.product_id) ?? 0)
    const sorts = ingredients.map((_, idx) => idx + 1)

    await client.query(
      `INSERT INTO wip_ingredients (wip_id, product_id, qty, uom, cost_per_unit, sort_order)
       SELECT unnest($1::uuid[]), unnest($2::uuid[]), unnest($3::numeric[]), unnest($4::text[]), unnest($5::numeric[]), unnest($6::int[])`,
      [wipIds, pIds, qtys, uoms, costs, sorts]
    )
  }

  private async recalculateCost(client: PoolClient, wipId: string): Promise<void> {
    await client.query(
      `UPDATE wip_items SET estimated_cost = COALESCE((
        SELECT SUM(qty * cost_per_unit) FROM wip_ingredients WHERE wip_id = $1
      ), 0), updated_at = now() WHERE id = $1`,
      [wipId]
    )
  }
}

export const wipRepository = new WipRepository()
