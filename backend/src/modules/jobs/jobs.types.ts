/**
 * Jobs Module Types
 * Background job queue for export/import operations
 *
 * Design: Simple 'export'/'import' type enum + module field for scalability.
 * Generic metadata interfaces replace per-module interfaces to remove redundancy.
 */

// ---------------------------
// Base Types
// ---------------------------

export type JobType = 'export' | 'import'

export type JobModule =
  | 'employees'
  | 'companies'
  | 'products'
  | 'pos_transactions'
  | 'pos_imports'
  | 'fiscal_periods'
  | 'chart_of_accounts'
  | 'accounting_purposes'
  | 'accounting_purpose_accounts'
  | 'payment_methods'
  | 'categories'
  | 'sub_categories'
  | 'pos_aggregates'
  | 'pos_journals'
  | 'bank_statements'
  // future modules can be added here without DB changes
  // | 'tax_reports' | 'journals' | 'inventory' | 'suppliers'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// ---------------------------
// Generic Job Interface
// ---------------------------

export interface Job {
  id: string
  user_id: string
  company_id: string
  type: JobType
  module: JobModule
  name: string
  status: JobStatus
  progress: number
  result_url?: string
  file_path?: string
  file_size?: number
  error_message?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  expires_at?: string
  created_by?: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

// ---------------------------
// Generic Export / Import Metadata
// ---------------------------

export interface BaseJobMetadata {
  module: JobModule
  [key: string]: unknown
}

export interface ExportMetadata extends BaseJobMetadata {
  type: 'export'
  filter?: Record<string, unknown>
  columns?: string[]
}

export interface ImportMetadata extends BaseJobMetadata {
  type: 'import'
  skipDuplicates?: boolean
  requiredFields?: string[]
}

export interface PosTransactionsImportMetadata {
  type: 'import'
  module: 'pos_transactions'
  posImportId: string
  skipDuplicates?: boolean
}


/**
 * Generic per-module metadata with optional filter
 */
export interface ModuleExportMetadata<F extends Record<string, unknown> = Record<string, unknown>> extends ExportMetadata {
  module: JobModule
  filter?: F
}

export interface ModuleImportMetadata<F extends Record<string, unknown> = Record<string, unknown>> extends ImportMetadata {
  module: JobModule
  extra?: F
}

// ---------------------------
// Job Metadata Union
// ---------------------------

export type JobMetadata = ExportMetadata | ImportMetadata | ModuleExportMetadata | ModuleImportMetadata

// ---------------------------
// DTOs
// ---------------------------

export interface CreateJobDto {
  user_id: string
  company_id: string
  type: JobType
  module: JobModule
  name: string
  metadata?: JobMetadata
}

export interface UpdateJobDto {
  status?: JobStatus
  progress?: number
  result_url?: string
  file_path?: string
  file_size?: number
  error_message?: string
  metadata?: Record<string, unknown>
  started_at?: string
  completed_at?: string
  expires_at?: string
}

export interface JobFilters {
  type?: JobType
  module?: JobModule
  status?: JobStatus
  search?: string
}

export interface JobQueueConfig {
  maxConcurrentJobs: number
  jobTimeout: number
  retryAttempts: number
  retryDelay: number
  resultExpiration: number
  cleanupInterval: number
}

// ---------------------------
// Type Guards
// ---------------------------

export function isExportMetadata(metadata: unknown): metadata is ExportMetadata {
  return Boolean(metadata && typeof metadata === 'object' && (metadata as any).type === 'export')
}

export function isImportMetadata(metadata: unknown): metadata is ImportMetadata {
  return Boolean(metadata && typeof metadata === 'object' && (metadata as any).type === 'import')
}

/**
 * Generic module export type guard
 */
export function isModuleExportMetadata<M extends JobModule>(
  metadata: unknown,
  module: M
): metadata is ModuleExportMetadata {
  return isExportMetadata(metadata) && (metadata as any).module === module
}

/**
 * Generic module import type guard
 */
export function isModuleImportMetadata<M extends JobModule>(
  metadata: unknown,
  module: M
): metadata is ModuleImportMetadata {
  return isImportMetadata(metadata) && (metadata as any).module === module
}

export function isPosTransactionsImportMetadata(
  value: unknown
): value is PosTransactionsImportMetadata {
  if (!value || typeof value !== 'object') return false

  const v = value as any

  return (
    v.type === 'import' &&
    v.module === 'pos_transactions' &&
    typeof v.posImportId === 'string'
  )
}
