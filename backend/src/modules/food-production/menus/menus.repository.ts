import { pool } from '../../../config/db'
import type { Menu, MenuWithRelations, CreateMenuDto, UpdateMenuDto } from './menus.types'

const BASE_SELECT = `
  m.*, mc.category_name, mc.category_code, mg.group_name, mg.group_code
`
const BASE_FROM = `
  FROM menus m
  JOIN menu_categories mc ON mc.id = m.category_id
  LEFT JOIN menu_groups mg ON mg.id = m.group_id
`

export class MenusRepository {
  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean; category_id?: string; group_id?: string; has_recipe?: boolean; sync_enabled?: boolean }): Promise<{ data: MenuWithRelations[]; total: number }> {
    const conditions = ['m.company_id = $1', 'm.deleted_at IS NULL']
    const params: unknown[] = [companyId]
    let idx = 2

    if (filter?.is_active !== undefined) { params.push(filter.is_active); conditions.push(`m.is_active = $${idx++}`) }
    if (filter?.category_id) { params.push(filter.category_id); conditions.push(`m.category_id = $${idx++}`) }
    if (filter?.group_id) { params.push(filter.group_id); conditions.push(`m.group_id = $${idx++}`) }
    if (filter?.has_recipe !== undefined) { params.push(filter.has_recipe); conditions.push(`m.has_recipe = $${idx++}`) }
    if (filter?.sync_enabled !== undefined) { params.push(filter.sync_enabled); conditions.push(`m.sync_enabled = $${idx++}`) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const allowedSort = ['menu_code', 'menu_name', 'selling_price', 'estimated_cost', 'cost_percentage', 'created_at']
    const orderBy = sort && allowedSort.includes(sort.field)
      ? `ORDER BY m.${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`
      : 'ORDER BY mc.sort_order ASC, m.menu_name ASC'

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM menus m ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async search(companyId: string, q: string, pagination: { limit: number; offset: number }): Promise<{ data: MenuWithRelations[]; total: number }> {
    const params = [companyId, `%${q}%`]
    const where = `WHERE m.company_id = $1 AND m.deleted_at IS NULL AND (m.menu_name ILIKE $2 OR m.menu_code ILIKE $2)`

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ORDER BY m.menu_name ASC LIMIT $3 OFFSET $4`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM menus m ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<MenuWithRelations | null> {
    const { rows } = await pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} WHERE m.id = $1 AND m.company_id = $2 AND m.deleted_at IS NULL`, [id, companyId])
    return rows[0] ?? null
  }

  async findByPosMenuId(posMenuId: number, companyId: string): Promise<Menu | null> {
    const { rows } = await pool.query('SELECT * FROM menus WHERE pos_menu_id = $1 AND company_id = $2 AND deleted_at IS NULL', [posMenuId, companyId])
    return rows[0] ?? null
  }

  async create(companyId: string, dto: CreateMenuDto): Promise<Menu> {
    const { rows } = await pool.query(
      `INSERT INTO menus (company_id, pos_menu_id, category_id, group_id, menu_code, menu_name, selling_price, is_active, sync_enabled, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING *`,
      [companyId, dto.pos_menu_id ?? null, dto.category_id, dto.group_id ?? null, dto.menu_code, dto.menu_name, dto.selling_price ?? 0, dto.is_active ?? true, dto.sync_enabled ?? true, dto.created_by ?? null]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateMenuDto): Promise<Menu | null> {
    const fields: string[] = ['updated_at = now()']
    const values: unknown[] = []
    let idx = 1

    if (dto.category_id !== undefined) { values.push(dto.category_id); fields.push(`category_id = $${idx++}`) }
    if (dto.group_id !== undefined) { values.push(dto.group_id); fields.push(`group_id = $${idx++}`) }
    if (dto.menu_name !== undefined) { values.push(dto.menu_name); fields.push(`menu_name = $${idx++}`) }
    if (dto.selling_price !== undefined) { values.push(dto.selling_price); fields.push(`selling_price = $${idx++}`) }
    if (dto.is_active !== undefined) { values.push(dto.is_active); fields.push(`is_active = $${idx++}`) }
    if (dto.sync_enabled !== undefined) { values.push(dto.sync_enabled); fields.push(`sync_enabled = $${idx++}`) }
    if (dto.updated_by) { values.push(dto.updated_by); fields.push(`updated_by = $${idx++}`) }

    values.push(id, companyId)
    const { rows } = await pool.query(
      `UPDATE menus SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menus SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async restore(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menus SET deleted_at = NULL, is_deleted = false, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async hasRecipeLines(id: string): Promise<boolean> {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM recipe_lines WHERE menu_id = $1', [id])
    return rows[0].cnt > 0
  }

  async hasCogcCalculationLines(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM cogs_calculation_lines cl JOIN cogs_calculations c ON c.id = cl.calculation_id WHERE cl.menu_id = $1 AND c.status = 'JOURNALED'",
      [id]
    )
    return rows[0].cnt > 0
  }

  // ── Batch Sync from POS (single transaction, no N+1) ──

  async batchSyncFromPos(companyId: string, forceAll: boolean): Promise<{ inserted: number; updated: number; skipped: number }> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Get all POS menus in one query
      const { rows: posMenus } = await client.query('SELECT pos_id, menu_name, price, flag_active, pos_group_id FROM pos_staging_menus')

      // 2. Get all existing menus for this company in one query
      const { rows: existingMenus } = await client.query(
        'SELECT id, pos_menu_id, sync_enabled FROM menus WHERE company_id = $1 AND pos_menu_id IS NOT NULL AND deleted_at IS NULL',
        [companyId]
      )
      const existingMap = new Map(existingMenus.map(m => [m.pos_menu_id as number, m]))

      // 3. Get category/group mapping in one query
      const { rows: mappingRows } = await client.query(
        `SELECT psg.pos_id AS group_pos_id, psg.pos_category_id,
                mc.id AS category_id, mg.id AS group_id
         FROM pos_staging_menu_groups psg
         LEFT JOIN menu_categories mc ON mc.company_id = $1
           AND mc.category_code = CASE psg.pos_category_id WHEN 2 THEN 'FOOD' WHEN 3 THEN 'BEVERAGE' ELSE 'OTHER' END
           AND mc.deleted_at IS NULL
         LEFT JOIN menu_groups mg ON mg.company_id = $1
           AND mg.group_code = UPPER(REPLACE(psg.group_name, ' ', '-')) || '-' || psg.pos_id::text
           AND mg.deleted_at IS NULL`,
        [companyId]
      )
      const groupMapping = new Map(mappingRows.map(r => [r.group_pos_id as number, { category_id: r.category_id, group_id: r.group_id }]))

      // 4. Fallback category
      const { rows: fallbackRows } = await client.query(
        "SELECT id FROM menu_categories WHERE company_id = $1 AND category_code = 'OTHER' AND deleted_at IS NULL",
        [companyId]
      )
      const fallbackCategoryId = fallbackRows[0]?.id

      // 5. Process: batch update existing, batch insert new
      const toUpdate: Array<{ id: string; menu_name: string; selling_price: number; is_active: boolean }> = []
      const toInsert: Array<{ pos_menu_id: number; category_id: string; group_id: string | null; menu_name: string; selling_price: number; is_active: boolean }> = []
      let skipped = 0

      for (const pm of posMenus) {
        const existing = existingMap.get(pm.pos_id)
        if (existing) {
          if (!forceAll && !existing.sync_enabled) { skipped++; continue }
          toUpdate.push({ id: existing.id, menu_name: pm.menu_name, selling_price: Number(pm.price), is_active: pm.flag_active === 1 })
        } else {
          const mapping = groupMapping.get(pm.pos_group_id) ?? { category_id: fallbackCategoryId, group_id: null }
          toInsert.push({
            pos_menu_id: pm.pos_id,
            category_id: mapping.category_id ?? fallbackCategoryId,
            group_id: mapping.group_id,
            menu_name: pm.menu_name,
            selling_price: Number(pm.price),
            is_active: pm.flag_active === 1,
          })
        }
      }

      // 6. Batch UPDATE via unnest
      if (toUpdate.length > 0) {
        const ids = toUpdate.map(u => u.id)
        const names = toUpdate.map(u => u.menu_name)
        const prices = toUpdate.map(u => u.selling_price)
        const actives = toUpdate.map(u => u.is_active)

        await client.query(
          `UPDATE menus SET
            menu_name = d.menu_name, selling_price = d.selling_price::numeric,
            is_active = d.is_active, last_synced_at = now(), updated_at = now()
          FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS menu_name, unnest($3::numeric[]) AS selling_price, unnest($4::boolean[]) AS is_active) d
          WHERE menus.id = d.id`,
          [ids, names, prices, actives]
        )
      }

      // 7. Batch INSERT via unnest
      if (toInsert.length > 0) {
        const posIds = toInsert.map(i => i.pos_menu_id)
        const catIds = toInsert.map(i => i.category_id)
        const grpIds = toInsert.map(i => i.group_id)
        const codes = toInsert.map(i => 'MENU-' + i.pos_menu_id)
        const names = toInsert.map(i => i.menu_name)
        const prices = toInsert.map(i => i.selling_price)
        const actives = toInsert.map(i => i.is_active)

        await client.query(
          `INSERT INTO menus (company_id, pos_menu_id, category_id, group_id, menu_code, menu_name, selling_price, is_active, sync_enabled, last_synced_at)
           SELECT $1, d.pos_menu_id, d.category_id, d.group_id, d.menu_code, d.menu_name, d.selling_price::numeric, d.is_active, true, now()
           FROM (SELECT unnest($2::int[]) AS pos_menu_id, unnest($3::uuid[]) AS category_id, unnest($4::uuid[]) AS group_id,
                        unnest($5::text[]) AS menu_code, unnest($6::text[]) AS menu_name, unnest($7::numeric[]) AS selling_price, unnest($8::boolean[]) AS is_active) d
           ON CONFLICT (company_id, pos_menu_id) DO NOTHING`,
          [companyId, posIds, catIds, grpIds, codes, names, prices, actives]
        )
      }

      await client.query('COMMIT')
      return { inserted: toInsert.length, updated: toUpdate.length, skipped }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const menusRepository = new MenusRepository()
