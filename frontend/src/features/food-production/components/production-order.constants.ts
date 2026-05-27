export const PRODUCTION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  JOURNALED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  VOID: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

/** Planned cost for DRAFT orders; actual material cost after completion. */
export function getProductionOrderDisplayCost(order: {
  status: string
  total_material_cost: number
  total_estimated_cost?: number
  lines?: Array<{ cost_per_batch: number; planned_batch_qty: number }>
}): number {
  if (order.status === 'DRAFT') {
    if (order.lines?.length) {
      return order.lines.reduce((sum, l) => sum + l.cost_per_batch * l.planned_batch_qty, 0)
    }
    return order.total_estimated_cost ?? 0
  }
  return order.total_material_cost
}

export function getProductionOrderCostLabel(status: string): string {
  return status === 'DRAFT' ? 'Est. Cost' : 'Material Cost'
}
