// backend/src/modules/pos-aggregates/index.ts

// Types exports (primary source of truth for interfaces)
export * from './pos-aggregates.types'

// Schema exports (Zod schemas and utilities)
export * from './pos-aggregates.schema'

// Error exports
export * from './pos-aggregates.errors'

// Repository & Service exports
export { posAggregatesRepository } from './pos-aggregates.repository'
export { posAggregatesService } from './pos-aggregates.service'

