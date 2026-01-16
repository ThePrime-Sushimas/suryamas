/**
 * POS Import Shared Types
 * Following journal.types.ts pattern
 */

export type PosImportStatus = 
  | 'PENDING' 
  | 'ANALYZED' 
  | 'IMPORTED' 
  | 'MAPPED' 
  | 'POSTED' 
  | 'FAILED'

export interface DuplicateAnalysis {
  total_rows: number
  new_rows: number
  duplicate_rows: number
  duplicates: Array<{
    bill_number: string
    sales_number: string
    sales_date: string
    existing_import_id: string
  }>
}

export interface ImportStatistics {
  total_rows: number
  new_rows: number
  duplicate_rows: number
  date_range_start: string
  date_range_end: string
}
