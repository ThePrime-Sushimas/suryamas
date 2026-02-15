export type PosImportStatus = 
  | 'PENDING' 
  | 'ANALYZED' 
  | 'IMPORTED' 
  | 'MAPPED' 
  | 'POSTED' 
  | 'FAILED'

export interface PosImport {
  id: string
  company_id: string
  branch_id: string
  job_id?: string  // Added for jobs system integration
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
}

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

export interface FinancialSummary {
  totalAmount: number
  totalTax: number
}

export interface AnalyzeResult {
  import: PosImport
  analysis: DuplicateAnalysis
  summary: FinancialSummary
  job_id: string  // Added for jobs system integration
}

export interface PosImportLine {
  id: string
  pos_import_id: string
  row_number: number
  sales_number?: string
  bill_number?: string
  sales_type?: string
  sales_date?: string
  sales_date_in?: string
  sales_date_out?: string
  branch?: string
  payment_method?: string
  menu_category?: string
  menu?: string
  menu_code?: string
  qty?: number
  price?: number
  subtotal?: number
  discount?: number
  service_charge?: number
  tax?: number
  vat?: number
  total?: number
  nett_sales?: number
  bill_discount?: number
  total_after_bill_discount?: number
  created_at: string
}
