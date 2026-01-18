/**
 * Jobs Module Validation Schemas
 */

// Use direct zod import to avoid OpenAPI extension issues
import { z as zodBase } from 'zod'

// UUID regex pattern for validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Job type enum
export const jobTypeEnum = zodBase.enum(['export', 'import'])

// Valid modules for jobs
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

// Schema for creating a job
export const createJobSchema = zodBase.object({
  user_id: zodBase.string().regex(uuidRegex),
  company_id: zodBase.string().regex(uuidRegex),
  type: jobTypeEnum,
  module: jobModuleEnum,
  name: zodBase.string().min(1).max(255),
  metadata: zodBase.record(zodBase.string(), zodBase.unknown()).optional()
})

// Schema for getting job by ID
export const getJobByIdSchema = zodBase.object({
  id: zodBase.string()
})

// Schema for processing a job
export const processJobSchema = zodBase.object({
  id: zodBase.string()
})

// Schema for cancelling a job
export const cancelJobSchema = zodBase.object({
  id: zodBase.string()
})

// Schema for updating progress
export const updateProgressSchema = zodBase.object({
  id: zodBase.string(),
  progress: zodBase.number().int().min(0).max(100)
})

