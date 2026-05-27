import { pool } from '../../../config/db'
import { isPostgresError } from '../../../utils/postgres-error.util'
import { MenuBranchPriceDuplicateError } from './menu-branch-prices.errors'
import type { MenuBranchPrice, MenuBranchPriceWithBranch, CreateMenuBranchPriceDto, UpdateMenuBranchPriceDto, SyncFromPosResult } from './menu-branch-prices.types'

const SYNC_THRESHOLD = 0.05 // 5% price difference threshold

export class MenuBranchPricesRepository {
  /** INNER JOIN branches — only active branches shown. Closed branch prices are hidden intentionally. */
  async findByMenuId(menuId: string, companyId: string): Promise<MenuBranchPriceWithBranch[]> {
    const { rows } = await pool.query(
      `SELECT mbp.*, b.branch_name, (b.status = 'active') AS branch_is_active
       FROM menu_branch_prices mbp
       JOIN branches b ON b.id = mbp.branch_id AND b.status = 'active'
       WHERE mbp.menu_id = $1 AND mbp.company_id = $2 AND mbp.is_deleted = false
       ORDER BY b.branch_name`,
      [menuId, companyId]
    )
    return rows
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<MenuBranchPrice | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      'SELECT * FROM menu_branch_prices WHERE id = $1 AND company_id = ANY($2::uuid[]) AND is_deleted = false',
      [id, companyIds]
    )
    return rows[0] ?? null
  }

  async findById(id: string, companyId: string): Promise<MenuBranchPrice | null> {
    const { rows } = await pool.query(
      'SELECT * FROM menu_branch_prices WHERE id = $1 AND company_id = $2 AND is_deleted = false',
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async upsert(companyId: string, dto: CreateMenuBranchPriceDto): Promise<MenuBranchPrice> {
    try {
      const { rows } = await pool.query(
        `INSERT INTO menu_branch_prices (company_id, menu_id, branch_id, selling_price, price_type, source, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (menu_id, branch_id, price_type) WHERE is_deleted = false
         DO UPDATE SET selling_price = EXCLUDED.selling_price, source = 'MANUAL', updated_at = now(), updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [companyId, dto.menu_id, dto.branch_id, dto.selling_price, dto.price_type ?? 'DINE_IN', dto.source ?? 'MANUAL', dto.created_by ?? null]
      )
      return rows[0]
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new MenuBranchPriceDuplicateError()
      throw err
    }
  }

  /**
   * Manual edit always sets source = 'MANUAL'.
   * This means future POS sync will SKIP this record (by design).
   * User can "Reset ke POS" via delete + re-sync to revert.
   */
  async update(id: string, companyId: string, dto: UpdateMenuBranchPriceDto): Promise<MenuBranchPrice | null> {
    const { rows } = await pool.query(
      `UPDATE menu_branch_prices SET selling_price = $1, source = 'MANUAL', updated_at = now(), updated_by = $2
       WHERE id = $3 AND company_id = $4 AND is_deleted = false RETURNING *`,
      [dto.selling_price, dto.updated_by ?? null, id, companyId]
    )
    return rows[0] ?? null
  }

  async softDelete(id: string, companyId: string, userId?: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'UPDATE menu_branch_prices SET is_deleted = true, deleted_at = now(), updated_by = $1 WHERE id = $2 AND company_id = $3 AND is_deleted = false',
      [userId ?? null, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async syncFromPos(companyId: string, menuId?: string): Promise<SyncFromPosResult> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // visit_purpose_id mapping: 1=DINE_IN, 2=TAKEAWAY, 3/4/5=DELIVERY
      const menuFilter = menuId ? 'AND m.id = $2' : ''
      const params: unknown[] = [companyId]
      if (menuId) params.push(menuId)

      // 1. Get MODE prices grouped by menu × branch × price_type
      const { rows: modePrices } = await client.query(
        `SELECT m.id AS menu_id, sh.branch_id,
                CASE WHEN sh.visit_purpose_id = 1 THEN 'DINE_IN'
                     WHEN sh.visit_purpose_id = 2 THEN 'TAKEAWAY'
                     ELSE 'DELIVERY' END AS price_type,
                MODE() WITHIN GROUP (ORDER BY sm.original_price) AS mode_price,
                COUNT(*)::int AS tx_count
         FROM tr_salesmenu sm
         JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
         JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.company_id = $1 AND m.deleted_at IS NULL
         JOIN branches br ON br.id = sh.branch_id AND br.status = 'active'
         WHERE sm.status_id != 12
           AND sm.original_price > 0
           AND sh.sales_date >= (CURRENT_DATE - INTERVAL '90 days')
           ${menuFilter}
         GROUP BY m.id, sh.branch_id,
                  CASE WHEN sh.visit_purpose_id = 1 THEN 'DINE_IN'
                       WHEN sh.visit_purpose_id = 2 THEN 'TAKEAWAY'
                       ELSE 'DELIVERY' END
         HAVING COUNT(*) >= 3`,
        params
      )

      if (modePrices.length === 0) {
        await client.query('COMMIT')
        return { inserted: 0, synced: 0, skipped_manual: 0, skipped_threshold: 0 }
      }

      // 2. Get existing branch prices for comparison (all price_types)
      const menuIds = [...new Set(modePrices.map(r => r.menu_id))]
      const { rows: existing } = await client.query(
        `SELECT id, menu_id, branch_id, price_type, selling_price, source
         FROM menu_branch_prices
         WHERE company_id = $1 AND menu_id = ANY($2) AND is_deleted = false`,
        [companyId, menuIds]
      )
      const existingMap = new Map(existing.map(r => [`${r.menu_id}:${r.branch_id}:${r.price_type}`, r]))

      // 3. Process each MODE price
      let synced = 0, skippedManual = 0, skippedThreshold = 0

      const toInsert: Array<{ menu_id: string; branch_id: string; price: number; price_type: string }> = []
      const toUpdate: Array<{ id: string; price: number }> = []

      for (const row of modePrices) {
        const key = `${row.menu_id}:${row.branch_id}:${row.price_type}`
        const ex = existingMap.get(key)
        const modePrice = Number(row.mode_price)

        if (!ex) {
          toInsert.push({ menu_id: row.menu_id, branch_id: row.branch_id, price: modePrice, price_type: row.price_type })
        } else if (ex.source === 'MANUAL' || ex.source === 'IMPORT') {
          skippedManual++
        } else {
          const diff = Math.abs(modePrice - Number(ex.selling_price)) / Number(ex.selling_price)
          if (diff <= SYNC_THRESHOLD) {
            skippedThreshold++
          } else {
            toUpdate.push({ id: ex.id, price: modePrice })
            synced++
          }
        }
      }

      // 4. Batch INSERT via unnest — use RETURNING to get actual inserted count
      let inserted = 0
      if (toInsert.length > 0) {
        const insertResult = await client.query(
          `INSERT INTO menu_branch_prices (company_id, menu_id, branch_id, selling_price, price_type, source, synced_at)
           SELECT $1, d.menu_id, d.branch_id, d.price, d.price_type, 'POS_SYNC', now()
           FROM (SELECT unnest($2::uuid[]) AS menu_id, unnest($3::uuid[]) AS branch_id, unnest($4::numeric[]) AS price, unnest($5::text[]) AS price_type) d
           ON CONFLICT (menu_id, branch_id, price_type) WHERE is_deleted = false DO NOTHING
           RETURNING id`,
          [companyId, toInsert.map(i => i.menu_id), toInsert.map(i => i.branch_id), toInsert.map(i => i.price), toInsert.map(i => i.price_type)]
        )
        inserted = insertResult.rowCount ?? 0
      }

      // 5. Batch UPDATE via unnest
      if (toUpdate.length > 0) {
        await client.query(
          `UPDATE menu_branch_prices SET selling_price = d.price, source = 'POS_SYNC', synced_at = now(), updated_at = now()
           FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::numeric[]) AS price) d
           WHERE menu_branch_prices.id = d.id`,
          [toUpdate.map(u => u.id), toUpdate.map(u => u.price)]
        )
      }

      await client.query('COMMIT')
      return { inserted, synced, skipped_manual: skippedManual, skipped_threshold: skippedThreshold }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const menuBranchPricesRepository = new MenuBranchPricesRepository()
