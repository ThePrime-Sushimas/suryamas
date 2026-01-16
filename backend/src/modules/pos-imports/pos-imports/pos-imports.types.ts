/**
 * POS Imports Types
 * Following journal-headers.types.ts pattern
 */

import { PosImportStatus } from '../shared/pos-import.types'

export interface PosImport {
  id: string
  company_id: string
  branch_id: string
  import_date: string
  date_range_start: string
  date_range_end: string
  file_name: string
  total_rows: number
  new_rows: number
  duplicate_rows: number
  status: PosImportStatus
  error_message?: string
  journal_id?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
  is_deleted: boolean
}

export interface CreatePosImportDto {
  company_id: string
  branch_id: string
  date_range_start: string
  date_range_end: string
  file_name: string
  total_rows: number
  new_rows: number
  duplicate_rows: number
}

export interface UpdatePosImportDto {
  status?: PosImportStatus
  error_message?: string
  journal_id?: string
  total_rows?: number
  new_rows?: number
  duplicate_rows?: number
}

export interface PosImportFilter {
  company_id: string
  branch_id?: string
  status?: PosImportStatus
  date_from?: string
  date_to?: string
  search?: string
}

export interface PosImportWithDetails extends PosImport {
  branch_name?: string
  created_by_name?: string
  line_count?: number
}
