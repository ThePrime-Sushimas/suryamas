import { wasteReportRepository } from '../waste-report.repository'
import type { WasteQueryContext, WasteRecord } from '../waste-report.types'

export class ProductionOrderWasteAdapter {
  async getWasteRecords(ctx: WasteQueryContext): Promise<WasteRecord[]> {
    const rows = await wasteReportRepository.getProductionOrderWasteRows(ctx)

    return rows.map((row) => {
      const qty = Number(row.qty) || 0
      const unitCost = Number(row.unit_cost) || 0
      const totalCost = Number(row.total_cost) || unitCost * qty
      const orderStatus = row.order_status as string | undefined

      return {
        source: 'PRODUCTION_ORDER' as const,
        date: new Date(row.record_date),
        branch_id: row.branch_id as string,
        branch_name: (row.branch_name as string | null) ?? undefined,
        item_id: row.item_id as string,
        item_name: row.item_name as string | undefined,
        qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        reason: (row.reason as string | null) ?? undefined,
        reference_id: row.production_order_id as string,
        reference_code: (row.reference_code as string | null) ?? undefined,
        metadata: {
          material_id: row.reference_id as string,
          wip_id: (row.wip_id as string | null) ?? undefined,
          production_line_id: row.production_line_id as string | undefined,
          order_status: orderStatus,
          is_provisional: orderStatus === 'DRAFT',
          is_voided: orderStatus === 'VOID',
          // TODO: recipe_id — not stored on production_order_materials; derive from wip/recipe module if needed
        },
      }
    })
  }
}

export const productionOrderWasteAdapter = new ProductionOrderWasteAdapter()
