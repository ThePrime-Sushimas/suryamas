import { wasteReportRepository } from '../waste-report.repository'
import type { WasteQueryContext, WasteRecord } from '../waste-report.types'

export class GoodsProcessingWasteAdapter {
  async getWasteRecords(ctx: WasteQueryContext): Promise<WasteRecord[]> {
    const rows = await wasteReportRepository.getGoodsProcessingWasteRows(ctx)

    return rows.map((row) => {
      const qty = Number(row.qty) || 0
      const unitCost = Number(row.unit_cost) || 0
      const costUnavailable = unitCost === 0
      const totalCost = costUnavailable ? 0 : Number(row.total_cost) || unitCost * qty

      return {
        source: 'GOODS_PROCESSING' as const,
        date: new Date(row.record_date),
        branch_id: row.branch_id as string,
        branch_name: (row.branch_name as string | null) ?? undefined,
        item_id: row.item_id as string,
        item_name: row.item_name as string | undefined,
        qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        reason: (row.reason as string | null) ?? undefined,
        reference_id: row.reference_id as string,
        reference_code: (row.reference_code as string | null) ?? undefined,
        metadata: {
          yield_percentage: row.yield_percentage != null ? Number(row.yield_percentage) : undefined,
          supplier_id: row.supplier_id as string | undefined,
          goods_processing_id: row.goods_processing_id as string,
          ...(costUnavailable ? { cost_unavailable: true } : {}),
        },
      }
    })
  }
}

export const goodsProcessingWasteAdapter = new GoodsProcessingWasteAdapter()
