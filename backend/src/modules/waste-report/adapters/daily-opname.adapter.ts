import { wasteReportRepository } from '../waste-report.repository'
import type { WasteQueryContext, WasteRecord } from '../waste-report.types'

export class DailyOpnameWasteAdapter {
  async getWasteRecords(ctx: WasteQueryContext): Promise<WasteRecord[]> {
    const rows = await wasteReportRepository.getDailyOpnameWasteRows(ctx)

    return rows.map((row) => {
      const qty = Number(row.qty) || 0
      const unitCost = Number(row.unit_cost) || 0
      const totalCost = Number(row.total_cost) || unitCost * qty

      return {
        source: 'DAILY_OPNAME' as const,
        date: new Date(row.record_date),
        branch_id: row.branch_id as string,
        branch_name: (row.branch_name as string | null) ?? undefined,
        item_id: row.item_id as string,
        item_name: row.item_name as string | undefined,
        qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_id: row.reference_id as string,
        reference_code: (row.reference_code as string | null) ?? undefined,
        metadata: {
          classified_by_user_id: row.classified_by as string,
          closing_id: row.closing_id as string,
          position_id: (row.position_id as string | null) ?? undefined,
          // TODO: shift — not tracked on daily_closing_counts entity
        },
      }
    })
  }
}

export const dailyOpnameWasteAdapter = new DailyOpnameWasteAdapter()
