import { wasteReportRepository } from '../waste-report.repository'
import type { MonthlyOpnameSelisih, WasteQueryContext } from '../waste-report.types'

export class MonthlyOpnameAdapter {
  async getMonthlySelisih(ctx: WasteQueryContext): Promise<MonthlyOpnameSelisih[]> {
    const rows = await wasteReportRepository.getMonthlyOpnameSelisihRows(ctx)

    return rows.map((row) => ({
      date: new Date(row.record_date),
      branch_id: row.branch_id as string,
      branch_name: (row.branch_name as string | null) ?? undefined,
      item_id: row.item_id as string,
      item_name: row.item_name as string | undefined,
      selisih_qty: Number(row.selisih_qty) || 0,
      selisih_value: Number(row.selisih_value) || 0,
      investigasi_note: (row.investigasi_note as string | null) ?? undefined,
      reference_id: row.reference_id as string,
    }))
  }
}

export const monthlyOpnameAdapter = new MonthlyOpnameAdapter()
