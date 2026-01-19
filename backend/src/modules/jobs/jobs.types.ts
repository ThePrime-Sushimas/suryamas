/**
 * Jobs Module Types
 * Background job queue for export/import operations
 * 
 * Design: Simple 'export'/'import' type enum + module field for scalability
 * This allows adding new export/import types without database migrations
 */

// Base job type (simple, extensible)
export type JobType = 'export' | 'import'

// Module types - define what module the job operates on
export type JobModule = 
  | 'employees'
  | 'companies'
  | 'products'
  | 'pos_transactions'
  | 'fiscal_periods'
  | 'chart_of_accounts'
  | 'accounting_purposes'
  | 'accounting_purpose_accounts'
  | 'payment_methods'
  | 'categories'
  | 'sub_categories'
  // Future modules can be added here without DB changes:
  // | 'tax_reports'
  // | 'journals'
  // | 'inventory'
  // | 'suppliers'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// Generic job interface
export interface Job {
  id: string
  user_id: string
  company_id: string
  type: JobType
  module: JobModule  // What module this job operates on
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

// Metadata interfaces for each job type
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

export interface EmployeesExportMetadata extends ExportMetadata {
  module: 'employees'
  filter?: {
    branch_id?: string
    is_active?: boolean
    search?: string
  }
}

export interface ProductsExportMetadata extends ExportMetadata {
  module: 'products'
  filter?: {
    category_id?: string
    is_active?: boolean
    search?: string
  }
}

export interface ProductsImportMetadata extends ImportMetadata {
  module: 'products'
  sheetName?: string
}

export interface PosTransactionsExportMetadata extends ExportMetadata {
  module: 'pos_transactions'
  filters: {
    dateFrom?: string
    dateTo?: string
    salesNumber?: string
    billNumber?: string
    branches?: string
    area?: string
    brand?: string
    city?: string
    menuName?: string
    paymentMethods?: string
    regularMemberName?: string
    customerName?: string
    visitPurpose?: string
    salesType?: string
    menuCategory?: string
    menuCategoryDetail?: string
    menuCode?: string
    customMenuName?: string
    tableSection?: string
    tableName?: string
  }
}

export interface PosTransactionsImportMetadata extends ImportMetadata {
  module: 'pos_transactions'
  posImportId: string
  filePath: string
  sheetName?: string
  companyId: string
  branchId?: string
  dateRangeStart?: string
  dateRangeEnd?: string
}

// Union type for all metadata
export type JobMetadata =
  | ExportMetadata
  | ImportMetadata
  | EmployeesExportMetadata
  | ProductsExportMetadata
  | ProductsImportMetadata
  | PosTransactionsExportMetadata
  | PosTransactionsImportMetadata

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
  jobTimeout: number // milliseconds
  retryAttempts: number
  retryDelay: number // milliseconds
  resultExpiration: number // milliseconds (1 hour = 3600000)
  cleanupInterval: number // milliseconds
}

// ============================================
// Type Guards for Metadata Validation
// ============================================

/**
 * Check if metadata is a valid ExportMetadata
 */
export function isExportMetadata(metadata: unknown): metadata is ExportMetadata {
  if (!metadata || typeof metadata !== 'object') return false
  const m = metadata as Record<string, unknown>
  return m.type === 'export' && typeof m.module === 'string'
}

/**
 * Check if metadata is a valid ImportMetadata
 */
export function isImportMetadata(metadata: unknown): metadata is ImportMetadata {
  if (!metadata || typeof metadata !== 'object') return false
  const m = metadata as Record<string, unknown>
  return m.type === 'import' && typeof m.module === 'string'
}

/**
 * Check if metadata is EmployeesExportMetadata
 */
export function isEmployeesExportMetadata(metadata: unknown): metadata is EmployeesExportMetadata {
  return isExportMetadata(metadata) && (metadata as ExportMetadata).module === 'employees'
}

/**
 * Check if metadata is ProductsExportMetadata
 */
export function isProductsExportMetadata(metadata: unknown): metadata is ProductsExportMetadata {
  return isExportMetadata(metadata) && (metadata as ExportMetadata).module === 'products'
}

/**
 * Check if metadata is ProductsImportMetadata
 */
export function isProductsImportMetadata(metadata: unknown): metadata is ProductsImportMetadata {
  return isImportMetadata(metadata) && (metadata as ImportMetadata).module === 'products'
}

/**
 * Check if metadata is PosTransactionsExportMetadata
 */
export function isPosTransactionsExportMetadata(metadata: unknown): metadata is PosTransactionsExportMetadata {
  return isExportMetadata(metadata) && (metadata as ExportMetadata).module === 'pos_transactions'
}

/**
 * Check if metadata is PosTransactionsImportMetadata
 */
export function isPosTransactionsImportMetadata(metadata: unknown): metadata is PosTransactionsImportMetadata {
  return isImportMetadata(metadata) && (metadata as ImportMetadata).module === 'pos_transactions'
}
