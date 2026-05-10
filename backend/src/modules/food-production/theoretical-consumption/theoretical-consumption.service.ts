import { theoreticalConsumptionRepository } from './theoretical-consumption.repository'
import { BusinessRuleError } from '../../../utils/errors.base'
import type { TheoreticalConsumptionItem, VarianceItem, CoverageSummary, TheoreticalConsumptionQuery, MenuProfitabilityItem, CostTrendItem, WasteSummaryItem } from './theoretical-consumption.types'

function getSeverity(variancePct: number | null): 'normal' | 'warning' | 'critical' {
  if (variancePct === null) return 'normal'
  const abs = Math.abs(variancePct)
  if (abs > 15) return 'critical'
  if (abs > 5) return 'warning'
  return 'normal'
}

export class TheoreticalConsumptionService {
  async getTheoretical(query: TheoreticalConsumptionQuery): Promise<{ items: TheoreticalConsumptionItem[]; coverage: { total: number; withRecipe: number; pct: number } }> {
    let branchPosId: number | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchPosId = resolved.branchPosId
    }

    const [items, coverageData] = await Promise.all([
      theoreticalConsumptionRepository.getTheoreticalConsumption(query.period_start, query.period_end, branchPosId),
      theoreticalConsumptionRepository.getCoverage(query.period_start, query.period_end, branchPosId),
    ])

    const pct = coverageData.totalMenusSold > 0
      ? Number(((coverageData.menusWithRecipe / coverageData.totalMenusSold) * 100).toFixed(1))
      : 0

    return {
      items,
      coverage: { total: coverageData.totalMenusSold, withRecipe: coverageData.menusWithRecipe, pct },
    }
  }

  async getVariance(query: TheoreticalConsumptionQuery): Promise<{ items: VarianceItem[]; hasActualData: boolean }> {
    let branchPosId: number | undefined
    let branchUuid: string | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchPosId = resolved.branchPosId
      branchUuid = resolved.branchUuid
    }

    const items = await theoreticalConsumptionRepository.getVariance(query.period_start, query.period_end, branchPosId, branchUuid)

    // Apply severity
    const withSeverity = items.map(item => ({
      ...item,
      severity: getSeverity(item.variance_pct),
    }))

    const hasActualData = items.some(i => i.actual_qty > 0)

    return { items: withSeverity, hasActualData }
  }

  async getCoverage(query: TheoreticalConsumptionQuery): Promise<CoverageSummary> {
    let branchPosId: number | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchPosId = resolved.branchPosId
    }

    const data = await theoreticalConsumptionRepository.getCoverage(query.period_start, query.period_end, branchPosId)
    const menusWithout = data.totalMenusSold - data.menusWithRecipe
    const pct = data.totalMenusSold > 0
      ? Number(((data.menusWithRecipe / data.totalMenusSold) * 100).toFixed(1))
      : 0

    return {
      total_menus_sold: data.totalMenusSold,
      menus_with_recipe: data.menusWithRecipe,
      menus_without_recipe: menusWithout,
      coverage_pct: pct,
      items: data.items,
    }
  }

  async getMenuProfitability(query: TheoreticalConsumptionQuery): Promise<MenuProfitabilityItem[]> {
    let branchPosId: number | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchPosId = resolved.branchPosId
    }

    const items = await theoreticalConsumptionRepository.getMenuProfitability(query.period_start, query.period_end, branchPosId)

    // Assign tier: A = cost% <= 30, B = 30-45, C = > 45
    return items.map(item => ({
      ...item,
      tier: item.cost_pct <= 30 ? 'A' : item.cost_pct <= 45 ? 'B' : 'C',
    }))
  }

  async getCostTrend(companyId: string, query: TheoreticalConsumptionQuery): Promise<CostTrendItem[]> {
    if (!companyId) throw new BusinessRuleError('Company context tidak tersedia. Pastikan branch sudah dipilih.')

    let branchPosId: number | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchPosId = resolved.branchPosId
    }

    return theoreticalConsumptionRepository.getCostTrend(companyId, query.period_start, query.period_end, branchPosId)
  }

  async getWasteSummary(query: TheoreticalConsumptionQuery): Promise<{ items: WasteSummaryItem[]; totals: { total_waste_cost: number; total_used_cost: number; overall_waste_pct: number } }> {
    let branchUuid: string | undefined
    if (query.branch_id) {
      const resolved = await theoreticalConsumptionRepository.resolveBranchIds(query.branch_id)
      branchUuid = resolved.branchUuid
    }

    const items = await theoreticalConsumptionRepository.getWasteSummary(query.period_start, query.period_end, branchUuid)

    const totalWasteCost = items.reduce((s, i) => s + i.waste_cost, 0)
    const totalUsedCost = items.reduce((s, i) => s + i.total_used_cost, 0)
    const totalUsed = items.reduce((s, i) => s + i.total_used, 0)
    const totalWaste = items.reduce((s, i) => s + i.total_waste, 0)
    const overallWastePct = totalUsed > 0 ? Number(((totalWaste / totalUsed) * 100).toFixed(1)) : 0

    return { items, totals: { total_waste_cost: totalWasteCost, total_used_cost: totalUsedCost, overall_waste_pct: overallWastePct } }
  }
}

export const theoreticalConsumptionService = new TheoreticalConsumptionService()
