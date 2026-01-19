/**
 * Jobs Module Validation Schemas
 * Fully type-safe using Zod
 */

import { z as zodBase } from 'zod'

// UUID regex pattern
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// -----------------------------
// Enums
// -----------------------------
export const jobTypeEnum = zodBase.enum(['export', 'import'])

export const jobModuleEnum = zodBase.enum([
  'employees',
  'companies',
  'products',
  'pos_transactions',
  'fiscal_periods',
  'chart_of_accounts',
  'accounting_purposes',
  'accounting_purpose_accounts',
  'payment_methods',
  'categories',
  'sub_categories',
])

// -----------------------------
// Schemas
// -----------------------------

// Create Job
export const createJobSchema = zodBase.object({
  user_id: zodBase.string().regex(uuidRegex),
  company_id: zodBase.string().regex(uuidRegex),
  type: jobTypeEnum,
  module: jobModuleEnum,
  name: zodBase.string().min(1).max(255),
  metadata: zodBase.record(zodBase.string(), zodBase.unknown()).optional()
})

// Get Job by ID
export const getJobByIdSchema = zodBase.object({
  id: zodBase.string().regex(uuidRegex)
})

// Cancel Job
export const cancelJobSchema = zodBase.object({
  id: zodBase.string().regex(uuidRegex)
})

// Update Progress
export const updateProgressSchema = zodBase.object({
  id: zodBase.string().regex(uuidRegex),
  progress: zodBase.number().int().min(0).max(100)
})

// Query param: Get Available Modules
export const getAvailableModulesSchema = zodBase.object({
  type: jobTypeEnum
})
