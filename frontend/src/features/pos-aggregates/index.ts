/**
 * pos-aggregates/index.ts
 * 
 * Barrel exports for pos-aggregates feature module.
 * Provides convenient access to all exported types, APIs, stores, components, and pages.
 */

// =============================================================================
// TYPES
// =============================================================================

export * from './types'

// =============================================================================
// API
// =============================================================================

export { posAggregatesApi } from './api/posAggregates.api'

// =============================================================================
// STORE
// =============================================================================

export { usePosAggregatesStore } from './store/posAggregates.store'

// =============================================================================
// COMPONENTS
// =============================================================================

export { PosAggregatesStatusBadge } from './components/PosAggregatesStatusBadge'
export { PosAggregatesSummary } from './components/PosAggregatesSummary'
export { PosAggregatesFilters } from './components/PosAggregatesFilters'
export { PosAggregatesForm } from './components/PosAggregatesForm'
export { PosAggregatesTable } from './components/PosAggregatesTable'
export { PosAggregatesDetail } from './components/PosAggregatesDetail'

// =============================================================================
// PAGES
// =============================================================================

export { PosAggregatesPage } from './pages/PosAggregatesPage'
export { CreatePosAggregatePage } from './pages/CreatePosAggregatePage'
export { EditPosAggregatePage } from './pages/EditPosAggregatePage'
export { PosAggregateDetailPage } from './pages/PosAggregateDetailPage'

