/**
 * POS Sync → Stock OUT_SALES Movement Generator
 *
 * When POS data is synced, this service generates OUT_SALES stock movements
 * for WIP output products. This ensures that when a menu is sold, the stock
 * of the WIP's output product in the appropriate warehouse (READY/FINISHED_GOODS)
 * is automatically reduced.
 *
 * This makes daily stock opname variance accurate for WIP outputs.
 */
import { pool } from '../../config/db'
import { logInfo, logWarn, logError } from '../../config/logger'
import { stockService } from '../stock/stock.service'
import type { SaleInput, SaleItemInput } from './pos-sync.types'

interface WipOutputMovementRow {
  sales_num: string
  sales_date: string
  branch_id: string
  menu_id: string
  item_qty: number
  recipe_line_qty: number
  wip_id: string
  wip_name: string
  output_product_id: string
  output_warehouse: 'READY' | 'FINISHED_GOODS'
  cost_per_unit: number
  menu_name: string
  mapped_branch_id: string
}

/**
 * Fire-and-forget: generates OUT_SALES stock movements for WIP output products
 * based on the POS sales data that was just synced.
 */
export async function generateWipOutputSalesMovements(
  sales: SaleInput[],
  items: SaleItemInput[]
): Promise<void> {
  if (!items.length || !sales.length) return

  try {
    const salesNums = [...new Set(items.map(i => i.salesNum))]
    if (!salesNums.length) return

    const { rows } = await pool.query<WipOutputMovementRow>(`
      SELECT
        sh.sales_num,
        sh.sales_date,
        sh.branch_id,
        sm.menu_id,
        sm.qty AS item_qty,
        rl.qty AS recipe_line_qty,
        wip.id AS wip_id,
        wip.wip_name,
        wip.output_product_id,
        wip.output_warehouse,
        wip.cost_per_unit,
        m.menu_name,
        psb.mapped_id AS mapped_branch_id
      FROM tr_salesmenu sm
      JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
      JOIN menus m ON m.pos_menu_id = sm.menu_id::int AND m.deleted_at IS NULL
      JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
      JOIN wip_items wip ON wip.id = rl.wip_id
        AND wip.output_product_id IS NOT NULL
        AND wip.is_deleted = false
      JOIN pos_staging_branches psb ON psb.pos_id = sh.branch_id::int
        AND psb.mapped_id IS NOT NULL
      WHERE sm.sales_num = ANY($1::text[])
        AND sm.status_id = '13'
    `, [salesNums])

    if (!rows.length) return

    logInfo('POS OUT_SALES: processing movements', {
      salesNums: salesNums.length,
      movementRows: rows.length,
    })

    const warehouseCache = new Map<string, string | null>()

    for (const row of rows) {
      const cacheKey = `${row.mapped_branch_id}:${row.output_warehouse}`

      if (!warehouseCache.has(cacheKey)) {
        const { rows: whRows } = await pool.query(
          `SELECT id FROM warehouses WHERE branch_id = $1 AND warehouse_type = $2 AND deleted_at IS NULL LIMIT 1`,
          [row.mapped_branch_id, row.output_warehouse]
        )
        warehouseCache.set(cacheKey, whRows[0]?.id ?? null)
      }

      const warehouseId = warehouseCache.get(cacheKey)
      if (!warehouseId) {
        logWarn('POS OUT_SALES: no warehouse found, skipping', {
          branch_id: row.mapped_branch_id,
          warehouse_type: row.output_warehouse,
          sales_num: row.sales_num,
        })
        continue
      }

      // Idempotency check
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM stock_movements
         WHERE reference_type = 'pos_sync'
           AND reference_id = $1
           AND product_id = $2
           AND warehouse_id = $3
         LIMIT 1`,
        [row.sales_num, row.output_product_id, warehouseId]
      )

      if (existing.length > 0) continue

      const qtyOut = row.recipe_line_qty * row.item_qty
      if (qtyOut <= 0) continue

      try {
        const result = await stockService.createMovement(
          {
            warehouse_id: warehouseId,
            product_id: row.output_product_id,
            movement_type: 'OUT_SALES',
            qty: qtyOut,
            cost_per_unit: row.cost_per_unit,
            reference_type: 'pos_sync',
            reference_id: row.sales_num,
            movement_date: row.sales_date,
            notes: `POS ${row.sales_num} - ${row.menu_name}`,
            allowNegative: true,
          },
          ''
        )

        if (result.newBalance < 0) {
          logWarn('POS OUT_SALES: caused negative stock', {
            product_id: row.output_product_id,
            warehouse_id: warehouseId,
            balance_after: result.newBalance,
            sales_num: row.sales_num,
          })
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logError('POS OUT_SALES: movement creation failed', {
          sales_num: row.sales_num,
          product_id: row.output_product_id,
          warehouse_id: warehouseId,
          error: errMsg,
        })
      }
    }

    logInfo('POS OUT_SALES: completed', { salesNums: salesNums.length })
  } catch (err) {
    logError('POS OUT_SALES: fatal error in generateWipOutputSalesMovements', { err })
  }
}
