import { goodsProcessingWasteAdapter } from './adapters/goods-processing.adapter'
import { stockAdjustmentWasteAdapter } from './adapters/stock-adjustment.adapter'
import { productionOrderWasteAdapter } from './adapters/production-order.adapter'
import { dailyOpnameWasteAdapter } from './adapters/daily-opname.adapter'
import { monthlyOpnameAdapter } from './adapters/monthly-opname.adapter'
import { wasteReportRepository } from './waste-report.repository'
import { WasteReportError } from './waste-report.errors'
import type {
  WasteByItemGroup,
  WasteQueryContext,
  WasteRecord,
  WasteReportFilter,
  WasteReportResponse,
  WasteReportSummary,
  MonthlyOpnameSelisih,
} from './waste-report.types'
import { emptyBreakdownBySource, WASTE_SOURCES } from './waste-report.types'

const MAX_RANGE_DAYS = 366

async function enrichWithBranchNames<T extends { branch_id: string; branch_name?: string }>(
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows
  const ids = [...new Set(rows.map((r) => r.branch_id))]
  const nameMap = await wasteReportRepository.getBranchNameMap(ids)
  return rows.map((r) => ({
    ...r,
    branch_name: nameMap.get(r.branch_id) ?? r.branch_name,
  }))
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildQueryContext(filter: WasteReportFilter): WasteQueryContext {
  const branchIds = filter.branch_id
    ? filter.branch_ids.filter((id) => id === filter.branch_id)
    : filter.branch_ids

  return {
    branchIds,
    startDate: toDateString(filter.start_date),
    endDate: toDateString(filter.end_date),
    itemId: filter.item_id,
    categoryId: filter.category_id,
  }
}

function validateFilter(filter: WasteReportFilter): void {
  if (!filter.start_date || !filter.end_date) {
    throw new WasteReportError('start_date dan end_date wajib diisi')
  }
  if (filter.start_date > filter.end_date) {
    throw new WasteReportError('start_date harus sebelum atau sama dengan end_date')
  }
  const diffDays =
    Math.ceil((filter.end_date.getTime() - filter.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diffDays > MAX_RANGE_DAYS) {
    throw new WasteReportError(`Maksimal range tanggal ${MAX_RANGE_DAYS} hari`)
  }
  if (filter.branch_ids.length === 0) {
    throw new WasteReportError('Tidak memiliki akses cabang')
  }
  if (filter.branch_id && !filter.branch_ids.includes(filter.branch_id)) {
    throw new WasteReportError('Tidak memiliki akses ke cabang ini')
  }
}

export class WasteAggregatorService {
  constructor(
    private goodsProcessingAdapter = goodsProcessingWasteAdapter,
    private stockAdjustmentAdapter = stockAdjustmentWasteAdapter,
    private productionOrderAdapter = productionOrderWasteAdapter,
    private dailyOpnameAdapter = dailyOpnameWasteAdapter,
    private monthlyOpnameAdapterRef = monthlyOpnameAdapter,
  ) {}

  async getWasteReport(filter: WasteReportFilter): Promise<WasteReportResponse> {
    validateFilter(filter)
    const ctx = buildQueryContext(filter)

    const sourcesToFetch = filter.source ? [filter.source] : WASTE_SOURCES

    const fetchTasks: Promise<WasteRecord[]>[] = []
    if (sourcesToFetch.includes('GOODS_PROCESSING')) {
      fetchTasks.push(this.goodsProcessingAdapter.getWasteRecords(ctx))
    }
    if (sourcesToFetch.includes('STOCK_ADJUSTMENT')) {
      fetchTasks.push(this.stockAdjustmentAdapter.getWasteRecords(ctx))
    }
    if (sourcesToFetch.includes('PRODUCTION_ORDER')) {
      fetchTasks.push(this.productionOrderAdapter.getWasteRecords(ctx))
    }
    if (sourcesToFetch.includes('DAILY_OPNAME')) {
      fetchTasks.push(this.dailyOpnameAdapter.getWasteRecords(ctx))
    }

    const [recordGroups, monthlySelisih, totalPurchaseCost] = await Promise.all([
      Promise.all(fetchTasks),
      this.monthlyOpnameAdapterRef.getMonthlySelisih(ctx),
      wasteReportRepository.getTotalPurchaseCost(ctx),
    ])

    const records = await enrichWithBranchNames(
      recordGroups.flat().sort((a, b) => b.date.getTime() - a.date.getTime()),
    )
    const monthlyWithBranches = await enrichWithBranchNames(monthlySelisih)
    const summary = this.calculateSummary(records, totalPurchaseCost)

    return {
      filter,
      summary,
      records,
      monthly_selisih: monthlyWithBranches,
    }
  }

  async getSummary(filter: WasteReportFilter): Promise<WasteReportSummary> {
    const report = await this.getWasteReport(filter)
    return report.summary
  }

  async getByItem(filter: WasteReportFilter): Promise<WasteByItemGroup[]> {
    const report = await this.getWasteReport(filter)
    const grouped = new Map<string, WasteByItemGroup>()

    for (const record of report.records) {
      let group = grouped.get(record.item_id)
      if (!group) {
        group = {
          item_id: record.item_id,
          item_name: record.item_name,
          total_qty: 0,
          total_cost: 0,
          record_count: 0,
          breakdown_by_source: emptyBreakdownBySource(),
        }
        grouped.set(record.item_id, group)
      }
      group.total_qty += record.qty
      group.total_cost += record.total_cost
      group.record_count += 1
      group.breakdown_by_source[record.source].qty += record.qty
      group.breakdown_by_source[record.source].cost += record.total_cost
      if (!group.item_name && record.item_name) group.item_name = record.item_name
    }

    return [...grouped.values()].sort((a, b) => b.total_cost - a.total_cost)
  }

  async getMonthlySelisih(filter: WasteReportFilter): Promise<MonthlyOpnameSelisih[]> {
    validateFilter(filter)
    const ctx = buildQueryContext(filter)
    return this.monthlyOpnameAdapterRef.getMonthlySelisih(ctx)
  }

  private calculateSummary(records: WasteRecord[], totalPurchaseCost: number): WasteReportSummary {
    const breakdown = emptyBreakdownBySource()
    let totalQty = 0
    let totalCost = 0

    for (const record of records) {
      totalQty += record.qty
      totalCost += record.total_cost
      breakdown[record.source].qty += record.qty
      breakdown[record.source].cost += record.total_cost
    }

    const summary: WasteReportSummary = {
      total_waste_qty: totalQty,
      total_waste_cost: totalCost,
      breakdown_by_source: breakdown,
    }

    if (totalPurchaseCost > 0) {
      summary.percentage_of_purchase = Math.round((totalCost / totalPurchaseCost) * 10000) / 100
    }

    return summary
  }
}

export const wasteAggregatorService = new WasteAggregatorService()
