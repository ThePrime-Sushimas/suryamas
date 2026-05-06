import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'
import type { RecipeLineWithDetails, SaveRecipeLineDto } from './recipes.types'

export class RecipesRepository {
  async getByMenuId(menuId: string): Promise<RecipeLineWithDetails[]> {
    const { rows } = await pool.query(
      `SELECT rl.*,
        COALESCE(p.product_name, w.wip_name) AS ingredient_name,
        COALESCE(p.product_code, w.wip_code) AS ingredient_code,
        CASE WHEN rl.product_id IS NOT NULL THEN 'product' ELSE 'wip' END AS ingredient_type
       FROM recipe_lines rl
       LEFT JOIN products p ON p.id = rl.product_id
       LEFT JOIN wip_items w ON w.id = rl.wip_id
       WHERE rl.menu_id = $1
       ORDER BY rl.sort_order ASC`,
      [menuId]
    )
    return rows
  }

  async saveRecipe(menuId: string, companyId: string, lines: SaveRecipeLineDto[]): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Delete existing lines
      await client.query('DELETE FROM recipe_lines WHERE menu_id = $1', [menuId])

      // 2. Insert new lines with cost lookup
      if (lines.length > 0) {
        // Batch fetch costs for products and wips
        const productIds = lines.filter(l => l.product_id).map(l => l.product_id!)
        const wipIds = lines.filter(l => l.wip_id).map(l => l.wip_id!)

        const costMap = new Map<string, number>()

        if (productIds.length > 0) {
          const { rows } = await client.query(
            'SELECT id, average_cost FROM products WHERE id = ANY($1::uuid[])',
            [productIds]
          )
          for (const r of rows) costMap.set(r.id, Number(r.average_cost) || 0)
        }

        if (wipIds.length > 0) {
          const { rows } = await client.query(
            'SELECT id, cost_per_unit FROM wip_items WHERE id = ANY($1::uuid[]) AND company_id = $2 AND deleted_at IS NULL',
            [wipIds, companyId]
          )
          for (const r of rows) costMap.set(r.id, Number(r.cost_per_unit) || 0)
        }

        // Batch insert via unnest
        const menuIds = lines.map(() => menuId)
        const pIds = lines.map(l => l.product_id ?? null)
        const wIds = lines.map(l => l.wip_id ?? null)
        const qtys = lines.map(l => l.qty)
        const uoms = lines.map(l => l.uom ?? 'gram')
        const costs = lines.map(l => costMap.get(l.product_id ?? l.wip_id ?? '') ?? 0)
        const sorts = lines.map((_, i) => i + 1)

        await client.query(
          `INSERT INTO recipe_lines (menu_id, product_id, wip_id, qty, uom, cost_per_unit, sort_order)
           SELECT unnest($1::uuid[]), unnest($2::uuid[]), unnest($3::uuid[]), unnest($4::numeric[]), unnest($5::text[]), unnest($6::numeric[]), unnest($7::int[])`,
          [menuIds, pIds, wIds, qtys, uoms, costs, sorts]
        )
      }

      // 3. Recalculate menu estimated_cost and has_recipe
      await this.recalculateMenuCost(client, menuId)

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // ── Cost Propagation ──

  /**
   * Recalculate a single menu's estimated_cost from its recipe_lines.
   * @param db - PoolClient (inside transaction) or pool (standalone)
   */
  private async recalculateMenuCost(db: PoolClient | typeof pool, menuId: string): Promise<void> {
    await db.query(
      `UPDATE menus SET
        estimated_cost = COALESCE((SELECT SUM(qty * cost_per_unit) FROM recipe_lines WHERE menu_id = $1), 0),
        has_recipe = EXISTS(SELECT 1 FROM recipe_lines WHERE menu_id = $1),
        updated_at = now()
      WHERE id = $1`,
      [menuId]
    )
  }

  /**
   * Called when products.average_cost changes.
   * Propagates: product → wip_ingredients → wip_items → recipe_lines → menus
   */
  async recalculateCostFromProduct(productId: string, companyId: string): Promise<{ wipsUpdated: number; menusUpdated: number }> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Get new cost
      const { rows: [product] } = await client.query('SELECT average_cost FROM products WHERE id = $1', [productId])
      if (!product) { await client.query('COMMIT'); return { wipsUpdated: 0, menusUpdated: 0 } }
      const newCost = Number(product.average_cost) || 0

      // 1. Update wip_ingredients that use this product (company-scoped)
      await client.query(
        `UPDATE wip_ingredients SET cost_per_unit = $1, updated_at = now()
         WHERE product_id = $2 AND wip_id IN (SELECT id FROM wip_items WHERE company_id = $3 AND deleted_at IS NULL)`,
        [newCost, productId, companyId]
      )

      // 2. Recalculate affected wip_items
      const { rows: affectedWips } = await client.query(
        `SELECT DISTINCT wi.wip_id FROM wip_ingredients wi
         JOIN wip_items w ON w.id = wi.wip_id
         WHERE wi.product_id = $1 AND w.company_id = $2 AND w.deleted_at IS NULL`,
        [productId, companyId]
      )
      const wipIds = affectedWips.map(r => r.wip_id as string)

      if (wipIds.length > 0) {
        await client.query(
          `UPDATE wip_items SET
            estimated_cost = COALESCE((SELECT SUM(qty * cost_per_unit) FROM wip_ingredients WHERE wip_id = wip_items.id), 0),
            updated_at = now()
          WHERE id = ANY($1::uuid[])`,
          [wipIds]
        )
      }

      // 3. Update recipe_lines that use this product directly (company-scoped)
      await client.query(
        `UPDATE recipe_lines SET cost_per_unit = $1, updated_at = now()
         WHERE product_id = $2 AND menu_id IN (SELECT id FROM menus WHERE company_id = $3 AND deleted_at IS NULL)`,
        [newCost, productId, companyId]
      )

      // 4. Update recipe_lines that use affected WIPs (company-scoped)
      if (wipIds.length > 0) {
        await client.query(
          `UPDATE recipe_lines rl SET
            cost_per_unit = w.cost_per_unit,
            updated_at = now()
          FROM wip_items w
          WHERE rl.wip_id = w.id AND rl.wip_id = ANY($1::uuid[])
            AND rl.menu_id IN (SELECT id FROM menus WHERE company_id = $2 AND deleted_at IS NULL)`,
          [wipIds, companyId]
        )
      }

      // 5. Recalculate affected menus (company-scoped)
      const { rows: affectedMenus } = await client.query(
        `SELECT DISTINCT rl.menu_id FROM recipe_lines rl
         JOIN menus m ON m.id = rl.menu_id
         WHERE (rl.product_id = $1 OR rl.wip_id = ANY($2::uuid[]))
           AND m.company_id = $3 AND m.deleted_at IS NULL`,
        [productId, wipIds, companyId]
      )
      const menuIds = affectedMenus.map(r => r.menu_id as string)

      if (menuIds.length > 0) {
        await client.query(
          `UPDATE menus SET
            estimated_cost = COALESCE((SELECT SUM(qty * cost_per_unit) FROM recipe_lines WHERE menu_id = menus.id), 0),
            has_recipe = EXISTS(SELECT 1 FROM recipe_lines WHERE menu_id = menus.id),
            updated_at = now()
          WHERE id = ANY($1::uuid[]) AND company_id = $2`,
          [menuIds, companyId]
        )
      }

      await client.query('COMMIT')
      return { wipsUpdated: wipIds.length, menusUpdated: menuIds.length }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  /**
   * Called when wip_items.yield_qty or ingredients change.
   * Propagates: wip → recipe_lines → menus
   */
  async recalculateCostFromWip(wipId: string, companyId: string): Promise<{ menusUpdated: number }> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Get new wip cost_per_unit
      const { rows: [wip] } = await client.query('SELECT cost_per_unit FROM wip_items WHERE id = $1', [wipId])
      if (!wip) { await client.query('COMMIT'); return { menusUpdated: 0 } }

      // 1. Update recipe_lines that use this WIP (filter by company via wip ownership)
      await client.query(
        `UPDATE recipe_lines SET cost_per_unit = $1, updated_at = now()
         WHERE wip_id = $2 AND menu_id IN (SELECT id FROM menus WHERE company_id = $3 AND deleted_at IS NULL)`,
        [Number(wip.cost_per_unit) || 0, wipId, companyId]
      )

      // 2. Recalculate affected menus (estimated_cost + has_recipe)
      const { rows: affectedMenus } = await client.query(
        'SELECT DISTINCT menu_id FROM recipe_lines WHERE wip_id = $1',
        [wipId]
      )
      const menuIds = affectedMenus.map(r => r.menu_id as string)

      if (menuIds.length > 0) {
        await client.query(
          `UPDATE menus SET
            estimated_cost = COALESCE((SELECT SUM(qty * cost_per_unit) FROM recipe_lines WHERE menu_id = menus.id), 0),
            has_recipe = EXISTS(SELECT 1 FROM recipe_lines WHERE menu_id = menus.id),
            updated_at = now()
          WHERE id = ANY($1::uuid[]) AND company_id = $2`,
          [menuIds, companyId]
        )
      }

      await client.query('COMMIT')
      return { menusUpdated: menuIds.length }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const recipesRepository = new RecipesRepository()
