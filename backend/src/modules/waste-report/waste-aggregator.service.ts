import { goodsProcessingWasteAdapter } from './adapters/goods-processing.adapter'
import { stockAdjustmentWasteAdapter } from './adapters/stock-adjustment.adapter'
import { productionOrderWasteAdapter } from './adapters/production-order.adapter'
import { dailyOpnameWasteAdapter } from './adapters/daily-opname.adapter'
import { monthlyOpnameAdapter } from './adapters/monthly-opname.adapter'
import { wasteReportRepository } from './waste-report.repository'
import { WasteReportError } from './waste-report.errors'
import { theoreticalConsumptionRepository } from '../food-production/theoretical-consumption/theoretical-consumption.repository'
import type {
  WasteBranchGroup,
  WasteByItemGroup,
  WasteComparePeriod,
  WasteCompareResponse,
  WasteQueryContext,
  WasteRecord,
  WasteReportFilter,
  WasteReportResponse,
  WasteReportSummary,
  WasteVarianceSummary,
  WasteVarianceSummaryResponse,
  VarianceSeverity,
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

  async getByBranch(filter: WasteReportFilter): Promise<WasteBranchGroup[]> {
    validateFilter(filter)
    const ctx: WasteQueryContext = {
      branchIds: filter.branch_ids,
      startDate: toDateString(filter.start_date),
      endDate: toDateString(filter.end_date),
      itemId: filter.item_id,
      categoryId: filter.category_id,
    }

    const rows = await wasteReportRepository.getWasteGroupedByBranch(ctx)
    const filteredRows = filter.source ? rows.filter((r) => r.source === filter.source) : rows

    const grouped = new Map<string, WasteBranchGroup>()

    for (const row of filteredRows) {
      let group = grouped.get(row.branch_id)
      if (!group) {
        group = {
          branch_id: row.branch_id,
          branch_name: row.branch_name ?? undefined,
          total_qty: 0,
          total_cost: 0,
          record_count: 0,
          breakdown_by_source: emptyBreakdownBySource(),
        }
        grouped.set(row.branch_id, group)
      }
      group.total_qty += row.total_qty
      group.total_cost += row.total_cost
      group.record_count += row.record_count
      group.breakdown_by_source[row.source].qty += row.total_qty
      group.breakdown_by_source[row.source].cost += row.total_cost
      if (!group.branch_name && row.branch_name) group.branch_name = row.branch_name
    }

    const result = [...grouped.values()].sort((a, b) => b.total_cost - a.total_cost)
    const grandTotal = result.reduce((sum, g) => sum + g.total_cost, 0)

    if (grandTotal > 0) {
      for (const group of result) {
        group.percentage_of_total = Math.round((group.total_cost / grandTotal) * 10000) / 100
      }
    }

    return result
  }

  /**
   * Variance Summary: join theoretical-consumption variance with waste records from 4 sources.
   * Shows per-item: actual, theoretical, variance, waste, and unexplained qty.
   */
  async getVarianceSummary(filter: WasteReportFilter): Promise<WasteVarianceSummaryResponse> {
    validateFilter(filter)
    const ctx = buildQueryContext(filter)
    const startDate = toDateString(filter.start_date)
    const endDate = toDateString(filter.end_date)

    // Resolve branch for theoretical (needs POS int ID)
    let branchPosId: number | undefined
    let branchUuid: string | undefined
    if (filter.branch_id) {
      try {
        const resolved = await theoreticalConsumptionRepository.resolveBranchIds(filter.branch_id)
        branchPosId = resolved.branchPosId
        branchUuid = resolved.branchUuid
      } catch {
        // Branch tidak punya POS mapping — theoretical akan kosong, hanya waste yang tampil
        branchPosId = undefined
        branchUuid = filter.branch_id
      }
    }

    // Fetch both sources in parallel
    const [varianceItems, wasteByItem] = await Promise.all([
      theoreticalConsumptionRepository.getVariance(startDate, endDate, branchPosId, branchUuid),
      this.getByItem(filter),
    ])

    // Build waste lookup by item_id
    const wasteMap = new Map(wasteByItem.map((w) => [w.item_id, w]))

    // Build merged result — start from variance items
    const mergedMap = new Map<string, WasteVarianceSummary>()

    for (const v of varianceItems) {
      const waste = wasteMap.get(v.product_id)
      const varianceQty = v.variance_qty
      const wasteQty = waste?.total_qty ?? 0
      const unexplainedRaw = varianceQty - wasteQty
      const unexplainedQty = Math.max(0, unexplainedRaw)

      const severity = this.toVarianceSeverity(v.variance_pct)

      mergedMap.set(v.product_id, {
        product_id: v.product_id,
        product_name: v.product_name,
        product_code: v.product_code,
        uom: v.uom,
        actual_qty: v.actual_qty,
        theoretical_qty: v.theoretical_qty,
        variance_qty: varianceQty,
        variance_pct: v.variance_pct,
        severity,
        waste_qty: wasteQty,
        waste_cost: waste?.total_cost ?? 0,
        waste_breakdown: waste?.breakdown_by_source ?? emptyBreakdownBySource(),
        unexplained_qty: unexplainedQty,
        unexplained_pct: v.theoretical_qty > 0
          ? Math.round((unexplainedQty / v.theoretical_qty) * 10000) / 100
          : null,
      })
    }

    // Add waste-only items (tidak ada di theoretical, misal EXPIRED via stock adj)
    for (const w of wasteByItem) {
      if (mergedMap.has(w.item_id)) continue
      mergedMap.set(w.item_id, {
        product_id: w.item_id,
        product_name: w.item_name ?? '',
        product_code: '',
        uom: '',
        actual_qty: 0,
        theoretical_qty: 0,
        variance_qty: 0,
        variance_pct: null,
        severity: null,
        waste_qty: w.total_qty,
        waste_cost: w.total_cost,
        waste_breakdown: w.breakdown_by_source,
        unexplained_qty: 0,
        unexplained_pct: null,
      })
    }

    // Filter by category if specified (theoretical doesn't support category natively)
    let items = [...mergedMap.values()]
    if (filter.category_id) {
      const productIdsInCategory = await wasteReportRepository.getProductIdsByCategory(
        filter.category_id,
      )
      const categorySet = new Set(productIdsInCategory)
      items = items.filter((i) => categorySet.has(i.product_id))
    }

    // Sort by variance_qty DESC (biggest over-usage first)
    items.sort((a, b) => b.variance_qty - a.variance_qty)

    // Calculate totals
    let totalVarianceQty = 0
    let totalWasteQty = 0
    let totalUnexplainedQty = 0
    let itemsWithUnexplained = 0

    for (const item of items) {
      totalVarianceQty += item.variance_qty
      totalWasteQty += item.waste_qty
      totalUnexplainedQty += item.unexplained_qty
      if (item.unexplained_qty > 0) itemsWithUnexplained++
    }

    return {
      items,
      totals: {
        total_variance_qty: totalVarianceQty,
        total_waste_qty: totalWasteQty,
        total_unexplained_qty: totalUnexplainedQty,
        items_with_unexplained: itemsWithUnexplained,
      },
    }
  }

  private toVarianceSeverity(variancePct: number | null): VarianceSeverity | null {
    if (variancePct === null) return null
    const abs = Math.abs(variancePct)
    if (abs > 15) return 'CRITICAL'
    if (abs > 5) return 'WARNING'
    return 'OK'
  }

  async compare(filterA: WasteReportFilter, filterB: WasteReportFilter): Promise<WasteCompareResponse> {
    const [reportA, reportB] = await Promise.all([
      this.getWasteReport(filterA),
      this.getWasteReport(filterB),
    ])

    const period_a = this.toComparePeriod(reportA)
    const period_b = this.toComparePeriod(reportB)

    const diff_cost = period_a.total_cost - period_b.total_cost
    const diff_qty = period_a.total_qty - period_b.total_qty
    const diff_cost_pct =
      period_b.total_cost === 0 ? null : Math.round((diff_cost / period_b.total_cost) * 10000) / 100

    return { period_a, period_b, diff_cost, diff_cost_pct, diff_qty }
  }

  private toComparePeriod(report: WasteReportResponse): WasteComparePeriod {
    return {
      total_cost: report.summary.total_waste_cost,
      total_qty: report.summary.total_waste_qty,
      record_count: report.records.length,
      breakdown_by_source: report.summary.breakdown_by_source,
      percentage_of_purchase: report.summary.percentage_of_purchase,
    }
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
