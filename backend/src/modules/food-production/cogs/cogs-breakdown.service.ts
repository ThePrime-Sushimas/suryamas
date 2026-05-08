import { cogsBreakdownRepository, type DailyCogsRow, type CategoryBreakdownRow, type GroupBreakdownRow, type MenuBreakdownRow } from './cogs-breakdown.repository'

export interface CogsBreakdownResult {
  daily: DailyCogsRow[]
  categories: CategoryBreakdownRow[]
  groups: GroupBreakdownRow[]
  menus: MenuBreakdownRow[]
  summary: {
    total_cogs: number
    total_revenue: number
    cogs_percentage: number
    days_count: number
    avg_daily_cogs: number
    peak_day: DailyCogsRow | null
  }
}

class CogsBreakdownService {
  async getFullBreakdown(
    companyId: string, periodStart: string, periodEnd: string, branchId?: string | null,
  ): Promise<CogsBreakdownResult> {
    const { daily, categories, groups, menus } = await cogsBreakdownRepository.getFullBreakdown(
      companyId, periodStart, periodEnd, branchId,
    )

    const totalCogs = daily.reduce((s, d) => s + d.total_cogs, 0)
    const totalRevenue = daily.reduce((s, d) => s + d.total_revenue, 0)
    const cogsPercentage = totalRevenue > 0 ? Math.round((totalCogs / totalRevenue) * 10000) / 100 : 0
    const daysCount = daily.length
    const avgDailyCogs = daysCount > 0 ? Math.round(totalCogs / daysCount) : 0
    const peakDay = daily.length > 0
      ? daily.reduce((max, d) => d.total_cogs > max.total_cogs ? d : max, daily[0])
      : null

    return {
      daily, categories, groups, menus,
      summary: { total_cogs: totalCogs, total_revenue: totalRevenue, cogs_percentage: cogsPercentage, days_count: daysCount, avg_daily_cogs: avgDailyCogs, peak_day: peakDay },
    }
  }

  async getMenusForGroup(
    companyId: string, periodStart: string, periodEnd: string,
    branchId: string | null, categoryCode: string | null, groupId: string | null,
  ): Promise<MenuBreakdownRow[]> {
    return cogsBreakdownRepository.getMenuBreakdown(companyId, periodStart, periodEnd, branchId, categoryCode, groupId)
  }
}

export const cogsBreakdownService = new CogsBreakdownService()
