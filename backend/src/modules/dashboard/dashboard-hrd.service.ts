import { dashboardHrdRepository } from './dashboard-hrd.repository'

export interface HrdDashboardData {
  summary: {
    total_employees: number
    active_employees: number
    active_branches: number
    multi_branch_count: number
  }
  branches: Array<{
    branch_id: string
    branch_name: string
    employee_count: number
    positions: Array<{ job_position: string; count: number }>
  }>
  position_summary: Array<{ job_position: string; count: number }>
  multi_branch_employees: Array<{
    employee_id: string
    full_name: string
    job_position: string
    role_name: string | null
    branch_count: number
    branches: string[]
  }>
}

class DashboardHrdService {
  async getHrdSummary(companyId: string): Promise<HrdDashboardData> {
    const [summary, branchPositions, positionSummary, multiBranch] = await Promise.all([
      dashboardHrdRepository.getSummary(companyId),
      dashboardHrdRepository.getBranchPositions(companyId),
      dashboardHrdRepository.getPositionSummary(companyId),
      dashboardHrdRepository.getMultiBranchEmployees(companyId),
    ])

    // Group branch positions into nested structure
    const branchMap = new Map<string, HrdDashboardData['branches'][number]>()
    for (const row of branchPositions) {
      if (!branchMap.has(row.branch_id)) {
        branchMap.set(row.branch_id, { branch_id: row.branch_id, branch_name: row.branch_name, employee_count: 0, positions: [] })
      }
      const branch = branchMap.get(row.branch_id)!
      branch.employee_count += row.count
      branch.positions.push({ job_position: row.job_position, count: row.count })
    }

    return {
      summary,
      branches: Array.from(branchMap.values()).sort((a, b) => b.employee_count - a.employee_count),
      position_summary: positionSummary,
      multi_branch_employees: multiBranch,
    }
  }
}

export const dashboardHrdService = new DashboardHrdService()
