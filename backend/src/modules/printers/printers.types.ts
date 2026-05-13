export interface Printer {
  id: string
  company_id: string
  branch_id: string | null
  printer_name: string
  ip_address: string
  port: number
  paper_width: number // mm (58 or 80)
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface PrinterWithRelations extends Printer {
  branch_name: string | null
}

export interface CreatePrinterDto {
  branch_id?: string | null
  printer_name: string
  ip_address: string
  port: number
  paper_width?: number
  is_default?: boolean
  is_active?: boolean
  created_by?: string
  updated_by?: string
}

export interface UpdatePrinterDto {
  branch_id?: string | null
  printer_name?: string
  ip_address?: string
  port?: number
  paper_width?: number
  is_default?: boolean
  is_active?: boolean
  updated_by?: string
}
