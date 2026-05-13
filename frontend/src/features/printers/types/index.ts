export interface Printer {
  id: string
  company_id: string
  branch_id: string | null
  printer_name: string
  ip_address: string
  port: number
  paper_width: number
  is_default: boolean
  is_active: boolean
  branch_name: string | null
  created_at: string
  updated_at: string
}

export interface CreatePrinterDto {
  branch_id?: string | null
  printer_name: string
  ip_address: string
  port: number
  paper_width?: number
  is_default?: boolean
  is_active?: boolean
}

export interface UpdatePrinterDto extends Partial<CreatePrinterDto> {}
