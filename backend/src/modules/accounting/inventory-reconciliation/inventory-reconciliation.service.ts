import { inventoryReconciliationRepository } from './inventory-reconciliation.repository'
import type { InventoryReconciliationParams, InventoryReconciliationResult, InventoryReconciliationRow } from './inventory-reconciliation.types'
import { logInfo } from '../../../config/logger'

export class InventoryReconciliationService {

  async getReconciliation(params: InventoryReconciliationParams): Promise<InventoryReconciliationResult> {
    logInfo('Fetching inventory reconciliation', {
      company_ids: params.companyIds,
      branch_count: params.branchIds.length,
      as_of_date: params.asOfDate,
    })

    const [subledgerMap, glMap, unjournaledWaste, unjournaledShortage] = await Promise.all([
      inventoryReconciliationRepository.getSubledgerByBranch(params),
      inventoryReconciliationRepository.getGlBalanceByBranch(params),
      inventoryReconciliationRepository.getUnjournaledWaste(params),
      inventoryReconciliationRepository.getUnjournaledShortage(params),
    ])

    // Merge both maps into reconciliation rows (LEFT JOIN logic in JS)
    const allBranchIds = new Set([...subledgerMap.keys(), ...glMap.keys()])
    const reconciliation: InventoryReconciliationRow[] = []

    let totalSubledger = 0
    let totalGl = 0

    for (const branchId of allBranchIds) {
      const sub = subledgerMap.get(branchId)
      const gl = glMap.get(branchId)

      const subledgerValue = sub?.value ?? 0
      const glBalance = gl?.value ?? 0
      const variance = subledgerValue - glBalance
      const variancePct = glBalance !== 0
        ? Number(((variance / Math.abs(glBalance)) * 100).toFixed(2))
        : subledgerValue !== 0 ? 100 : 0

      totalSubledger += subledgerValue
      totalGl += glBalance

      reconciliation.push({
        branch_id: branchId,
        branch_name: sub?.branch_name ?? gl?.branch_name ?? 'Unknown',
        subledger_value: Number(subledgerValue.toFixed(2)),
        gl_balance: Number(glBalance.toFixed(2)),
        variance: Number(variance.toFixed(2)),
        variance_pct: variancePct,
      })
    }

    // Sort by branch_name
    reconciliation.sort((a, b) => a.branch_name.localeCompare(b.branch_name))

    const totalVariance = totalSubledger - totalGl

    logInfo('Inventory reconciliation complete', {
      branch_count: reconciliation.length,
      total_subledger: totalSubledger,
      total_gl: totalGl,
      total_variance: totalVariance,
      unjournaled_waste_sessions: unjournaledWaste.length,
      unjournaled_shortage_rows: unjournaledShortage.length,
    })

    return {
      reconciliation,
      unjournaled_waste: unjournaledWaste,
      unjournaled_shortage: unjournaledShortage,
      as_of_date: params.asOfDate,
      total_subledger: Number(totalSubledger.toFixed(2)),
      total_gl: Number(totalGl.toFixed(2)),
      total_variance: Number(totalVariance.toFixed(2)),
    }
  }
}

export const inventoryReconciliationService = new InventoryReconciliationService()
