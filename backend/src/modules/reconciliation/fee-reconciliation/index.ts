/**
 * Fee Reconciliation Module Index
 * Complete module exports following architecture pattern
 */

export * from './fee-reconciliation.service'
export * from './fee-reconciliation.controller'
export * from './fee-reconciliation.repository'
export * from './fee-reconciliation.routes'
export * from './fee-reconciliation.schema'
export * from './fee-reconciliation.types'
export * from './fee-reconciliation.errors'
export * from './fee-reconciliation.config'
export * from './fee-calculation.service'
export * from './marketing-fee.service'

// Re-exports for convenience (used by other modules)
export { feeReconciliationService } from './fee-reconciliation.service'
export { feeReconciliationRepository } from './fee-reconciliation.repository'
export { feeReconciliationRoutes } from './fee-reconciliation.routes'
export { feeReconciliationController } from './fee-reconciliation.controller'

